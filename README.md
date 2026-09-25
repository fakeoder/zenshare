# Zenshare

An anonymous static text-file sharing service built on Cloudflare Workers and D1.

## Features

- Upload a single text file up to 512KB: HTML, ICS, CSV, JSON, Markdown, TXT, XML, or YAML, with an optional alias and metadata.
- Shares are accessible at `/s/<alias>` and render by type (HTML in a sandboxed iframe; ICS as event cards; CSV as a table; others as formatted text).
- Alias availability is checked before upload and enforced with a unique D1 index.
- Retention options are 1 day, 7 days (default), 30 days, or permanent. Expired records are removed by a daily UTC 20:00 cron job and lazily on read.
- D1 keeps up to 2000 shares. When full, creation returns a "storage full" response.
- Optional password protection: files are encrypted in the browser with PBKDF2 and AES-256-GCM; the server never stores passwords.
- Optional management: a share created as *manageable* is bound to a manage token — 256 bits of browser-generated randomness whose SHA-256 hash is the only thing stored server-side. The token is downloaded as `zenshare-token.json`, re-imported by uploading that file, and cached in `localStorage`.
- A "My shares" tab on the share browser lists everything under the loaded token (including password-protected shares) and supports editing metadata, changing retention, replacing the file (re-choosing encryption and password), and deleting.
- The upload page defaults to a public visibility; turning on Private requires an access password and keeps the share out of the public directory.
- A public share browser at `/browse.html` lists every unencrypted, unexpired share with search, a permanent-only filter, and pagination; its "My shares" tab lists the current token's shares with edit/delete actions. Password-protected shares never appear in the public list.
- Reader pages render content in a sandboxed iframe (HTML) or a type-specific view, with meta info, file download (correct MIME/filename), and a one-click share that copies the link, including the access password when present.
- A status page shows service health and share capacity usage: healthy below 80%, warning from 80%, and error at 99% or more.
- Responsive layout, light/dark theme, and Chinese/English UI.

## Project Layout

```text
src/index.js          Worker routes, API, cron cleanup
public/               Upload and reader page assets
public/token.js       Manage token storage / import / download helpers
migrations/           D1 migrations
scripts/smoke-test.mjs Local smoke test (encryption, API, manage token round trip)
wrangler.toml         Worker / D1 / cron configuration
```

## Local Development

```bash
npm install
npm run db:local
npm run dev
```

The local server runs at `http://127.0.0.1:8787`.

Run the smoke test:

```bash
npm run smoke
```

The smoke test creates a password-protected share and verifies upload, read, decryption, wrong-password rejection, and alias duplicate detection, then exercises the manage token flow: weak-token rejection, token-scoped listing, metadata/content updates, encryption toggling, and deletion.

## Database

The D1 binding is defined in `wrangler.toml`. Do not publish credentials or database identifiers in public documentation.

Create the schema in the remote D1 database:

```bash
wrangler login
npm run db:remote
```

The Worker also runs idempotent `CREATE TABLE IF NOT EXISTS` statements on first access, so a missing migration will not break the service.

## Deploy

```bash
npm run deploy
```

The Worker name, routes, and cron trigger are defined in `wrangler.toml`.

## API

### Check Alias

```http
GET /api/alias-check?alias=demo
```

Returns availability and the normalized alias. An empty or omitted alias is reported as available with `generated: true`.

### Create Share

```http
POST /api/share
Content-Type: application/json
```

```json
{
    "alias": "demo",
  "title": "Report title",
  "description": "Description",
  "author": "Author",
  "tags": ["report", "demo"],
  "expires_days": 7,
  "password_protected": true,
  "file_type": "html",
  "filename": "report.html",
  "content": "base64(ciphertext or plaintext)",
  "salt": "base64(16 bytes)",
  "iv": "base64(12 bytes)",
  "manage_token": "base64url(32 random bytes)"
}
```

`alias` is optional; an empty or omitted value generates a UUID alias. `expires_days` must be `1`, `7`, `30`, or `null` for permanent retention, and defaults to 7. When `password_protected` is `true`, `salt` and `iv` are required. `file_type` must be one of `html`, `ics`, `csv`, `json`, `md`, `txt`, `xml`, `yaml` (defaults to `html`); `filename` is optional and used as the download name. Unencrypted `ics` content is checked for `BEGIN:VCALENDAR`.

`manage_token` is optional. When present, the share becomes manageable: the server stores only the token's SHA-256 hash and never the token itself. A token must be 32-128 characters of `A-Za-z0-9_-` with at least 16 distinct characters, so a hand-written weak token is rejected.

### Raw Content

```http
GET /s/<alias>/raw
```

Returns the original bytes with the correct `Content-Type` and `Content-Disposition` (filename from `filename`, falling back to `<alias>.<ext>`). Available for unencrypted, unexpired shares only; password-protected shares return `403`. An ICS share's raw URL can be used directly as a calendar subscription URL.

### List Public Shares

```http
GET /api/shares?q=report&tag=demo&permanent=1&page=1&page_size=20
```

Returns metadata-only items for unencrypted, unexpired shares. `q` searches alias, title, description, author, and tags; `tag` requires an exact tag match; `permanent=1` keeps permanent shares only. Pagination is capped at 50 items per page. The response never includes `content`, `salt`, or `iv`.

### My Shares

```http
GET /api/my-shares?q=report&permanent=1&page=1&page_size=20
Authorization: Bearer <manage_token>
```

Returns metadata-only items for the token's own unexpired shares, encrypted ones included. Missing or malformed token: `401`. Token that does not own any matching share simply gets an empty list; a wrong token addressing a specific alias gets `404`. The response never includes `content`, `salt`, `iv`, or `manage_token_hash`.

### Update Share

```http
PATCH /api/share/<alias>
Content-Type: application/json
Authorization: Bearer <manage_token>
```

```json
{
  "title": "New title",
  "description": "New description",
  "author": "New author",
  "tags": ["report"],
  "expires_days": 30
}
```

Omitted fields stay unchanged; `alias` (the URL) can never be changed. `expires_days` accepts `1`, `7`, `30`, or `null` and is recomputed from the update time. To replace the file, send `content` together with `file_type`, `filename`, and the new encryption state (`password_protected` plus `salt`/`iv` when encrypting). Asking to change encryption without a new `content` field fails with `code=content_required`, because the server only holds ciphertext.

### Delete Share

```http
DELETE /api/share/<alias>
Authorization: Bearer <manage_token>
```

Removes the share, permanent ones included.

## Security Notes

- Password-protected shares are zero-knowledge: the key is derived in the reader's browser and the server only stores ciphertext, salt, and IV.
- Unprotected shares are stored as plaintext and appear in the public share browser; password-protected shares are excluded from the public list.
- Reader pages render uploaded HTML inside an iframe without `allow-same-origin`, so uploaded scripts cannot access the Zenshare origin. Non-HTML text types are rendered as inert DOM (escaped text/tables), never executed.
- Manage tokens are 256-bit values from `crypto.getRandomValues` in the browser; the server stores only their SHA-256 hash, so a database leak cannot recover one. Knowing the open-source code does not help an attacker: there is no secret to derive, only an unguessable value. The token lives in `localStorage` and in the downloadable `zenshare-token.json` — it is the sole management credential, it cannot be recovered if lost, and it grants edit/delete on every share created under it.
- Manage endpoints are rate-limit free by design: a 256-bit guess space makes enumeration infeasible, but add an edge rate limit if you expose the service at scale.
- Permanent shares are editable and deletable through the "My shares" tab when they were created with a manage token; shares without one must be removed directly in D1.

## License

MIT. See [LICENSE](LICENSE).

## Open Source

[github.com/fakeoder/zenshare](https://github.com/fakeoder/zenshare)

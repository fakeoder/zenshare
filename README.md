# Zenshare

An anonymous static HTML sharing service built on Cloudflare Workers and D1.

## Features

- Upload a single static `.html` file up to 512KB with an optional alias and metadata.
- Shares are accessible at `/s/<alias>`.
- Alias availability is checked before upload and enforced with a unique D1 index.
- Retention options are 1 day, 7 days (default), 30 days, or permanent. Expired records are removed by a daily UTC 20:00 cron job and lazily on read.
- D1 keeps up to 2000 shares. When full, creation returns a "storage full" response.
- Optional password protection: files are encrypted in the browser with PBKDF2 and AES-256-GCM; the server never stores passwords.
- Reader pages render content in a sandboxed iframe with meta info, HTML download, and a share panel that provides the HTML link plus a current-state snapshot image.
- Responsive layout, light/dark theme, and Chinese/English UI.

## Project Layout

```text
src/index.js          Worker routes, API, cron cleanup
public/               Upload and reader page assets
migrations/           D1 migration
scripts/smoke-test.mjs Local smoke test (encryption + API round trip)
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

The smoke test creates a password-protected share and verifies upload, read, decryption, wrong-password rejection, and alias duplicate detection.

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
  "content": "base64(ciphertext or plaintext)",
  "salt": "base64(16 bytes)",
  "iv": "base64(12 bytes)"
}
```

`alias` is optional; an empty or omitted value generates a UUID alias. `expires_days` must be `1`, `7`, `30`, or `null` for permanent retention, and defaults to 7. When `password_protected` is `true`, `salt` and `iv` are required.

## Security Notes

- Password-protected shares are zero-knowledge: the key is derived in the reader's browser and the server only stores ciphertext, salt, and IV.
- Unprotected shares are stored as plaintext.
- Reader pages render uploaded HTML inside an iframe without `allow-same-origin`, so uploaded scripts cannot access the Zenshare origin.
- Permanent shares are not editable or deletable through the UI; remove them directly in D1 if needed.

## License

MIT. See [LICENSE](LICENSE).

## Open Source

[github.com/fakeoder/zenshare](https://github.com/fakeoder/zenshare)

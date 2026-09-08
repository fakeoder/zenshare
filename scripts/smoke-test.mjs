const BASE = process.env.ZENSHARE_BASE || "http://127.0.0.1:8787";
const ITERATIONS = 100000;

function bytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function encrypt(bytes, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { cipher: new Uint8Array(cipher), salt, iv };
}

async function decrypt(cipher, salt, iv, password) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder("utf-8").decode(plain);
}

async function main() {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const html = '<!doctype html><h1>Secret Content</h1><p>private note</p>';
  const password = "smoke-pass-123";

  const { cipher, salt, iv } = await encrypt(
    new TextEncoder().encode(html),
    password
  );
  const createResponse = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias: "",
      title: "Smoke Report",
      author: "smoke",
      tags: ["smoke"],
      password_protected: true,
      content: bytesToBase64(cipher),
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      expires_days: null,
    }),
  });
  const created = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(`create failed: ${JSON.stringify(created)}`);
  }
  if (!UUID_RE.test(created.alias) || !created.permanent) {
    throw new Error("automatic alias or permanent retention failed");
  }

  const viewResponse = await fetch(`${BASE}${created.path}`);
  const viewHtml = await viewResponse.text();
  const match = viewHtml.match(
    /<script type="application\/json" id="share-data">([\s\S]*?)<\/script>/
  );
  if (!match) {
    throw new Error("share-data block missing from view page");
  }
  const data = JSON.parse(match[1]);
  const plain = await decrypt(
    base64ToBytes(data.content),
    base64ToBytes(data.salt),
    base64ToBytes(data.iv),
    password
  );
  if (plain !== html) {
    throw new Error("decrypted content does not match uploaded content");
  }
  if (!data.isPermanent || data.expiresAt !== null) {
    throw new Error("permanent share metadata is incorrect");
  }
  let wrongPasswordRejected = false;
  try {
    await decrypt(
      base64ToBytes(data.content),
      base64ToBytes(data.salt),
      base64ToBytes(data.iv),
      "wrong-password"
    );
  } catch {
    wrongPasswordRejected = true;
  }
  if (!wrongPasswordRejected) {
    throw new Error("wrong password should fail decryption");
  }

  const checkAfter = await (
    await fetch(`${BASE}/api/alias-check?alias=${created.alias}`)
  ).json();
  if (checkAfter.available) {
    throw new Error("generated alias should be unavailable after create");
  }

  const publicHtml = '<!doctype html><h1>Public Smoke Content</h1>';
  const publicCreateResponse = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias: "",
      title: "Public Smoke Report",
      author: "smoke",
      tags: ["smoke", "public"],
      password_protected: false,
      content: bytesToBase64(new TextEncoder().encode(publicHtml)),
      expires_days: null,
    }),
  });
  const publicCreated = await publicCreateResponse.json();
  if (!publicCreateResponse.ok) {
    throw new Error(`public create failed: ${JSON.stringify(publicCreated)}`);
  }

  const listParams = new URLSearchParams({
    q: "Public Smoke",
    page_size: "20",
    permanent: "1",
  });
  const listResponse = await fetch(`${BASE}/api/shares?${listParams}`);
  const listing = await listResponse.json();
  if (
    !listResponse.ok ||
    !Array.isArray(listing.items) ||
    listing.total < 1 ||
    listing.totalPages < 1
  ) {
    throw new Error(`public listing failed: ${JSON.stringify(listing)}`);
  }
  if (!listing.items.some((item) => item.alias === publicCreated.alias)) {
    throw new Error("public share should appear in the public list");
  }
  if (listing.items.some((item) => item.alias === created.alias)) {
    throw new Error("password-protected share must not appear in the public list");
  }
  if (listing.items.some((item) => "content" in item)) {
    throw new Error("public list must not expose share content");
  }

  const tagResponse = await fetch(`${BASE}/api/shares?tag=public&page_size=20`);
  const tagged = await tagResponse.json();
  if (!tagResponse.ok || !tagged.items.some((item) => item.alias === publicCreated.alias)) {
    throw new Error(`tag filter failed: ${JSON.stringify(tagged)}`);
  }

  const missResponse = await fetch(`${BASE}/api/shares?q=missing-share-term&page_size=5`);
  const missed = await missResponse.json();
  if (missed.total !== 0 || missed.items.length !== 0) {
    throw new Error(`search miss should be empty: ${JSON.stringify(missed)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        alias: created.alias,
        path: created.path,
        passwordProtected: data.passwordProtected,
        decryptedMatches: true,
        wrongPasswordRejected,
        duplicateCheckAfterCreate: !checkAfter.available,
        publicListAlias: publicCreated.alias,
        publicListExcludesPasswordProtected: true,
        publicListOmitsContent: true,
        tagFilterMatches: true,
        searchMissEmpty: true,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

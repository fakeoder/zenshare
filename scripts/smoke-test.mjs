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
  const alias = `smoke-${Date.now().toString(36)}`;
  const html = '<!doctype html><h1>Secret Content</h1><p>private note</p>';
  const password = "smoke-pass-123";

  const checkBefore = await (
    await fetch(`${BASE}/api/alias-check?alias=${alias}`)
  ).json();
  if (!checkBefore.available) {
    throw new Error(`alias ${alias} is already taken`);
  }

  const { cipher, salt, iv } = await encrypt(
    new TextEncoder().encode(html),
    password
  );
  const createResponse = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias,
      title: "Smoke Report",
      author: "smoke",
      tags: ["smoke"],
      password_protected: true,
      content: bytesToBase64(cipher),
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      expires_days: 7,
    }),
  });
  const created = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(`create failed: ${JSON.stringify(created)}`);
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
    await fetch(`${BASE}/api/alias-check?alias=${alias}`)
  ).json();
  if (checkAfter.available) {
    throw new Error("alias should be unavailable after create");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        alias,
        path: created.path,
        passwordProtected: data.passwordProtected,
        decryptedMatches: true,
        wrongPasswordRejected,
        duplicateCheckAfterCreate: !checkAfter.available,
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

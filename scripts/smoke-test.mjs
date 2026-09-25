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

async function deriveWrapKey(token, salt, usages) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}

async function wrapPassword(password, token) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveWrapKey(token, salt, ["encrypt"]);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(password)
  );
  return `v1.${bytesToBase64(salt)}.${bytesToBase64(iv)}.${bytesToBase64(
    new Uint8Array(cipher)
  )}`;
}

async function unwrapPassword(bundle, token) {
  const parts = String(bundle).split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("invalid_wrap");
  const salt = base64ToBytes(parts[1]);
  const iv = base64ToBytes(parts[2]);
  const cipher = base64ToBytes(parts[3]);
  const key = await deriveWrapKey(token, salt, ["decrypt"]);
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

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "SUMMARY:Smoke Event",
    "DTSTART:20260101T100000",
    "DTEND:20260101T110000",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const icsCreateResponse = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias: "",
      title: "Smoke Calendar",
      password_protected: false,
      file_type: "ics",
      filename: "smoke.ics",
      content: bytesToBase64(new TextEncoder().encode(ics)),
      expires_days: null,
    }),
  });
  const icsCreated = await icsCreateResponse.json();
  if (!icsCreateResponse.ok) {
    throw new Error(`ics create failed: ${JSON.stringify(icsCreated)}`);
  }
  const icsViewResponse = await fetch(`${BASE}${icsCreated.path}`);
  const icsViewHtml = await icsViewResponse.text();
  const icsMatch = icsViewHtml.match(
    /<script type="application\/json" id="share-data">([\s\S]*?)<\/script>/
  );
  if (!icsMatch) {
    throw new Error("ics share-data block missing");
  }
  const icsData = JSON.parse(icsMatch[1]);
  if (icsData.fileType !== "ics" || icsData.filename !== "smoke.ics") {
    throw new Error(`ics metadata incorrect: ${JSON.stringify(icsData)}`);
  }
  const icsPlain = new TextDecoder("utf-8").decode(base64ToBytes(icsData.content));
  if (!icsPlain.includes("BEGIN:VCALENDAR")) {
    throw new Error("ics content mismatch");
  }

  const badIcsResponse = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias: "smoke-bad-ics",
      password_protected: false,
      file_type: "ics",
      content: bytesToBase64(new TextEncoder().encode("not a calendar")),
      expires_days: null,
    }),
  });
  if (badIcsResponse.ok) {
    throw new Error("invalid ics content should be rejected");
  }

  const badTypeResponse = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias: "smoke-bad-type",
      password_protected: false,
      file_type: "exe",
      content: bytesToBase64(new TextEncoder().encode("MZ")),
      expires_days: null,
    }),
  });
  if (badTypeResponse.ok) {
    throw new Error("unsupported file_type should be rejected");
  }

  const rawIcsResponse = await fetch(`${BASE}/s/${icsCreated.alias}/raw`);
  if (!rawIcsResponse.ok) {
    throw new Error(`ics raw fetch failed: ${rawIcsResponse.status}`);
  }
  const rawIcsType = rawIcsResponse.headers.get("content-type") || "";
  if (!rawIcsType.includes("text/calendar")) {
    throw new Error(`ics raw content-type wrong: ${rawIcsType}`);
  }
  const rawDisposition = rawIcsResponse.headers.get("content-disposition") || "";
  if (!rawDisposition.includes("smoke.ics")) {
    throw new Error(`ics raw disposition wrong: ${rawDisposition}`);
  }
  const rawIcsBody = await rawIcsResponse.text();
  if (!rawIcsBody.includes("BEGIN:VCALENDAR")) {
    throw new Error("ics raw body mismatch");
  }

  const rawProtectedResponse = await fetch(`${BASE}/s/${created.alias}/raw`);
  if (rawProtectedResponse.status !== 403) {
    throw new Error(
      `encrypted share raw should be 403, got ${rawProtectedResponse.status}`
    );
  }

  const rawPublicResponse = await fetch(`${BASE}/s/${publicCreated.alias}/raw`);
  const rawPublicBody = await rawPublicResponse.text();
  if (!rawPublicResponse.ok || !rawPublicBody.includes(publicHtml)) {
    throw new Error("public raw body mismatch");
  }

  // ---- manage token flow ----
  function randomToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  const manageToken = randomToken();
  const otherToken = randomToken();
  const bearer = (token) => ({ authorization: `Bearer ${token}` });

  const weakResponse = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias: "smoke-weak-token",
      password_protected: false,
      content: bytesToBase64(new TextEncoder().encode("weak")),
      expires_days: null,
      manage_token: "a".repeat(40),
    }),
  });
  if (weakResponse.ok) {
    throw new Error("low-entropy manage token should be rejected");
  }

  const managedCreate = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias: "",
      title: "Managed Share",
      author: "smoke",
      tags: ["smoke", "managed"],
      password_protected: false,
      content: bytesToBase64(new TextEncoder().encode("<h1>Managed v1</h1>")),
      expires_days: 7,
      manage_token: manageToken,
    }),
  });
  const managed = await managedCreate.json();
  if (!managedCreate.ok) {
    throw new Error(`managed create failed: ${JSON.stringify(managed)}`);
  }

  const plainCreate = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias: "",
      title: "Unmanaged Share",
      password_protected: false,
      content: bytesToBase64(new TextEncoder().encode("<h1>no token</h1>")),
      expires_days: null,
    }),
  });
  if (!plainCreate.ok) throw new Error("unmanaged create failed");

  const noTokenList = await fetch(`${BASE}/api/my-shares`);
  if (noTokenList.status !== 401) {
    throw new Error(`my-shares without token should be 401, got ${noTokenList.status}`);
  }

  const wrongTokenList = await fetch(`${BASE}/api/my-shares`, {
    headers: bearer(otherToken),
  });
  const wrongTokenData = await wrongTokenList.json();
  if (!wrongTokenList.ok || wrongTokenData.total !== 0) {
    throw new Error(`wrong token should see an empty list: ${JSON.stringify(wrongTokenData)}`);
  }

  const myListResponse = await fetch(`${BASE}/api/my-shares?page_size=50`, {
    headers: bearer(manageToken),
  });
  const myList = await myListResponse.json();
  if (!myListResponse.ok) throw new Error(`my-shares failed: ${JSON.stringify(myList)}`);
  const managedItem = (myList.items || []).find((item) => item.alias === managed.alias);
  if (!managedItem) throw new Error("managed share missing from my-shares");
  if ((myList.items || []).some((item) => item.title === "Unmanaged Share")) {
    throw new Error("share without token must not appear in my-shares");
  }
  if (managedItem.passwordProtected || managedItem.fileType !== "html") {
    throw new Error(`my-shares metadata wrong: ${JSON.stringify(managedItem)}`);
  }
  if ("password_wrap" in managedItem) {
    throw new Error("my-shares must not expose password_wrap");
  }

  const publicQuery = "q=Managed&page_size=50";
  const publicOwnedList = await (
    await fetch(`${BASE}/api/shares?${publicQuery}`, { headers: bearer(manageToken) })
  ).json();
  const ownedPublicItem = (publicOwnedList.items || []).find(
    (item) => item.alias === managed.alias
  );
  if (!ownedPublicItem || ownedPublicItem.manageable !== true) {
    throw new Error(
      `owned share should be manageable in the public list: ${JSON.stringify(ownedPublicItem)}`
    );
  }
  if (
    "content" in ownedPublicItem ||
    "password_wrap" in ownedPublicItem ||
    ownedPublicItem.passwordProtected
  ) {
    throw new Error(`public list leaks private fields: ${JSON.stringify(ownedPublicItem)}`);
  }
  const publicForeignList = await (
    await fetch(`${BASE}/api/shares?${publicQuery}`, { headers: bearer(otherToken) })
  ).json();
  const foreignPublicItem = (publicForeignList.items || []).find(
    (item) => item.alias === managed.alias
  );
  if (!foreignPublicItem || foreignPublicItem.manageable !== false) {
    throw new Error("a foreign token must not mark the share manageable");
  }
  const publicAnonList = await (await fetch(`${BASE}/api/shares?${publicQuery}`)).json();
  const anonPublicItem = (publicAnonList.items || []).find(
    (item) => item.alias === managed.alias
  );
  if (!anonPublicItem || anonPublicItem.manageable !== false) {
    throw new Error("an anonymous public list must not mark shares manageable");
  }

  const noAuthPatch = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Hacked" }),
  });
  if (noAuthPatch.status !== 401) {
    throw new Error(`patch without token should be 401, got ${noAuthPatch.status}`);
  }

  const wrongPatch = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "PATCH",
    headers: { ...bearer(otherToken), "content-type": "application/json" },
    body: JSON.stringify({ title: "Hacked" }),
  });
  if (wrongPatch.status !== 404) {
    throw new Error(`patch with wrong token should be 404, got ${wrongPatch.status}`);
  }

  const cryptoPatch = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "PATCH",
    headers: { ...bearer(manageToken), "content-type": "application/json" },
    body: JSON.stringify({ password_protected: true }),
  });
  if (cryptoPatch.ok) {
    throw new Error("changing encryption without a new file should be rejected");
  }
  const cryptoPatchData = await cryptoPatch.json();
  if (cryptoPatchData.code !== "content_required") {
    throw new Error(`unexpected error: ${JSON.stringify(cryptoPatchData)}`);
  }

  const metaPatch = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "PATCH",
    headers: { ...bearer(manageToken), "content-type": "application/json" },
    body: JSON.stringify({
      title: "Managed Share Updated",
      description: "updated by smoke",
      tags: ["smoke", "updated"],
      expires_days: 30,
    }),
  });
  const metaPatchResult = await metaPatch.json();
  if (!metaPatch.ok || !metaPatchResult.ok) {
    throw new Error(`meta patch failed: ${JSON.stringify(metaPatchResult)}`);
  }
  if (metaPatchResult.expires_at <= Date.now() + 20 * 24 * 60 * 60 * 1000) {
    throw new Error("expiry should be extended by 30 days");
  }

  const updatedList = await (
    await fetch(`${BASE}/api/my-shares?page_size=50`, { headers: bearer(manageToken) })
  ).json();
  const updatedItem = (updatedList.items || []).find((item) => item.alias === managed.alias);
  if (
    !updatedItem ||
    updatedItem.title !== "Managed Share Updated" ||
    updatedItem.description !== "updated by smoke" ||
    !updatedItem.tags.includes("updated")
  ) {
    throw new Error(`metadata update not visible: ${JSON.stringify(updatedItem)}`);
  }

  const newPlain = "<h1>Managed v2</h1>";
  const contentPatch = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "PATCH",
    headers: { ...bearer(manageToken), "content-type": "application/json" },
    body: JSON.stringify({
      content: bytesToBase64(new TextEncoder().encode(newPlain)),
      password_protected: false,
      file_type: "html",
      filename: "managed.html",
    }),
  });
  if (!contentPatch.ok) {
    throw new Error(`content patch failed: ${JSON.stringify(await contentPatch.json())}`);
  }
  const rawAfterUpdate = await fetch(`${BASE}/s/${managed.alias}/raw`);
  const rawAfterBody = await rawAfterUpdate.text();
  if (!rawAfterUpdate.ok || !rawAfterBody.includes(newPlain)) {
    throw new Error("raw content should reflect the update");
  }

  const newSecret = "<h1>Managed secret</h1>";
  const newPassword = "managed-pass-456";
  const reEncrypted = await encrypt(
    new TextEncoder().encode(newSecret),
    newPassword
  );
  const encryptPatch = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "PATCH",
    headers: { ...bearer(manageToken), "content-type": "application/json" },
    body: JSON.stringify({
      content: bytesToBase64(reEncrypted.cipher),
      password_protected: true,
      salt: bytesToBase64(reEncrypted.salt),
      iv: bytesToBase64(reEncrypted.iv),
      file_type: "html",
      filename: "managed.html",
      password_wrap: await wrapPassword(newPassword, manageToken),
    }),
  });
  if (!encryptPatch.ok) {
    throw new Error(`encrypt patch failed: ${JSON.stringify(await encryptPatch.json())}`);
  }
  const rawEncrypted = await fetch(`${BASE}/s/${managed.alias}/raw`);
  if (rawEncrypted.status !== 403) {
    throw new Error(`encrypted share raw should be 403, got ${rawEncrypted.status}`);
  }
  const viewAfterEncrypt = await fetch(`${BASE}/s/${managed.alias}`);
  const viewHtmlAfter = await viewAfterEncrypt.text();
  const viewMatch = viewHtmlAfter.match(
    /<script type="application\/json" id="share-data">([\s\S]*?)<\/script>/
  );
  if (!viewMatch) throw new Error("share-data block missing after encrypt");
  const viewData = JSON.parse(viewMatch[1]);
  if ("password_wrap" in viewData) {
    throw new Error("public view page must not expose password_wrap");
  }
  const decrypted = await decrypt(
    base64ToBytes(viewData.content),
    base64ToBytes(viewData.salt),
    base64ToBytes(viewData.iv),
    newPassword
  );
  if (decrypted !== newSecret) throw new Error("re-encrypted content does not decrypt");

  const noAuthContent = await fetch(`${BASE}/api/share/${managed.alias}/content`);
  if (noAuthContent.status !== 401) {
    throw new Error(`content without token should be 401, got ${noAuthContent.status}`);
  }
  const wrongContent = await fetch(`${BASE}/api/share/${managed.alias}/content`, {
    headers: bearer(otherToken),
  });
  if (wrongContent.status !== 404) {
    throw new Error(`content with wrong token should be 404, got ${wrongContent.status}`);
  }
  const contentResponse = await fetch(`${BASE}/api/share/${managed.alias}/content`, {
    headers: bearer(manageToken),
  });
  const ownerContent = await contentResponse.json();
  if (
    !contentResponse.ok ||
    !ownerContent.ok ||
    !ownerContent.password_protected ||
    !ownerContent.salt ||
    !ownerContent.iv ||
    ownerContent.filename !== "managed.html"
  ) {
    throw new Error(`owner content fetch failed: ${JSON.stringify(ownerContent)}`);
  }
  const ownerPlain = await decrypt(
    base64ToBytes(ownerContent.content),
    base64ToBytes(ownerContent.salt),
    base64ToBytes(ownerContent.iv),
    newPassword
  );
  if (ownerPlain !== newSecret) throw new Error("owner content does not decrypt");

  if (!ownerContent.password_wrap) {
    throw new Error("owner content must include password_wrap");
  }
  const recoveredPassword = await unwrapPassword(
    ownerContent.password_wrap,
    manageToken
  );
  if (recoveredPassword !== newPassword) {
    throw new Error("password_wrap does not unwrap to the access password");
  }
  let wrongTokenUnwrapRejected = false;
  try {
    await unwrapPassword(ownerContent.password_wrap, otherToken);
  } catch {
    wrongTokenUnwrapRejected = true;
  }
  if (!wrongTokenUnwrapRejected) {
    throw new Error("a foreign manage token must not unwrap the password");
  }

  const invalidWrapPatch = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "PATCH",
    headers: { ...bearer(manageToken), "content-type": "application/json" },
    body: JSON.stringify({
      content: ownerContent.content,
      password_protected: true,
      salt: ownerContent.salt,
      iv: ownerContent.iv,
      file_type: ownerContent.file_type,
      filename: ownerContent.filename,
      password_wrap: "not a valid wrap",
    }),
  });
  if (invalidWrapPatch.ok) {
    throw new Error("a malformed password_wrap should be rejected");
  }
  const invalidWrapData = await invalidWrapPatch.json();
  if (invalidWrapData.code !== "password_wrap_invalid") {
    throw new Error(`unexpected wrap rejection: ${JSON.stringify(invalidWrapData)}`);
  }

  const changedPassword = "managed-pass-789";
  const reEncryptedAgain = await encrypt(
    new TextEncoder().encode(ownerPlain),
    changedPassword
  );
  const passwordPatch = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "PATCH",
    headers: { ...bearer(manageToken), "content-type": "application/json" },
    body: JSON.stringify({
      content: bytesToBase64(reEncryptedAgain.cipher),
      password_protected: true,
      salt: bytesToBase64(reEncryptedAgain.salt),
      iv: bytesToBase64(reEncryptedAgain.iv),
      file_type: ownerContent.file_type,
      filename: ownerContent.filename,
      password_wrap: await wrapPassword(changedPassword, manageToken),
    }),
  });
  if (!passwordPatch.ok) {
    throw new Error(`password change patch failed: ${JSON.stringify(await passwordPatch.json())}`);
  }
  const viewAfterPasswordChange = await fetch(`${BASE}/s/${managed.alias}`);
  const htmlAfterPasswordChange = await viewAfterPasswordChange.text();
  const passwordChangeMatch = htmlAfterPasswordChange.match(
    /<script type="application\/json" id="share-data">([\s\S]*?)<\/script>/
  );
  if (!passwordChangeMatch) throw new Error("share-data block missing after password change");
  const passwordChangeData = JSON.parse(passwordChangeMatch[1]);
  const decryptedWithNewPassword = await decrypt(
    base64ToBytes(passwordChangeData.content),
    base64ToBytes(passwordChangeData.salt),
    base64ToBytes(passwordChangeData.iv),
    changedPassword
  );
  if (decryptedWithNewPassword !== ownerPlain) {
    throw new Error("content should decrypt with the new password");
  }
  let oldPasswordRejected = false;
  try {
    await decrypt(
      base64ToBytes(passwordChangeData.content),
      base64ToBytes(passwordChangeData.salt),
      base64ToBytes(passwordChangeData.iv),
      newPassword
    );
  } catch {
    oldPasswordRejected = true;
  }
  if (!oldPasswordRejected) throw new Error("the previous password should stop working");

  const contentAfterChange = await (
    await fetch(`${BASE}/api/share/${managed.alias}/content`, {
      headers: bearer(manageToken),
    })
  ).json();
  if (
    !contentAfterChange.password_wrap ||
    contentAfterChange.password_wrap === ownerContent.password_wrap
  ) {
    throw new Error("password change must store a fresh password_wrap");
  }
  const recoveredChanged = await unwrapPassword(
    contentAfterChange.password_wrap,
    manageToken
  );
  if (recoveredChanged !== changedPassword) {
    throw new Error("the stored password_wrap must match the new password");
  }

  const clearPatch = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "PATCH",
    headers: { ...bearer(manageToken), "content-type": "application/json" },
    body: JSON.stringify({
      content: bytesToBase64(new TextEncoder().encode("<h1>cleared</h1>")),
      password_protected: false,
      file_type: "html",
      filename: "managed.html",
    }),
  });
  if (!clearPatch.ok) {
    throw new Error(`clear password patch failed: ${JSON.stringify(await clearPatch.json())}`);
  }
  const contentAfterClear = await (
    await fetch(`${BASE}/api/share/${managed.alias}/content`, {
      headers: bearer(manageToken),
    })
  ).json();
  if (contentAfterClear.password_protected) {
    throw new Error("share should be unencrypted after clearing the password");
  }
  if ("password_wrap" in contentAfterClear) {
    throw new Error("password_wrap must be dropped together with the password");
  }

  const wrapSharePassword = "wrap-pass-321";
  const wrapEncrypted = await encrypt(
    new TextEncoder().encode("<h1>wrapped</h1>"),
    wrapSharePassword
  );
  const wrapCreate = await fetch(`${BASE}/api/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      alias: "",
      title: "Wrapped Share",
      password_protected: true,
      content: bytesToBase64(wrapEncrypted.cipher),
      salt: bytesToBase64(wrapEncrypted.salt),
      iv: bytesToBase64(wrapEncrypted.iv),
      password_wrap: await wrapPassword(wrapSharePassword, manageToken),
      expires_days: null,
      manage_token: manageToken,
    }),
  });
  const wrapCreated = await wrapCreate.json();
  if (!wrapCreate.ok) {
    throw new Error(`wrapped create failed: ${JSON.stringify(wrapCreated)}`);
  }
  const wrapContentResponse = await fetch(
    `${BASE}/api/share/${wrapCreated.alias}/content`,
    { headers: bearer(manageToken) }
  );
  const wrapContent = await wrapContentResponse.json();
  if (!wrapContentResponse.ok || !wrapContent.password_wrap) {
    throw new Error(`wrapped create content failed: ${JSON.stringify(wrapContent)}`);
  }
  const recoveredCreated = await unwrapPassword(
    wrapContent.password_wrap,
    manageToken
  );
  if (recoveredCreated !== wrapSharePassword) {
    throw new Error("created share must store an unwrappable password_wrap");
  }
  const wrapDelete = await fetch(`${BASE}/api/share/${wrapCreated.alias}`, {
    method: "DELETE",
    headers: bearer(manageToken),
  });
  if (!wrapDelete.ok) throw new Error("wrapped share delete failed");

  const wrongDelete = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "DELETE",
    headers: bearer(otherToken),
  });
  if (wrongDelete.status !== 404) {
    throw new Error(`delete with wrong token should be 404, got ${wrongDelete.status}`);
  }

  const deleteResponse = await fetch(`${BASE}/api/share/${managed.alias}`, {
    method: "DELETE",
    headers: bearer(manageToken),
  });
  if (!deleteResponse.ok) throw new Error("delete failed");
  const viewDeleted = await fetch(`${BASE}/s/${managed.alias}`);
  if (viewDeleted.status !== 404) {
    throw new Error(`deleted share should 404, got ${viewDeleted.status}`);
  }
  const listAfterDelete = await (
    await fetch(`${BASE}/api/my-shares?page_size=50`, { headers: bearer(manageToken) })
  ).json();
  if ((listAfterDelete.items || []).some((item) => item.alias === managed.alias)) {
    throw new Error("deleted share still listed in my-shares");
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
        icsRoundTrip: true,
        icsSniffRejectsInvalid: true,
        fileTypeWhitelistEnforced: true,
        rawIcsEndpoint: true,
        rawForbiddenForEncrypted: true,
        rawPublicBody: true,
        weakTokenRejected: true,
        mySharesRequiresToken: true,
        mySharesScopedToToken: true,
        publicListFlagsOwnedSharesManageable: true,
        publicListManageableScopedToToken: true,
        mySharesMetadataUpdate: true,
        encryptionChangeRequiresFile: true,
        contentUpdateRoundTrip: true,
        reEncryptRoundTrip: true,
        ownerContentEndpoint: true,
        passwordChangeWithoutNewFile: true,
        passwordWrapRecoveredWithToken: true,
        passwordWrapScopedToToken: true,
        passwordWrapRejectedWhenMalformed: true,
        passwordWrapReplacedOnChange: true,
        passwordWrapClearedWithPassword: true,
        passwordWrapCreatedWithShare: true,
        passwordWrapHiddenFromPublicViews: true,
        deleteScopedToToken: true,
        deleteRemovesShare: true,
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

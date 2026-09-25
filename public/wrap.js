(function () {
  const ITERATIONS = 100000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
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

  async function deriveWrapKey(token, salt, usages) {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(token),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      usages
    );
  }

  async function wrap(password, token) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveWrapKey(token, salt, ['encrypt']);
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(password)
    );
    return `v1.${bytesToBase64(salt)}.${bytesToBase64(iv)}.${bytesToBase64(
      new Uint8Array(cipher)
    )}`;
  }

  async function unwrap(bundle, token) {
    if (typeof bundle !== 'string') throw new Error('invalid_wrap');
    const parts = bundle.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('invalid_wrap');
    let salt;
    let iv;
    let cipher;
    try {
      salt = base64ToBytes(parts[1]);
      iv = base64ToBytes(parts[2]);
      cipher = base64ToBytes(parts[3]);
    } catch {
      throw new Error('invalid_wrap');
    }
    if (salt.byteLength < 16 || iv.byteLength !== 12 || cipher.byteLength === 0) {
      throw new Error('invalid_wrap');
    }
    const key = await deriveWrapKey(token, salt, ['decrypt']);
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipher
      );
      return decoder.decode(plain);
    } catch {
      throw new Error('unwrap_failed');
    }
  }

  window.ZenshareWrap = { wrap, unwrap };
})();

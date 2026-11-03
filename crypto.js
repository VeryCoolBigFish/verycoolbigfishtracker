// Passphrase encryption for export files: PBKDF2-SHA256 → AES-256-GCM, all on the device (Web Crypto).
const Crypt = (() => {
  const ITER = 600000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function key(pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  // Returns the envelope object written to a .htrk file. `meta` is stored in clear (no health data).
  async function encrypt(payload, pass, meta, iter = ITER) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pass, salt, iter), enc.encode(JSON.stringify(payload)));
    return { ...meta, kdf: { name: 'PBKDF2-SHA256', iterations: iter, salt: b64(salt) }, cipher: 'AES-256-GCM', iv: b64(iv), ciphertext: b64(ct) };
  }

  async function decrypt(env, pass) {
    if (!env || !env.ciphertext || !env.kdf) throw new Error('This is not a Health Tracker export file.');
    let pt;
    try {
      const k = await key(pass, unb64(env.kdf.salt), env.kdf.iterations);
      pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, k, unb64(env.ciphertext));
    } catch { throw new Error('Wrong passphrase, or the file is damaged.'); }
    return JSON.parse(dec.decode(pt));
  }

  return { encrypt, decrypt, ITER };
})();

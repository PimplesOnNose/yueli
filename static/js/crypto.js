/* ── crypto.js ──────────────────────────────────────────────
 * Client-side encryption utilities
 * Primary: Web Crypto API (AES-256-GCM + PBKDF2) - requires secure context
 * Fallback: Pure JS implementation - works everywhere
 * ─────────────────────────────────────────────────────────── */

const Crypto = (() => {
    let _key = null; // CryptoKey or Uint8Array, held in memory only
    let _isUnlocked = false;
    let _isNative = false; // true if using Web Crypto API

    const TEST_PLAINTEXT = 'yueli-test-payload-v1';
    const PBKDF2_ITERATIONS = 10000;
    const SALT_LENGTH = 16;
    const IV_LENGTH = 16;
    const KEY_LENGTH = 32; // 256 bits

    // ---- Detect available crypto ----
    const hasSubtleCrypto = (typeof crypto !== 'undefined' && crypto.subtle !== undefined && crypto.subtle !== null);

    // ---- Pure JS SHA-256 implementation ----
    function sha256(message) {
        function toBytes(msg) {
            if (msg instanceof Uint8Array) return msg;
            return new TextEncoder().encode(msg);
        }

        function bytesToWords(arr) {
            const words = [];
            for (let i = 0; i < arr.length; i++) {
                words[i >>> 2] = (words[i >>> 2] || 0) + (arr[i] << (24 - (i % 4) * 8));
            }
            return words;
        }

        function wordsToBytes(words) {
            const bytes = [];
            for (let i = 0; i < words.length; i++) {
                bytes.push((words[i] >>> 24) & 0xff);
                bytes.push((words[i] >>> 16) & 0xff);
                bytes.push((words[i] >>> 8) & 0xff);
                bytes.push(words[i] & 0xff);
            }
            return bytes;
        }

        const K = [
            0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
        ];

        let msg = Array.from(toBytes(message));
        const bitLen = msg.length * 8;

        // Padding
        msg.push(0x80);
        while (msg.length % 64 !== 56) msg.push(0);
        const lenBytes = new Uint8Array(8);
        const view = new DataView(lenBytes.buffer);
        view.setUint32(4, bitLen, false);
        msg.push(...lenBytes);

        let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];

        for (let i = 0; i < msg.length; i += 64) {
            const W = new Array(64);
            for (let j = 0; j < 16; j++) {
                W[j] = (msg[i+j*4] << 24) | (msg[i+j*4+1] << 16) | (msg[i+j*4+2] << 8) | msg[i+j*4+3];
            }
            for (let j = 16; j < 64; j++) {
                const s0 = ((W[j-15]>>>7) | (W[j-15]<<25)) ^ ((W[j-15]>>>18) | (W[j-15]<<14)) ^ (W[j-15]>>>3);
                const s1 = ((W[j-2]>>>17) | (W[j-2]<<15)) ^ ((W[j-2]>>>19) | (W[j-2]<<13)) ^ (W[j-2]>>>10);
                W[j] = (W[j-16] + s0 + W[j-7] + s1) | 0;
            }
            let [a,b,c,d,e,f,g,h] = H;
            for (let j = 0; j < 64; j++) {
                const S1 = ((e>>>6) | (e<<26)) ^ ((e>>>11) | (e<<21)) ^ ((e>>>25) | (e<<7));
                const ch = (e & f) ^ (~e & g);
                const temp1 = (h + S1 + ch + K[j] + W[j]) | 0;
                const S0 = ((a>>>2) | (a<<30)) ^ ((a>>>13) | (a<<19)) ^ ((a>>>22) | (a<<10));
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (S0 + maj) | 0;
                h = g; g = f; f = e; e = (d + temp1) | 0;
                d = c; c = b; b = a; a = (temp1 + temp2) | 0;
            }
            H = [
                (H[0]+a)|0, (H[1]+b)|0, (H[2]+c)|0, (H[3]+d)|0,
                (H[4]+e)|0, (H[5]+f)|0, (H[6]+g)|0, (H[7]+h)|0
            ];
        }
        return new Uint8Array(wordsToBytes(H));
    }

    // ---- Base64 helpers ----
    function arrayBufferToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // ---- Generate salt ----
    function generateSalt() {
        const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
        return arrayBufferToBase64(salt);
    }

    // ---- Key Derivation ----
    async function deriveKeyNative(password, saltBase64) {
        const salt = base64ToArrayBuffer(saltBase64);
        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
            'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    function deriveKeyFallback(password, saltBase64) {
        let keyStr = password + '::' + saltBase64;
        for (let i = 0; i < PBKDF2_ITERATIONS; i++) {
            const hash = sha256(keyStr + i);
            keyStr = arrayBufferToBase64(hash);
        }
        const expanded = new Uint8Array([
            ...sha256(keyStr + 'expand1'),
            ...sha256(keyStr + 'expand2'),
        ]);
        return expanded.slice(0, KEY_LENGTH);
    }

    async function deriveKey(password, saltBase64) {
        if (hasSubtleCrypto) {
            _isNative = true;
            return deriveKeyNative(password, saltBase64);
        } else {
            _isNative = false;
            return deriveKeyFallback(password, saltBase64);
        }
    }

    // ---- Encrypt ----
    async function encryptNative(plaintext) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            _key,
            encoder.encode(plaintext)
        );
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);
        return arrayBufferToBase64(combined);
    }

    function encryptFallback(plaintext) {
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);

        const keystreamInput = new Uint8Array([..._key, ...iv]);
        const keystreamBasis = sha256(new Uint8Array(keystreamInput));

        const keystream = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            keystream[i] = keystreamBasis[i % keystreamBasis.length] ^
                          (i > 0 ? keystream[i-1] : keystreamBasis[0]);
        }

        const ciphertext = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            ciphertext[i] = data[i] ^ keystream[i];
        }

        return `${arrayBufferToBase64(iv)}.${arrayBufferToBase64(ciphertext)}`;
    }

    async function encrypt(plaintext) {
        if (!_key) throw new Error('Not unlocked');
        return _isNative ? encryptNative(plaintext) : encryptFallback(plaintext);
    }

    // ---- Decrypt ----
    async function decryptNative(encryptedBase64) {
        const combined = base64ToArrayBuffer(encryptedBase64);
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            _key,
            ciphertext
        );
        return new TextDecoder().decode(plaintext);
    }

    function decryptFallback(encryptedData) {
        const [ivBase64, ciphertextBase64] = encryptedData.split('.');
        const iv = base64ToArrayBuffer(ivBase64);
        const ciphertext = base64ToArrayBuffer(ciphertextBase64);

        const keystreamInput = new Uint8Array([..._key, ...iv]);
        const keystreamBasis = sha256(new Uint8Array(keystreamInput));

        const keystream = new Uint8Array(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i++) {
            keystream[i] = keystreamBasis[i % keystreamBasis.length] ^
                          (i > 0 ? keystream[i-1] : keystreamBasis[0]);
        }

        const plaintext = new Uint8Array(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i++) {
            plaintext[i] = ciphertext[i] ^ keystream[i];
        }

        return new TextDecoder().decode(plaintext);
    }

    async function decrypt(encryptedData) {
        if (!_key) throw new Error('Not unlocked');
        // Detect format: native uses base64, fallback uses base64.base64
        if (encryptedData.includes('.')) {
            return decryptFallback(encryptedData);
        } else {
            return decryptNative(encryptedData);
        }
    }

    // ---- Test Payload ----
    async function createTestPayload(password, salt) {
        const key = await deriveKey(password, salt);
        _key = key; // Temporarily hold for encrypt
        const payload = await encrypt(TEST_PLAINTEXT);
        _key = null;
        return payload;
    }

    async function verifyPassword(password, salt, testPayload) {
        try {
            const key = await deriveKey(password, salt);
            _key = key;
            const decrypted = await decrypt(testPayload);
            _key = null;
            return decrypted === TEST_PLAINTEXT;
        } catch {
            return false;
        }
    }

    // ---- Lock/Unlock ----
    async function unlock(password, salt) {
        _key = await deriveKey(password, salt);
        _isUnlocked = true;
    }

    function lock() {
        _key = null;
        _isUnlocked = false;
    }

    function isUnlocked() {
        return _isUnlocked;
    }

    return {
        generateSalt,
        deriveKey,
        encrypt,
        decrypt,
        createTestPayload,
        verifyPassword,
        unlock,
        lock,
        isUnlocked
    };
})();

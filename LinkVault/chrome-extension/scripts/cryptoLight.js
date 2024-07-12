if (false) {
    const argon2 = require('argon2-browser');
}

const cryptoLight = {
    key: null,
    /** @type {Uint8Array} */
    iv: null,

    clear() {
        this.key = null;
        this.iv = null;
    },
    async init(passwordStr, salt1Base64 = null, iv1Base64 = null) {
        this.clear();

        const startTimestamp = Date.now();

        // iv1 && salt1 are random, saved
        const iv1 = iv1Base64 ? this.base64ToUint8Array(iv1Base64) : this.generateRandomUint8Array();
        const iv1Base64_ = this.uint8ArrayToBase64(iv1);
        
        const salt1 = salt1Base64 ? this.base64ToUint8Array(salt1Base64) : this.generateRandomUint8Array();
        const salt1Base64_ = this.uint8ArrayToBase64(salt1);
        
        // iv2 && salt2 are deterministic, not saved : would need to generate them each time
        const argon2SaltForm_Salt1_Iv1 = this.concatUint8(salt1, iv1);
        const iv2 = await this.generateArgon2DeterministicUint8(passwordStr + "iv2", argon2SaltForm_Salt1_Iv1, 16);
        this.iv = this.concatUint8(iv1, iv2); // should be 32 bytes

        const argon2SaltFrom_Salt1_Iv = this.concatUint8(salt1, this.iv);
        const salt2 = await this.generateArgon2DeterministicUint8(passwordStr + "salt2", argon2SaltFrom_Salt1_Iv, 16);
        const salt = this.concatUint8(salt1, salt2); // should be 32 bytes
        console.log(`exor: ${this.uint8ArrayToBase64(salt)}`)

        console.log(`Salt.length: ${salt.length}, IV.length: ${this.iv.length}`)
        console.log('Argon2 Salt+IV generation took', Date.now() - startTimestamp, 'ms');

        const key = await this.deriveK(passwordStr, salt);
        if (!key) { console.error('Key derivation failed'); return false; } else { this.key = key; }

        const strongEntropyPassStr = passwordStr + this.uint8ArrayToBase64(this.iv) + this.uint8ArrayToBase64(salt);
        const hash = await this.generateArgon2Hash(strongEntropyPassStr);
        
        return { hash, strongEntropyPassStr, salt1Base64: salt1Base64_, iv1Base64: iv1Base64_ };
    },
    async deriveK(str, salt, iterations = 1000000) {
        if (salt === null) { return false; }
        const startTimestamp = Date.now();

        const buffer = new TextEncoder().encode(str);
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            buffer,
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );
    
        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: iterations,
                hash: "SHA-512"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
        
        console.log('Key derivation took', Date.now() - startTimestamp, 'ms');

        return derivedKey;
    },
    uint8ArrayToBase64(uint8Array) {
        // Convert the Uint8Array to a binary string
        const binaryString = String.fromCharCode.apply(null, uint8Array);
        // Encode the string in base64
        return btoa(binaryString);
    },
    base64ToUint8Array(base64) {
        // Decode the base64 string to a binary string
        const binaryString = atob(base64);
        // Convert the binary string to a Uint8Array
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    },
    async encryptText(str, iv = false) {
        if (this.key === null) { console.error('Key not initialized'); return false; }
        if (this.iv === null && !iv) { console.error('IV not initialized'); return false; }

        const buffer = new TextEncoder().encode(str);
        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv ? iv : this.iv },
            this.key,
            buffer
        );

        const encryptedContentBase64 = this.uint8ArrayToBase64(new Uint8Array(encryptedContent));
        return encryptedContentBase64;
    },
    async decryptText(base64, iv = false) {
        if (this.key === null) { console.error('Key not initialized'); return false; }
        if (this.iv === null && !iv) { console.error('IV not initialized'); return false; }
        
        const buffer = this.base64ToUint8Array(base64);
        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv ? iv : this.iv },
            this.key,
            buffer
        );

        const decryptedContentStr = new TextDecoder().decode(new Uint8Array(decryptedContent));
        return decryptedContentStr;
    },
    generateRandomUint8Array(bytesEntropy = 16) {
        const randomUint8Array = new Uint8Array(bytesEntropy);
        window.crypto.getRandomValues(randomUint8Array);
        return randomUint8Array;
    },
    generateRndBase64(bytesEntropy = 32) {
        return this.uint8ArrayToBase64(this.generateRandomUint8Array(bytesEntropy));
    },
    /**
	 * Generate a Uint8Array using password, and a salt.
	 * - Will be called 2 times to generate the salt and the IV
	 * - The memory cost provides better security over Brute Force attacks
	 * @param {string} masterMnemonicStr
	 * @param {string} saltStr
	 * @param {number} length
	 */
	async generateArgon2DeterministicUint8(passwordStr, saltStr = 'toto', length = 16) {
		const time = 2; // The number of iterations
		const mem = 2**14; // The memory cost
		const hashLen = length; // The length of the hash
		const parallelism = 1; // The number of threads
		const type = 2; // The type of the hash (0=Argon2d, 1=Argon2i, 2=Argon2id)

		const result = await argon2.hash({pass: passwordStr, time, mem, hashLen, parallelism, type, salt: saltStr});
		return result.hash;
	},
    /**
     * Generate a simple hash using Argon2
     * @param {string} strongEntropyPassStr
     * @param {number} length
     */
    async generateArgon2Hash(strongEntropyPassStr, length = 32) {
        const time = 2; // The number of iterations
        const mem = 2**8; // The memory cost
        const hashLen = length; // The length of the hash
        const parallelism = 1; // The number of threads
        const type = 2; // The type of the hash (0=Argon2d, 1=Argon2i, 2=Argon2id)
        const salt = window.crypto.getRandomValues(new Uint8Array(32));

        const result = await argon2.hash({pass: strongEntropyPassStr, time, mem, hashLen, parallelism, type, salt});
        return result.encoded;
    },
    async verifyArgon2Hash(passwordStr, hashEncoded) {
        try {
            await argon2.verify({pass: passwordStr, encoded: hashEncoded});
            return true;
        } catch (error) {
            console.error('Argon2 verify res:', error);
        }
        return false;
    },
    concatUint8(salt1, salt2) {
        const result = new Uint8Array(salt1.length + salt2.length);
        result.set(salt1);
        result.set(salt2, salt1.length);
        return result;
    }
}


if (window.location.href.includes('localhost')) {
    module.exports = {
        cryptoLight
    };
}
const cryptoLight = {
    /** @type {Crypto} */
    key: null,
    /** @type {Uint8Array} */
    salt: null,
    /** @type {Uint8Array} */
    iv: null,

    hash: '',

    async init(passwordStr, saltBase64 = null, ivBase64 = null) {
        this.salt = saltBase64 ? this.base64ToUint8Array(saltBase64) : this.generateRandomSalt();
        this.iv = ivBase64 ? this.base64ToUint8Array(ivBase64) : this.generateRandomIV();
        console.log(`Salt.length: ${this.salt.length}, IV.length: ${this.iv.length}`)

        const key = await this.deriveK(passwordStr, 2000000);
        if (!key) { console.error('Key derivation failed'); return false; } else { this.key = key; }


        const buffer = new TextEncoder().encode(passwordStr);
        const hashedBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
        const hashed = this.uint8ArrayToBase64(new Uint8Array(hashedBuffer));
        const hash = await this.encryptText(hashed);

        this.hash = hash;
        const decodedSalt = this.uint8ArrayToBase64(this.salt);
        const decodedIV = this.uint8ArrayToBase64(this.iv);
        //if (decodedSalt !== saltBase64) { console.info('Salt mismatch'); }
        //if (decodedIV !== ivBase64) { console.info('IV mismatch'); }
        
        return { key, hash, salt: this.salt, iv: this.iv, saltBase64: decodedSalt, ivBase64: decodedIV };
    },
    async deriveK(str, iterations = 2000000) {
        if (this.salt === null) { return false; }
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
                salt: this.salt,
                iterations: iterations,
                hash: "SHA-256"
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
    async encryptText(str) {
        if (!this.iv) { return false; }

        const buffer = new TextEncoder().encode(str);
        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: this.iv },
            this.key,
            buffer
        );

        const encryptedContentBase64 = this.uint8ArrayToBase64(new Uint8Array(encryptedContent));
        return encryptedContentBase64;
    },
    async decryptText(base64) {
        if (!this.iv) { return false; }
        
        const buffer = this.base64ToUint8Array(base64);
        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: this.iv },
            this.key,
            buffer
        );

        const decryptedContentStr = new TextDecoder().decode(new Uint8Array(decryptedContent));
        return decryptedContentStr;
    },
    generateRandomSalt() {
        const saltUnit8Array = new Uint8Array(16);
        window.crypto.getRandomValues(saltUnit8Array);
        return saltUnit8Array;
    },
    generateRandomIV() {
        const iv = new Uint8Array(16);
        window.crypto.getRandomValues(iv);
        return iv;
    },
}


if (window.location.href.includes('localhost')) {
    module.exports = {
        cryptoLight
    };
}
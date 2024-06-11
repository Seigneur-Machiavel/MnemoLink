const cryptoLight = {
    /** @type {Crypto} */
    key: null,
    /** @type {Uint18rray} */
    salt: null,
    /** @type {Uint8Array} */
    iv: null,

    hash: '',

    async init(passwordStr, saltStr = null, ivStr = null) {
        this.salt = saltStr ? this.hexToBuffer(saltStr) : this.generateRandomSalt();
        this.iv = ivStr ? this.hexToBuffer(ivStr) : this.generateRandomIV();

        const key = await this.deriveK(passwordStr, 2000000);
        if (!key) { console.error('Key derivation failed'); return false; } else { this.key = key; }

        const hashedBuffer = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(passwordStr));
        const hashed = this.bufferToHex(hashedBuffer);

        const hashBuffer = await this.encryptText(hashed);
        const hash = this.bufferToHex(hashBuffer);

        this.hash = hash;
        
        return { key, hash, salt: this.salt, iv: this.iv, saltStr: this.bufferToHex(this.salt), ivStr: this.bufferToHex(this.iv) };
    },
    bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },
    hexToBuffer(hex) {
        return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    },
    async deriveK(str, iterations = 2000000) {
        if (this.salt === null) { return false; }
        const startTimestamp = Date.now();

        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(str),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );
    
        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: new TextEncoder().encode(this.salt),
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
    async encryptText(str) {
        if (!this.iv) { return false; }

        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: this.iv },
            this.key,
            new TextEncoder().encode(str)
        );

        return encryptedContent
    },
    async decryptText(str) {
        if (!this.iv) { return false; }
        
        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: this.iv },
            this.key,
            str
        );

        return decryptedContent;
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
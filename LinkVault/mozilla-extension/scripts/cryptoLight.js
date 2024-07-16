if (false) {
    const argon2 = require('argon2-browser');
}

const cryptoLight = {
    cryptoStrength: 'heavy',
    PBKDF2Iterations: { heavy: 1000000, medium: 100000, light: 10000 },
    argon2Mem: { heavy: 2**14, medium: 2**11, light: 2**8 },
    key: null,
    /** @type {Uint8Array} */
    iv: null,

    clear() {
        this.key = null;
        this.iv = null;
    },
    async generateKey(passwordStr, salt1Base64 = null, iv1Base64 = null, hashToVerify = null) {
        this.clear();

        let startTimestamp = Date.now();
        const result = {
            salt1Base64: null,
            iv1Base64: null,
            passHash: null,
            strongEntropyPassStr: null,
            encodedHash: null,
            hashVerified: false,
            argon2Time: 0,
            deriveKTime: 0
        };

        // iv1 && salt1 are random, saved
        const iv1 = iv1Base64 ? this.base64ToUint8Array(iv1Base64) : this.generateRandomUint8Array();
        result.iv1Base64 = this.uint8ArrayToBase64(iv1);
        
        const salt1 = salt1Base64 ? this.base64ToUint8Array(salt1Base64) : this.generateRandomUint8Array();
        result.salt1Base64 = this.uint8ArrayToBase64(salt1);
        
        // iv2 && salt2 are deterministic, not saved : would need to generate them each time
        const iv2 = await this.generateArgon2DeterministicUint8(passwordStr + "iv2", this.concatUint8(salt1, iv1), 16);
        this.iv = this.concatUint8(iv1, iv2); // should be 32 bytes

        const salt2 = await this.generateArgon2DeterministicUint8(passwordStr + "salt2", this.concatUint8(salt1, this.iv), 16);
        const salt = this.concatUint8(salt1, salt2); // should be 32 bytes

        result.argon2Time = Date.now() - startTimestamp;
        //console.log(`salt.length: ${salt.length}, IV.length: ${this.iv.length}`);
        //console.log('Argon2 Salt+IV generation took', result.argon2Time, 'ms');

        this.key = await this.deriveK(passwordStr, salt);
        if (!this.key) { console.error('Key derivation failed'); return false; }

        result.deriveKTime = Date.now() - startTimestamp - result.argon2Time;
        //console.log('Key derivation took', result.deriveKTime, 'ms');

        result.strongEntropyPassStr = passwordStr + this.uint8ArrayToBase64(this.iv) + this.uint8ArrayToBase64(salt);

        const generatedArgon2Hash = await this.generateArgon2Hash(result.strongEntropyPassStr, salt, 64);
        result.encodedHash = generatedArgon2Hash.encoded;
        result.hashVerified = result.encodedHash === hashToVerify;

        return result;
    },
    async deriveK(str, salt) {
        if (salt === null) { return false; }
        const startTimestamp = Date.now();
        const iterations = this.PBKDF2Iterations[this.cryptoStrength];

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
        
        //console.log('Key derivation took', Date.now() - startTimestamp, 'ms');

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
        const mem = this.argon2Mem[this.cryptoStrength]; // The memory cost
        //const mem = 2**18; // The memory cost
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
    async generateArgon2Hash(strongEntropyPassStr, salt, length = 64) {
        const time = 2; // The number of iterations
        const mem = this.argon2Mem['light']; // The memory cost
        const hashLen = length; // The length of the hash
        const parallelism = 1; // The number of threads
        const type = 2; // The type of the hash (0=Argon2d, 1=Argon2i, 2=Argon2id)

        const result = await argon2.hash({pass: strongEntropyPassStr, time, mem, hashLen, parallelism, type, salt});

        const splited = result.encoded.split('$');
        // Remove the salt from the hash - contained into last "$" and prelast "$"
        const hash = splited.pop();
        splited.pop();
        return {
            encoded: splited.join('$') + '$' + hash,
            hash: hash
        }
    },
    async verifyArgon2Hash(passwordStr, hashEncoded, saltToInclude = '') { // DEPRECATED
        /** @type {string} */
        let hashEnc = hashEncoded;
        if (saltToInclude) {
            // re-add the salt to the hash
            const splited = hashEnc.split('$');
            const hash = splited.pop();
            splited.push(saltToInclude)
            hashEnc = splited.join('$') + '$' + hash;
        }
        try {
            await argon2.verify({pass: passwordStr, encoded: hashEnc});
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
    },
    // ASYMETRIC CRYPTO
    async generateKeyPair() {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"]
        );
    
        return keyPair;
    },
    async exportPublicKey(key) {
        const exportedKey = await window.crypto.subtle.exportKey(
            "spki",
            key
        );
        return new Uint8Array(exportedKey);
    },
    async publicKeyFromExported(exportedKey) {
        const buffer = new Uint8Array(Object.values(exportedKey));
        const publicKey = await window.crypto.subtle.importKey(
            "spki",
            buffer,
            {
                name: "RSA-OAEP",
                hash: "SHA-256"
            },
            true,
            ["encrypt"]
        );
        return publicKey;
    },
    async encryptData(publicKey, data) {
        const encodedData = new TextEncoder().encode(data);
    
        const encryptedData = await window.crypto.subtle.encrypt(
            {
                name: "RSA-OAEP"
            },
            publicKey,
            encodedData
        );
    
        return encryptedData;
    },
    async decryptData(privateKey, data) {
        const encryptedData = this.base64ToUint8Array(data);

        const decryptedData = await window.crypto.subtle.decrypt(
            {
                name: "RSA-OAEP"
            },
            privateKey,
            encryptedData
        );
    
        const decodedData = new TextDecoder().decode(decryptedData);
        return decodedData;
    }
}

if (window.location.href.includes('localhost')) { module.exports = { cryptoLight} };
if (false) { // CODE NEVER REACHED, SHOWS THE IMPORTS FOR DOCUMENTATION PURPOSES
	const bip39 = require('./bip39 3.1.0.js');
}

const syncScrypt = typeof(exports) !== 'undefined' ? require('./syncScrypt.js') : null;
const BIPTablesHardcoded = {};
const BIPOfficialNamesHardcoded = {};
const versionHardcoded = [];
const base64EncodingChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const PBKDF2Iterations = 200001;
const saltLength = 32; // need to be a multiple of 2
const IVStrLength = 16; // need to be a multiple of 2

/**
 * Class MnemoLinker, used to:
 * - encrypt a mnemonic using a masterMnemonic as a key, resulting in a MnemoLink
 * - decrypt a MnemoLink using the masterMnemonic as a key, resulting in the original mnemonic
 * @param {Object} params - {} - The parameters object
 * @param {string|string[]} params.masterMnemonic - The master mnemonic -> Used for any scenario
 * @param {string|string[]} params.mnemonic - The original mnemonic -> Encryption only
 * @param {Object} params.BIPTables - The BIP tables -> Only used with nodeJS!
 * @param {Object} params.officialBIPs - The official BIPs - > Only used with nodeJS!
 * @param {string} params.version - The version of the table - > Only used with nodeJS!
 */
class MnemoLinker {
	constructor(params = { masterMnemonic: null, mnemonic: null, BIPTables: undefined, officialBIPs: undefined, version: undefined}) {
		this.minMnemonicLength = 12;
		this.cryptoLib = this.#getCryptoLib();
		this.argon2Lib = this.#getArgon2Lib();
		this.officialBIPs = params.officialBIPs ? params.officialBIPs : {}; // Only used when file called as "lastBuildControl.js"
		this.BIPTables = params.BIPTables ? params.BIPTables : BIPTablesHardcoded;
		this.BIPOfficialNames = BIPOfficialNamesHardcoded;
		this.version = params.version ? params.version : versionHardcoded;
		this.initialized = false;
		this.params = params;
		this.prefix = '';
		this.suffix = '';

		this.origin = {
			mnemonic: [],
			bip: '',
			language: '',
			BIPTable: [],
		};
		this.master = {
			mnemonic: [],
			bip: '',
			language: '',
			BIPTable: [],
		}
		this.error = '';
	}

	/**
	 * Initialize the MnemoLinker.
	 * Will be called automatically by the first public method if not already initialized
	 */
	#init() {
		if (!this.cryptoLib) { console.error('Crypto library not found'); return false; }
		if (!this.argon2Lib) { console.error('Argon2 library not found'); return false; }

		if (typeof this.params.masterMnemonic !== 'string' && typeof this.params.masterMnemonic !== 'object') { console.error('masterMnemonic is not a string or an array'); return false; }
		this.master.mnemonic = typeof this.params.masterMnemonic === 'string' ? this.params.masterMnemonic.split(' ') : this.params.masterMnemonic;
		if (this.master.mnemonic.length === 0) { console.error('masterMnemonic is empty'); return false; }
		
		if (this.params.mnemonic) {
			if (typeof this.params.mnemonic !== 'string' && typeof this.params.mnemonic !== 'object') { console.error('mnemonic is not a string or an array'); return false; }
			this.origin.mnemonic = typeof this.params.mnemonic === 'string' ? this.params.mnemonic.split(' ') : this.params.mnemonic;
			if (this.origin.mnemonic.length === 0) { console.error('originMnemonic is empty'); return false; }
		}

		if (!this.#detectMnemonicsLanguage()) { console.error('detectMnemonicsLanguage() failed'); return false; }
		this.initialized = true;
	}
	#isInitialized(initIfNot = true) {
		try {
			if (!this.initialized && initIfNot) { this.#init(); }
			if (this.initialized) { return true; }
		} catch (error) {
			//console.error(error);
		}
		return false;
	}
	#getCryptoLib() {
		const buffer = new Uint32Array(1);
		try {
			window.crypto.getRandomValues(buffer);
			return window.crypto;
		} catch (e) {
		}
		try {
			const crypto = require('crypto');
			crypto.getRandomValues(buffer);
			return crypto;
		} catch (error) {
			console.error('Unable to get the crypto library');
		}
		return false;
	}
	#getArgon2Lib() {
		try {
			argon2.hash({ pass: 'getArgon2Lib', salt: "saltalittlebitlonger" });
			return argon2;
		} catch (error) {
		}
		try {
			const argon2 = require('argon2');
			argon2.hash('getArgon2Lib', { salt: Buffer.from("saltalittlebitlonger") });
			return argon2;
		} catch (error) {
			console.error('Unable to get the argon2 library');
		}
		return false;
	}
	#detectMnemonicsLanguage() {
		// DETECT THE BIP AND LANGUAGE OF THE MNEMONICS
		const originBIPTable = this.getBIPTableFromMnemonic(this.origin.mnemonic);
		if (originBIPTable) {
			this.origin.BIPTable = originBIPTable.wordsTable;
			this.origin.bip = originBIPTable.bip;
			this.origin.language = originBIPTable.language;
		}

		const masterBIPTable = this.getBIPTableFromMnemonic(this.master.mnemonic);
		if (masterBIPTable) {
			this.master.BIPTable = masterBIPTable.wordsTable;
			this.master.bip = masterBIPTable.bip;
			this.master.language = masterBIPTable.language;
		}
		
		return true;
	}

	#getOriginPrefix() {
		if (this.origin.bip === '') { console.error('#getOriginPrefix(): bip is empty'); return false; }
		if (this.origin.language === '') { console.error('#getOriginPrefix(): language is empty'); return false; }

		const bip = this.origin.bip.replace('-', '');
		const language = this.origin.language

		return language + bip;
	}
	#getVersionSuffix() {
		const versionNumber = this.version;
		const n1 = versionNumber[0];
		const n2 = versionNumber[1];
		const encodedN1 = this.encodeNumberToCustomB64(n1);
		const encodedN2 = this.encodeNumberToCustomB64(n2);

		return encodedN1 + encodedN2;
	}
	/**
	 * Encode a number using base64 as numeric basis - 2 chars per number
	 * - The number is divided by 64 and the remainder is used as the second char
	 * - The maximum number is 4095 (63*64+63)
	 * @param {number} number - The number to encode
	 * @returns {string} - The encoded number
	 */
	encodeNumberToCustomB64(number) {
		if (isNaN(number)) { console.error('number is not a number'); return false; }
		if (number > 4095) { console.error('number is too high to be encoded'); return false; }

		const firstChar = base64EncodingChars[Math.floor(number / 64)];
		const secondChar = base64EncodingChars[number % 64];
		return firstChar + secondChar;
	}
	/**
	 * Decode a number using base64 as numeric basis - 2 chars per number
	 * - The first char is multiplied by 64 and the second char is added to it
	 * @param {string} encodedNumber - The encoded number
	 * @returns {number} - The decoded number
	 */
	decodeCustomB64ToNumber(encodedNumber) {
		const firstChar = base64EncodingChars.indexOf(encodedNumber[0]);
		const secondChar = base64EncodingChars.indexOf(encodedNumber[1]);
		return firstChar * 64 + secondChar;
	}
	uint8ArrayToBase64(uint8Array) {
		// Node.js
		if (typeof Buffer !== 'undefined') {
			return Buffer.from(uint8Array).toString('base64');
		}

		// Navigator
        const binaryString = String.fromCharCode.apply(null, uint8Array);
		const base64 = btoa(binaryString);
        return base64;
    }
    base64ToUint8Array(base64) {
		// Node.js
		if (typeof Buffer !== 'undefined') {
			const buffer = Buffer.from(base64, 'base64');
			const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
			return uint8Array;
		}

		// Navigator
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

	/**
	 * Convert mnemonic to base64 normalized seed
	 * - base64 is used as numeric basis to index the words
	 */
	#encodeMnemonic(mnemonicArray, resultLength = 24) {
		if (!this.#isInitialized()) { console.error('MnemoLinker not initialized'); return false; }
		if (mnemonicArray.length < this.minMnemonicLength || mnemonicArray.length > 24) { console.error('mnemonicArray length is out of range'); return false; }

		const BIPTable = this.getBIPTableFromMnemonic(mnemonicArray);
		if (!BIPTable.bip) { console.error('Unable to detect the BIP and language of the mnemonic'); return false; }
		
		const indexTable = [];
		for (let i = 0; i < resultLength; i++) {
			const word = mnemonicArray[i];
			if (word === undefined) { indexTable.push(3965); continue; } // => out of the BIP list
			const wordIndex = BIPTable.wordsTable.indexOf(word);
			if (wordIndex === -1) { console.error(`Word not found in BIPTable: ${word}`); return false; }

			indexTable.push(wordIndex);
		}

		if (indexTable.length !== resultLength) { console.error(`indexTable length is not ${resultLength}`); return false; }

		let encodedMnemonic = '';
		for (let i = 0; i < indexTable.length; i++) {
			const wordIndex = indexTable[i];
			const encodedIndex = this.encodeNumberToCustomB64(wordIndex);
			encodedMnemonic += encodedIndex;
		}

		return encodedMnemonic;
	}
	/**
	 * Convert base64 normalized seed to mnemonic
	 * - base64 is used as numeric basis to index the words
	 */
	#decodeMnemonic(encodedMnemonic, bip = 'BIP-0039', language = 'english') {
		if (!this.#isInitialized()) { console.error('MnemoLinker not initialized'); return false; }
		if (!this.origin.mnemonic)
		if (encodedMnemonic.length !== 48) { console.error('encodedMnemonic length is not 24 or 48'); return false; }

		const indexTable = [];
		for (let i = 0; i < encodedMnemonic.length; i += 2) {
			const encodedNumber = encodedMnemonic.slice(i, i + 2);
			const decodedNumber = this.decodeCustomB64ToNumber(encodedNumber);
			indexTable.push(decodedNumber);
		}

		if (indexTable.length !== 24) { console.error('indexTable length is not 24'); return false; }

		const wordsTable = this.getWordsTable(bip, language);
		if (!wordsTable) { console.error('BIPTable not found'); return false; }

		let mnemonic = [];
		for (let i = 0; i < indexTable.length; i++) {
			const wordIndex = indexTable[i];
			if (wordIndex > 2048) { continue; } // Skip the words that are out of the BIP list

			const word = wordsTable[wordIndex];
			if (!word) { console.error('unable to find the word in the BIP table'); return false; }
			mnemonic.push(word);
		}

		const mnemonicStr = mnemonic.join(' ');
		return mnemonicStr;
	}
	async #deriveK(masterMnemonic, saltUnit8Array, iterations = PBKDF2Iterations) {
		const salt = saltUnit8Array;
		const keyMaterial = await this.cryptoLib.subtle.importKey(
			"raw",
			new TextEncoder().encode(masterMnemonic),
			{ name: "PBKDF2" },
			false,
			["deriveKey"]
		);

		const derivedKey = await this.cryptoLib.subtle.deriveKey(
			{
				name: "PBKDF2",
				salt: new TextEncoder().encode(salt),
				iterations,
				hash: "SHA-256"
			},
			keyMaterial,
			{ name: "AES-GCM", length: 256 },
			false,
			["encrypt", "decrypt"]
		);

		return derivedKey;
	}
	async #encryptText(str, key, iv = new Uint8Array(16)) {
		const buffer = new TextEncoder().encode(str);
		const encryptedContent = await this.cryptoLib.subtle.encrypt(
			{ name: "AES-GCM", iv: iv },
			key,
			buffer
		);

		const encryptedBase64 = this.uint8ArrayToBase64(new Uint8Array(encryptedContent));
		return encryptedBase64
	}
	async #decryptText(base64, key, iv = new Uint8Array(16)) {
		const buffer = this.base64ToUint8Array(base64);
		const decryptedContent = await this.cryptoLib.subtle.decrypt(
			{ name: "AES-GCM", iv: iv },
			key,
			buffer
		);

		const decryptedText = new TextDecoder().decode(new Uint8Array(decryptedContent));
		return decryptedText;
	}
	/**
	 * Generate a salt using the master mnemonic as a password, and the IV as a salt.
	 * - The salt is generated using the Scrypt algorithm
	 * - Memory cost provides better security over Brute Force attacks
	 * @param {string} masterMnemonicStr - The master mnemonic as a string
	 * @param {string} IVStr - The IV as a string
	 * @param {number} length - The desired length of the salt
	 * @returns 
	 */
	#generateScryptSalt(masterMnemonicStr, IVStr = 'toto', length = saltLength) {
		const passwordStr = masterMnemonicStr;
		const saltStr = IVStr;
		const CPUCost = 4;
		const memoryCost = 2**8;
		const parallelism = 1;

		let Uint8Salt = null;
		try {
			Uint8Salt = window.syncScrypt(passwordStr, saltStr, CPUCost, memoryCost, parallelism, length);
		} catch (error) {
			Uint8Salt = syncScrypt(passwordStr, saltStr, CPUCost, memoryCost, parallelism, length);
		}
		return Uint8Salt;
	}
	/**
	 * Generate a salt using the master mnemonic as a password, and the IV as a salt.
	 * - The salt is generated using the Argon2 algorithm
	 * - The memory cost provides better security over Brute Force attacks
	 * @param {string} masterMnemonicStr
	 * @param {string} IVStr
	 * @param {number} length
	 */
	async #generateArgon2Salt(masterMnemonicStr, IVStr = 'toto', length = saltLength) {
		const passwordStr = masterMnemonicStr;
		const saltStr = IVStr;
		const time = 2; // The number of iterations
		const mem = 2**12; // The memory cost
		const hashLen = length; // The length of the hash
		const parallelism = 1; // The number of threads
		const type = 2; // The type of the hash (0=Argon2d, 1=Argon2i, 2=Argon2id)

		if (typeof(exports) !== 'undefined') {
			const result = await this.argon2Lib.hash(
				passwordStr,
				{
					timeCost: time,
					memoryCost: mem,
					hashLength: hashLen,
					parallelism,
					type,
					salt: Buffer.from(saltStr),
					raw: true // Return the hash as a Buffer
				}
			);
			return result;
		} else {
			const result = await this.argon2Lib.hash(
				{
					pass: passwordStr,
					time,
					mem,
					hashLen,
					parallelism,
					type,
					salt: saltStr
				}
			);
			return result.hash;
		}
	}
	#generateIV(length = IVStrLength) {
		const result = { IVUnit8Array: new Uint8Array(length), IVBase64Str: ''}
		for (let i = 0; i < length / 2; i++) {
			// value between 0 and 63 included
			// combined, 64 * 64 = 4096 possibilities -> Correspond to 12 bits of entropy -> custom Base64 encoding
			const value1 = this.cryptoLib.getRandomValues(new Uint8Array(1))[0] % 64;
			const value2 = this.cryptoLib.getRandomValues(new Uint8Array(1))[0] % 64;

			result.IVUnit8Array[i * 2] = value1;
			result.IVUnit8Array[i * 2 + 1] = value2;

			const combinedValue = (value1 << 6) | value2; // Decay the value1 to the left by 6 bits and add the value2
			result.IVBase64Str += this.encodeNumberToCustomB64(combinedValue);
		}

		return result;
	}
	#decodeIV(IVBase64Str) {
		const IVUnit8Array = new Uint8Array(IVStrLength);
		for (let i = 0; i < IVStrLength / 2; i++) {
			const encodedNumber = IVBase64Str.slice(i * 2, i * 2 + 2);
			const decodedNumber = this.decodeCustomB64ToNumber(encodedNumber);

			const value1 = decodedNumber >> 6; // Shift the value to the right by 6 bits
			const value2 = decodedNumber & 63; // Mask the value with 63 (0b00111111)

			IVUnit8Array[i * 2] = value1;
			IVUnit8Array[i * 2 + 1] = value2;
		}

		return IVUnit8Array;
	}
	#getExternalBipLib(bip = 'BIP-0039') {
		// code only used while MnemoLinker builder run this file as "lastBuildControl.js"
		const builderLib = this.officialBIPs[bip];
		if (builderLib) { return builderLib; }

		// trying to get the wordsList from the window object - Require bundle : bip39.js
		try {
			const officialName = this.BIPOfficialNames[bip];
			if (!officialName) { console.error('officialName not found'); return false; }

			const windowLib = window[officialName]
			if (!windowLib) { return false; }

			return windowLib;
		} catch (error) { 
			return false 
		};
	}

	// PUBLIC METHODS
	/**
	 * Generate a public ID from the master mnemonic.
	 * - The public ID is derived from the master mnemonic
	 * - We ensure non sentivity by cuting the ID to the desired length
	 * @param {number} desiredLength - The desired length of the public ID
	 */
	async genPublicId(desiredLength = 32) {
		if (!this.#isInitialized()) { console.error('MnemoLinker not initialized'); return false; }

		const encodedMasterMnemonicBase64Str = this.#encodeMnemonic(this.master.mnemonic, 24);
		if (!encodedMasterMnemonicBase64Str) { console.error('Unable to encode the master mnemonic'); return false; }

		const fixedSalt = new Uint16Array([0, 2, 1, 3]);
		const fixedIV = new Uint8Array([0, 1, 2, 3, 5, 4, 6, 7, 8, 9, 11, 10, 12, 13, 14, 15]);
		const key = await this.#deriveK(encodedMasterMnemonicBase64Str, fixedSalt, PBKDF2Iterations / 16);
		const id = await this.#encryptText(encodedMasterMnemonicBase64Str, key, fixedIV);

		const controlBase64Str = await this.#decryptText(id, key, fixedIV);
		const decodedStr = this.#decodeMnemonic(controlBase64Str, this.origin.bip, this.origin.language);
		if (!this.master.mnemonic.join(' ') === decodedStr) { console.error('Decrypted ID is not valid'); return false; }

		let reducedId = '';
		const acceptedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < id.length; i++) {
			const char = id[i];
			if (acceptedChars.includes(char)) { reducedId += char; }
			if (reducedId.length >= desiredLength) { break; }
		}

		if (reducedId.length !== desiredLength) { console.error('reducedId length is not desiredLength'); return false; }

		return reducedId;
	}
	/**
	 * Encrypt the mnemonic using the master mnemonic as a key.
	 * - The mnemonic is encrypted using AES-GCM
	 * - The IV is generated randomly and saved at the end of the MnemoLink
	 * - The salt is generated using the Scrypt algorithm by deriving the master mnemonic within the IV as a salt
	 * - The MnemoLink is composed of the encrypted mnemonic, the BIP and language as preffix, and the IV and version as suffix
	 */
	async encryptMnemonic() {
		if (!this.#isInitialized()) { console.error('MnemoLinker not initialized'); return false; }
		
		const IV = this.#generateIV();
		//const saltUint8Array = this.#generateScryptSalt(this.master.mnemonic.join(' '), IV.IVBase64Str, saltLength);
		const saltUint8Array = await this.#generateArgon2Salt(this.master.mnemonic.join(' '), IV.IVBase64Str, saltLength);
		const encodedMasterMnemonicBase64Str = this.#encodeMnemonic(this.master.mnemonic, 24);
		const encodedMnemonicBase64Str = this.#encodeMnemonic(this.origin.mnemonic, 24);

		const key = await this.#deriveK(encodedMasterMnemonicBase64Str, saltUint8Array);
		const encryptedMnemonicStr = await this.#encryptText(encodedMnemonicBase64Str, key, IV.IVUnit8Array);
		
		// control validity
		const controlEncodedMnemonicBase64Str = await this.#decryptText(encryptedMnemonicStr, key, IV.IVUnit8Array);
		const decodedMnemonicStr = this.#decodeMnemonic(controlEncodedMnemonicBase64Str, this.origin.bip, this.origin.language);
		if (!this.origin.mnemonic.join(' ') === decodedMnemonicStr) { console.error('Decrypted mnemonic is not valid'); return false; }

		const originPrefix = this.#getOriginPrefix();
		const versionSuffix = this.#getVersionSuffix();

		return originPrefix + encryptedMnemonicStr + IV.IVBase64Str + versionSuffix;
	}
	async decryptMnemoLink(mnemoLink = '') {
		if (!this.#isInitialized()) { console.error('MnemoLinker not initialized'); return false; }
		const timings = { startTimestamp: Date.now() };

		const { encryptedMnemonic, bip, language, version, IVUnit8Array, IVBase64Str } = this.dissectMnemoLink(mnemoLink);
		if (version.join(".") !== this.version.join(".")) { 
			this.error = 'invalid version number';
			console.error(`Invalid MnemoLink version number: ${version.join(".")} | current: ${this.version.join(".")}`);
			return false;
		}
		
		//const saltUint8Array = this.#generateScryptSalt(this.master.mnemonic.join(' '), IVBase64Str, saltLength);
		const saltUint8Array = await this.#generateArgon2Salt(this.master.mnemonic.join(' '), IVBase64Str, saltLength);
		timings.saltsGenerated = Date.now() - timings.startTimestamp;
		timings.checkPoint = Date.now();

		const encodedMasterMnemonicBase64Str = this.#encodeMnemonic(this.master.mnemonic, 24);
		const key = await this.#deriveK(encodedMasterMnemonicBase64Str, saltUint8Array);
		timings.deriveK = Date.now() - timings.checkPoint;
		
		const decryptedMnemonicStr = await this.#decryptText(encryptedMnemonic, key, IVUnit8Array);
		if (!decryptedMnemonicStr) { console.error('decryptedMnemonicStr is empty'); return false; }

		const decodedMnemonic = this.#decodeMnemonic(decryptedMnemonicStr, bip, language);
		if (!decodedMnemonic) { console.error('decodedMnemonic is empty'); return false; }

		timings.total = Date.now() - timings.startTimestamp;
		console.info(`decryptTimings=> total: ${timings.total}ms | salt:${timings.saltsGenerated}ms | dKey: ${timings.deriveK}ms`);

		return decodedMnemonic;
	}
	dissectMnemoLink(mnemoLink = '') {
		// --- Suffix info corresponds to the version of the table, saved on the last 4 characters ---
		const versionSuffix = mnemoLink.slice(-4);
		const versionPart1 = this.decodeCustomB64ToNumber(versionSuffix.slice(0, 2));
		const versionPart2 = this.decodeCustomB64ToNumber(versionSuffix.slice(2, 4));
		const versionNumber = [versionPart1, versionPart2];

		// --- IV info corresponds to X characters before the version suffix ---
		const IVBase64Str = mnemoLink.slice(-(4 + IVStrLength), -4);
		const IVUnit8Array = this.#decodeIV(IVBase64Str);

		// --- Prefix info corresponds to the origin BIPTable ---
		const BipCode = mnemoLink.split('BIP')[1].substring(0, 4);
		const detectedBip = "BIP-" + BipCode;
		const detectedLanguage = mnemoLink.split('BIP')[0];
		const detectionSuccess = this.getWordsTable(detectedBip, detectedLanguage) !== false;

		const prefix = detectedLanguage + "BIP" + BipCode;
		let encryptedMnemonic = detectionSuccess ? mnemoLink.replace(prefix, '') : mnemoLink;
		encryptedMnemonic = encryptedMnemonic.slice(0, encryptedMnemonic.length - 4); // remove the version suffix
		encryptedMnemonic = encryptedMnemonic.slice(0, encryptedMnemonic.length - IVStrLength); // remove the salt suffix

		return { encryptedMnemonic, bip: detectedBip, language: detectedLanguage, version: versionNumber, IVUnit8Array, IVBase64Str };
	}
	getAvailableLanguages(bip = 'BIP-0039') {
		const BIP = this.BIPTables[bip];
		if (!BIP) { console.error('BIP not found'); return false; }
	
		const languages = Object.keys(BIP);
		return languages;
	}
	getSuggestions(partialWord = '', bip = 'BIP-0039', language = 'english') {
		const wordsTable = this.getWordsTable(bip, language);
		if (!wordsTable) { console.error('wordsTable not found'); return false; }
	
		const suggestions = [];
		for (let i = 0; i < wordsTable.length; i++) {
			const word = wordsTable[i];
			if (word.startsWith(partialWord)) { suggestions.push(word); }
		}

		return suggestions;
	}
	removeNonAlphabeticChars(str) {
		return str.replace(/[^a-zA-Z]/g, '');
	}
	getWordsTable(bip = 'BIP-0039', language = 'english') {
		const BIP = this.BIPTables[bip];
		if (!BIP) { console.error('BIP not found'); return false; }

		const wordsTable = BIP[this.removeNonAlphabeticChars(language)];
		if (!wordsTable) { console.error('wordsTable not found'); return false; }

		if (wordsTable.officialLanguageStr === undefined) {
			return wordsTable;
		} else {
			// trying to get the wordsTable (wordsList) from the window object - Require bundle : bip39.js
			const bipLib = this.#getExternalBipLib(bip);
			if (!bipLib) { console.error('bipLib not found'); return false; }

			const wordsLists = bipLib.wordlists;
			if (!wordsLists) { console.error('wordlists not found'); return false; }

			const wordsList = wordsLists[wordsTable.officialLanguageStr];
			if (!wordsList) { console.error('wordsList not found'); return false; }

			return wordsList;
		}
	}
	getBIPTableFromMnemonic(mnemonicArray = []) {
		let bip = '';
		let language = '';
		let wordsTable = [];

		const BIPs = Object.keys(this.BIPTables);
		const currentSearch = { bip: '', language: '', wordsTable: [], foundWords: [], word: ''};
		let bestSearch = { bip: '', language: '', foundWords: [], word: ''};

		for (let i = 0; i < BIPs.length; i++) {
			currentSearch.bip = BIPs[i];
			const languages = Object.keys(this.BIPTables[currentSearch.bip]);

			for (let j = 0; j < languages.length; j++) {
				currentSearch.foundWords = [];
				currentSearch.language = languages[j];
				currentSearch.wordsTable = this.getWordsTable(currentSearch.bip, currentSearch.language);

				for (let k = 0; k < mnemonicArray.length; k++) {
					currentSearch.word = mnemonicArray[k];

					if (!currentSearch.wordsTable.includes(currentSearch.word)) { break; }
					currentSearch.foundWords.push(currentSearch.word);
					if (k < mnemonicArray.length - 1) { continue; }

					if (bip !== '' || language !== '') { console.error('Multiple BIPs and/or languages found for the mnemonic'); return { bestLanguage: bestSearch.language }; }
					bip = currentSearch.bip;
					language = currentSearch.language;
					wordsTable = currentSearch.wordsTable;
				}

				if (bestSearch.foundWords.length < currentSearch.foundWords.length) {
					bestSearch = Object.assign({}, currentSearch);
				}
			}
		}

		if (bip === '' || language === '') { return { bestLanguage: bestSearch.language }; }

		return { bip, language, wordsTable, bestLanguage: bestSearch.language };
	}
}

/* CODE RELEASED ONLY WHEN EXPORTED --- DONT USE "//" or "/*" COMMENTS IN THIS SECTION !!! ---
*/

//END --- ANY CODE AFTER THIS LINE WILL BE REMOVED DURING EXPORT, SHOULD BE USE FOR TESTING ONLY ---
if (typeof(exports) !== 'undefined') { module.exports = MnemoLinker }
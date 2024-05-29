const BIPTablesHardcoded = {};
const versionHardcoded = [];
const base64EncodingChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Class Translator
 * - Used to translate a mnemonic to a pseudo mnemonic and vice versa
 * @param {Object} BIPTables - The BIP tables
 * @param {Object} params - The parameters of the translator
 * @param {string|string[]} params.mnemonic - The original mnemonic
 * @param {string|string[]} params.pseudoMnemonic - The pseudo mnemonic
 * @param {string} params.pBIP - The pseudo BIP
 */
class Translator {
	constructor(params = { mnemonic: null, pseudoMnemonic: null, pBIP: null, BIPTables: null, version: null}) {
		this.authorizedMnemonicLengths = [12, 24];
		this.BIPTables = BIPTablesHardcoded;
		this.version = versionHardcoded;
		this.initialized = false;
		this.params = params;
		this.prefix = '';
		this.suffix = '';
		this.pBIP = '';
		this.indexTable = [];

		this.origin = {
			mnemonic: [],
			bip: '',
			language: '',
			BIPTable: [],
		};
		this.pseudo = {
			mnemonic: [],
			bip: '',
			language: '',
			BIPTable: [],
			pseudoBIP: [],
		}
		this.error = '';
	}

	#init() {
		if (this.params.BIPTables) { this.BIPTables = this.params.BIPTables; }
		if (this.params.version) { this.version = this.params.version; }

		if (typeof this.params.pseudoMnemonic !== 'string' && typeof this.params.pseudoMnemonic !== 'object') { console.error('pseudoMnemonic is not a string or an array'); return false; }
		this.pseudo.mnemonic = typeof this.params.pseudoMnemonic === 'string' ? this.params.pseudoMnemonic.split(' ') : this.params.pseudoMnemonic;
		if (this.#mnemonicContainsDuplicates(this.pseudo.mnemonic)) { console.error('pseudoMnemonic contains duplicates'); this.error = 'invalid pseudoMnemonic'; return false; }
		
		if (this.params.mnemonic && this.pseudo.mnemonic.length > 0) {
			if (typeof this.params.mnemonic !== 'string' && typeof this.params.mnemonic !== 'object') { console.error('mnemonic is not a string or an array'); return false; }
			
			this.origin.mnemonic = typeof this.params.mnemonic === 'string' ? this.params.mnemonic.split(' ') : this.params.mnemonic;
			if (this.#mnemonicContainsDuplicates(this.origin.mnemonic)) { console.error('mnemonic contains duplicates'); this.error = 'invalid mnemonic'; return false; }

			if (!this.#detectMnemonicsLanguage()) { console.error('detectMnemonicsLanguage() failed'); return false; }

			if (!this.#genPseudoBipTable()) { console.error('#genPseudoBipTable() failed'); return false; }
			this.initialized = true;
		} else if (this.params.pBIP && this.pseudo.mnemonic.length > 0) {
			if (!typeof this.params.pBIP === 'string') { console.error('pBIP is not a string'); return false; }
			if (!this.#detectMnemonicsLanguage()) { console.error('detectMnemonicsLanguage() failed'); return false; }
			
			this.pBIP = this.params.pBIP;

			if (!this.#decodeTable()) { console.info('#decodeTable() failed'); return false; }
			this.initialized = true;
		}

		return false;
	}
	#isInitialized() {
		try {
			if (!this.initialized) { this.#init(); }
			if (this.initialized) { return true; }
		} catch (error) {
			//console.error(error);
		}
		return false;
	}
	#mnemonicContainsDuplicates(mnemonic = []) {
		const controlArray = [];
		for (let i = 0; i < mnemonic.length; i++) {
			const word = mnemonic[i];
			if (controlArray.includes(word)) { return true; }
			controlArray.push(word);
		}
		return false;
	}
	#detectMnemonicsLanguage() {
		//if (!this.authorizedMnemonicLengths.includes(mnemonic.length) || !this.authorizedMnemonicLengths.includes(pseudoMnemonic.length)) { console.error('mnemonic or pseudoMnemonic length is not 12 or 24'); return false; }

		const authorizedLengths = this.authorizedMnemonicLengths;
		const mnemonic = this.origin.mnemonic;
		const pseudoMnemonic = this.pseudo.mnemonic;

		// DETECT THE BIP AND LANGUAGE OF THE MNEMONICS
		if (authorizedLengths.includes(mnemonic.length)) {
			const originBIPTable = this.#getBIPTableFromMnemonic(mnemonic);
			if (!originBIPTable) { console.error('Unable to detect the BIP and language of the mnemonic'); return false; }
			// SET THE ORIGIN BIP TABLES
			this.origin.BIPTable = originBIPTable.wordsTable;
			this.origin.bip = originBIPTable.bip;
			this.origin.language = originBIPTable.language;
		}

		if (authorizedLengths.includes(pseudoMnemonic.length)) {
			const pseudoBIPTable = this.#getBIPTableFromMnemonic(pseudoMnemonic);
			if (!pseudoBIPTable) { console.error('Unable to detect the BIP and language of the pseudoMnemonic'); return false; }
			// SET THE PSEUDO BIP TABLES
			this.pseudo.BIPTable = pseudoBIPTable.wordsTable;
			this.pseudo.bip = pseudoBIPTable.bip;
			this.pseudo.language = pseudoBIPTable.language;
		}
		
		return true;
	}
	/**
	 * Generate pseudo BIP table from mnemonic and pseudoMnemonic
	 * - Language of Mnemonic and pseudoMnemonic should be detected automatically
	 * - Size of Mnemonic and pseudoMnemonic can be 12 or 24 words
	 * - PseudoMnemonic cannot be longer than the original Mnemonic
	 * @param {string|string[]} mnemonic - The original mnemonic
	*/
	#genPseudoBipTable() {
		const mnemonic = this.origin.mnemonic;
		const pseudoMnemonic = this.pseudo.mnemonic;
		if (pseudoMnemonic.length > mnemonic.length) { console.error('pseudoMnemonic is longer than mnemonic'); return false; }
		
		const doubleWordMode = mnemonic.length === pseudoMnemonic.length * 2; // if true, use 2 words for each pseudo word
		const pseudoBIP = [];
		const freeOriginWords = this.origin.BIPTable.slice();

		// REMOVE THE USED WORDS FROM THE FREE ORIGIN WORDS LIST
		// IF doubleWordMode, remove only 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22 indexes -> First of 2 words
		// Made to avoid using the same word twice (as first word) of pseudoBIP
		for (let i = 0; i < mnemonic.length; i++) {
			const index = !doubleWordMode ? i : i * 2;
			const word = mnemonic[index];
			const pseudoIndex = freeOriginWords.indexOf(word);
			if (pseudoIndex === -1) { continue; }
			freeOriginWords.splice(pseudoIndex, 1);
		}
		
		// GENERATE THE PSEUDO BIP
		for (let i = 0; i < this.pseudo.BIPTable.length; i++) {
			const pseudoWord = this.pseudo.BIPTable[i];
			const refIndex = pseudoMnemonic.indexOf(pseudoWord);
			const isInPseudoMnemonic = refIndex !== -1;
			let pseudo = []; // should contain 1 or 2 words depending on the doubleWordMode

			if (isInPseudoMnemonic) {
				const pseudoIndex = !doubleWordMode ? refIndex : refIndex * 2;
				if (mnemonic[pseudoIndex] === undefined) { console.error('mnemonic[pseudoIndex] is undefined'); return false; }

				pseudo.push(mnemonic[pseudoIndex]);
				if (doubleWordMode) { pseudo.push(mnemonic[pseudoIndex + 1]); }

			} else {
				if (freeOriginWords.length === 0) { console.error('No more free pseudo words available'); return false; }
				const randomUnusedIndex = this.#getRandomInt(0, freeOriginWords.length - 1);
				const removedWord = freeOriginWords.splice(randomUnusedIndex, 1)[0];
				if (removedWord === undefined) { console.error('removedWord is undefined'); return false; }
				pseudo.push(removedWord);

				if (doubleWordMode) {
					const randomIndex = this.#getRandomInt(0, this.origin.BIPTable.length - 1);
					const word2 = this.origin.BIPTable[randomIndex];
					if (word2 === undefined) { console.error('word2 is undefined'); return false; }
					pseudo.push(word2);
				}
			}
			
			for (let j = 0; j < pseudo.length; j++) {
				if (pseudo[j] === undefined) { console.error('pseudo contain undefined'); return false; }
			}
			pseudoBIP.push(pseudo);
		}

		this.pseudo.pseudoBIP = pseudoBIP;

		return true;
	}

	#shuffleArrayUsingPseudoMnemonic(array, reverse = false) {
		const wordsTable = this.pseudo.BIPTable;
		if (array.length !== wordsTable.length) { console.error('array length is not equal to wordsTable length'); return false; }

		const indexArray = this.#createIndexArray(wordsTable.length);
		/*
		const numbers = this.#numbersFromMnemonic(this.pseudo.mnemonic, wordsTable);
		if (!numbers) { console.error('numbersFromMnemonic() failed'); return false; }
		const hashValue = this.#hashFromNumbers(numbers);
		*/
		const hashValue = this.#hashFromMnemonic(this.pseudo.mnemonic);

		this.#shuffleArray(indexArray, hashValue);
		if (reverse) { this.#transmuteArray(indexArray); }

		const resultArray = [];

		for (let i = 0; i < indexArray.length; i++) {
			const index = indexArray[i];
			const val = array[index];
			resultArray.push(val);
		}

		return resultArray;
	}
	#createIndexArray(length = 2048) {
		let indices = [];
		for (let i = 0; i < length; i++) {
			indices.push(i);
		}
		return indices;
	}
	#shuffleArray(indices, hashValue) {
		for (let i = indices.length - 1; i > 0; i--) {
			hashValue = (hashValue * 9301 + 49297) % 233280;
			const j = Math.floor(hashValue / 233280 * (i + 1));
			[indices[i], indices[j]] = [indices[j], indices[i]];
		}
	}
	#transmuteArray(array) {
		const transmutedArray = {};
		for (let i = 0; i < array.length; i++) {
			const val = array[i];
			transmutedArray[val] = i;
		}

		for (let i = 0; i < array.length; i++) {
			array[i] = transmutedArray[i];
		}
	}
	/**
	 * Get the hash from a mnemonic
	 * @param {string|string[]} mnemonic - The mnemonic to hash
	 * @returns {number} - The hash
	 */
	#hashFromMnemonic(mnemonic) {
		const str = typeof mnemonic === 'string' ? mnemonic : mnemonic.join(' ');

		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return Math.abs(hash);
	}

	#setOriginWordsTable(wordsTable = []) {
		this.origin.wordsTable = wordsTable;
	}
	#setPseudoLanguageAndBIP(language = '', bip = '') {
		this.pseudo.bip = bip;
		this.pseudo.language = language;
	}

	#getPseudoPrefix() {
		if (this.pseudo.bip === '') { console.error('#getPseudoPrefix(): bip is empty'); return false; }
		if (this.pseudo.language === '') { console.error('#getPseudoPrefix(): language is empty'); return false; }

		const bip = this.pseudo.bip.replace('-', '');
		const language = this.pseudo.language

		return language + bip;
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
		const encodedN1 = this.#encode(n1);
		const encodedN2 = this.#encode(n2);

		return encodedN1 + encodedN2;
	}
	/**
	 * Get the encoded pseudo BIP (pBIP)
	 * @param {boolean} withPrefix - If true, the prefix will be added to the encoded pseudo BIP
	 * @returns {string} - The encoded pseudo BIP
	 */
	getEncodedPseudoBIP(withPrefix = true) {
		if (this.pBIP === '') { this.#encodeTable(); }
		if (this.pBIP === '') { console.error('pBIP is empty'); return false; }

		const str = withPrefix ? this.#getOriginPrefix() + this.pBIP : this.pBIP
		const suffix = this.#getVersionSuffix();

		return str + suffix;
	}
	/**
	 * Convert the BIP Table to a base64 string
	 * - base64 is used as numeric basis to index the words, reducing the size of the table
	 * - will clear the indexTable and pBIP
	 */
	#encodeTable() {
		if (!this.#isInitialized()) { console.error('Translator not initialized'); return false; }
		if (this.pseudo.pseudoBIP.length === 0) { console.error('pseudoBIP to encode is empty'); return false; }
		if (this.pseudo.BIPTable.length === 0) { console.error('(pseudo)BIPTable to encode is empty'); return false; }
		if (!this.#isRandomTable()) { console.error('randomTable need to be a randomTable'); return false; }

		let indexTable = [];
		for (let i = 0; i < this.pseudo.pseudoBIP.length; i++) {
			const words = this.pseudo.pseudoBIP[i];
			const indexes = [];
			for (let j = 0; j < words.length; j++) {
				const word = words[j];
				const wordIndex = this.origin.BIPTable.indexOf(word);
				if (wordIndex === -1) { console.error(`Word not found in (pseudo)BIPTable: ${word}`); return false; }

				indexes.push(wordIndex);
			}
			indexTable.push(indexes);
		}

		if (indexTable.length !== 2048) {
			console.error('indexTable length is not 2048'); return false; }

		indexTable = this.#shuffleArrayUsingPseudoMnemonic(indexTable, false);
		if (!indexTable) { console.error('shuffleArrayUsingPseudoMnemonic() failed'); return false; }
		this.indexTable = indexTable;

		let encodedPseudoTable = '';
		for (let i = 0; i < indexTable.length; i++) {
			const indexes = indexTable[i];
			for (let j = 0; j < indexes.length; j++) {
				const wordIndex = indexes[j];
				const encodedIndex = this.#encode(wordIndex);
				encodedPseudoTable += encodedIndex;
			}
		}

		if (encodedPseudoTable.length !== 4096 && encodedPseudoTable.length !== 4096 * 2) {
			console.error('encodedPseudoTable length is not 4096 or 4096 * 2'); return false; }
		this.pBIP = encodedPseudoTable;
		return encodedPseudoTable;
	}
	/**
	 * Encode a number using base64 as numeric basis - 2 chars per number
	 * - The number is divided by 64 and the remainder is used as the second char
	 * - The maximum number is 4095 (63*64+63)
	 * @param {number} number - The number to encode
	 * @returns {string} - The encoded number
	 */
	#encode(number) {
		if (isNaN(number)) { console.error('number is not a number'); return false; }
		if (number > 4095) { console.error('number is too high to be encoded'); return false; }

		const firstChar = base64EncodingChars[Math.floor(number / 64)];
		const secondChar = base64EncodingChars[number % 64];
		return firstChar + secondChar;
	}
	#getRandomInt(min, max) {
		if (min === max) { return min; }

		// Create a buffer of one Uint32
		const buffer = new Uint32Array(1);
	
		// Fill the buffer with a secure random number - manage himself browser compatibility
		try {
			window.crypto.getRandomValues(buffer);
		} catch (e) {
			crypto.getRandomValues(buffer);
		}
	
		// Calculate a range of numbers
		const range = max - min + 1;
		
		// Reduce the random number to the desired range [min, max]
		const randomNumberInRange = min + (buffer[0] % range);
		
		return randomNumberInRange;
	}
	#isRandomTable() {
		for (let i = 0; i < this.pseudo.pseudoBIP.length; i++) {
			const pseudoWord = this.pseudo.pseudoBIP[i];
			const controlWord = this.origin.BIPTable[i];
			if (pseudoWord !== controlWord) { return true; }
		}

		return false;
	}
	
	/**
	 * Convert the base64 encoded string to :
	 * - this.indexTable
	 * - this.wordsTable (if possible)
	 */
	#decodeTable() {
		if (this.pBIP === '') { console.error('pBIP is empty'); return false; }

		// --- Suffix info corresponds to the version of the table, saved on the last 4 characters ---
		const versionSuffix = this.pBIP.slice(-4);
		const versionPart1 = this.#decode(versionSuffix.slice(0, 2));
		const versionPart2 = this.#decode(versionSuffix.slice(2, 4));
		const versionNumber = [versionPart1, versionPart2];
		if (versionNumber.join() !== this.version.join()) { 
			this.error = 'invalid version number';
			console.error('version number is invalid');
			return false;
		}

		// --- Prefix info corresponds to the origin BIPTable ---
		const BipCode = this.pBIP.split('BIP')[1].substring(0, 4);
		const detectedBip = "BIP-" + BipCode;
		const detectedLanguage = this.pBIP.split('BIP')[0];
		const detectionSuccess = !(this.BIPTables[detectedBip] === undefined && this.BIPTables[detectedBip][detectedLanguage] === undefined);
		if (detectionSuccess) {
			// console.info(`language detected: ${detectedLanguage} | ${detectedBip}`);
			this.origin.language = detectedLanguage;
			this.origin.bip = detectedBip;
			this.origin.BIPTable = this.BIPTables[detectedBip][detectedLanguage];
		}

		// DECODING THE TABLE
		let indexTable = [];
		const prefix = detectedLanguage + "BIP" + BipCode;
		let encoded = detectionSuccess ? this.pBIP.replace(prefix, '') : this.pBIP;
		encoded = encoded.slice(0, encoded.length - 4); // remove the version suffix
		if (encoded.length !== 4096 && encoded.length !== 4096 * 2) { console.error('pBIP length is not 4096 or 4096 * 2'); return false; }
		const doubleWordMode = encoded.length === 4096 * 2;

		for (let i = 0; i < encoded.length; i += 2) {
			const indexes = [];
			const encodedNumber = encoded.slice(i, i + 2);
			const decodedNumber = this.#decode(encodedNumber);
			indexes.push(decodedNumber);

			if (doubleWordMode) {
				i += 2;
				const encodedNumber2 = encoded.slice(i, i + 2);
				const decodedNumber2 = this.#decode(encodedNumber2);
				indexes.push(decodedNumber2);
			}

			indexTable.push(indexes);
		}

		indexTable = this.#shuffleArrayUsingPseudoMnemonic(indexTable, true);
		if (!indexTable) { console.error('shuffleArrayUsingPseudoMnemonic() failed'); return false; }
		this.indexTable = indexTable;

		return true;
	}
	/**
	 * Decode a number using base64 as numeric basis - 2 chars per number
	 * - The first char is multiplied by 64 and the second char is added to it
	 * @param {string} encodedNumber - The encoded number
	 * @returns {number} - The decoded number
	 */
	#decode(encodedNumber) {
		const firstChar = base64EncodingChars.indexOf(encodedNumber[0]);
		const secondChar = base64EncodingChars.indexOf(encodedNumber[1]);
		return firstChar * 64 + secondChar;
	}
	/**
	 * Convert the IndexTable to a readable list of words
	 * @param {string} bip - The BIP of the table (default: this.bip)
	 * @param {string} language - The language of the table (default: this.language)
	 * @returns {string[]} - The readable list of words
	 */
	#indexTabletoWords() {
		if (this.indexTable.length === 0) { console.error('indexTable is empty'); return false; }

		const wordsTable = [];

		for (let i = 0; i < this.indexTable.length; i++) {
			const indexes = this.indexTable[i];
			const words = [];
			for (let j = 0; j < indexes.length; j++) {
				const index = indexes[j];
				const word = this.origin.BIPTable[index];
				if (!word) { console.error('unable to find the word in the BIP table'); return false; }
				words.push(word);
			}
			wordsTable.push(words);
		}

		this.pseudo.pseudoBIP = wordsTable;

		if (wordsTable.length !== 2048 && wordsTable.length !== 4096) { console.error('wordsTable length is not 2048 or 4096'); return false }

		return true;
	}

	/**
	 * Translate a pseudo mnemonic to a mnemonic
	 * @param {string} outputType - The output type: 'string' (default) or 'array'
	 * @returns {string|string[]} - The translated mnemonic
	 * @returns {boolean} - False if an error occured
	 */
	translateMnemonic(outputType = 'string' || 'array') {
		if (!this.#isInitialized()) { console.error('Translator not initialized'); return false; }
		if (this.origin.BIPTable.length === 0) { console.error("originBIPTable is empty -> Language isn't setup"); return false; }
		
		const pseudoMnemonic = this.pseudo.mnemonic;
		const pseudoBIPTable = this.#getBIPTableFromMnemonic(pseudoMnemonic);
		if (!pseudoBIPTable) { console.error('Unable to detect the BIP and language of the pseudoMnemonic'); return false; }

		this.pseudo.BIPTable = pseudoBIPTable.wordsTable;
		this.pseudo.bip = pseudoBIPTable.bip;
		this.pseudo.language = pseudoBIPTable.language;

		const indexTabletoWordsSuccess = this.#indexTabletoWords();
		if (!indexTabletoWordsSuccess) { console.error('indexTabletoWords() failed'); return false; }

		const tempArray = [];
		for (let i = 0; i < pseudoMnemonic.length; i++) {
			const word = pseudoMnemonic[i];
			const correspondingWords = this.#translateWord(word);
			if (!correspondingWords) { console.error('unable to find the corresponding word in the BIP table'); return false; }

			for (let j = 0; j < correspondingWords.length; j++) {
				const correspondingWord = correspondingWords[j];
				tempArray.push(correspondingWord);
			}
		}

		const translatedMnemonic = outputType === 'array' ? tempArray : tempArray.join(' ');
		return translatedMnemonic;
	}
	/**
	 * Get the corresponding word from the origin BIP table
	 * @param {string} word - The word to translate
	 * @returns {string} - The translated word
	 */
	#translateWord(word) {
		if (!this.#isInitialized()) { console.error('Translator not initialized'); return false; }
		if (this.origin.BIPTable.length === 0) { console.error("originBIPTable is empty -> Language isn't setup"); return false; }
		if (!typeof word === 'string') { console.error('word is not a string'); return false; }

		const index = this.pseudo.BIPTable.indexOf(word);
		if (index === -1) { console.error('word not found in wordsTable'); return false; }

		const correspondingWord = this.pseudo.pseudoBIP[index];
		if (!correspondingWord) { console.error('unable to find the corresponding word in the BIP table'); return false; }

		return correspondingWord;
	}
	/**
	 * Find the BIP, language and wordsTable corresponding to the mnemonic
	 * @param {string[]} mnemonic - The mnemonic to get the words list from
	 */
	#getBIPTableFromMnemonic(mnemonic = []) {
		let bip = '';
		let language = '';

		const BIPs = Object.keys(this.BIPTables);
		const currentSearch = { bip: '', language: '', foundWords: [], word: ''};
		let bestSearch = { bip: '', language: '', foundWords: [], word: ''};

		for (let i = 0; i < BIPs.length; i++) {
			currentSearch.bip = BIPs[i];
			const languages = Object.keys(this.BIPTables[currentSearch.bip]);

			for (let j = 0; j < languages.length; j++) {
				currentSearch.foundWords = [];
				currentSearch.language = languages[j];
				const wordsTable = this.BIPTables[currentSearch.bip][currentSearch.language];

				for (let k = 0; k < mnemonic.length; k++) {
					currentSearch.word = mnemonic[k];

					if (!wordsTable.includes(currentSearch.word)) { break; }
					currentSearch.foundWords.push(currentSearch.word);
					if (k < mnemonic.length - 1) { continue; }

					if (bip !== '' || language !== '') { console.error('Multiple BIPs and/or languages found for the mnemonic'); return false; }
					bip = currentSearch.bip;
					language = currentSearch.language;
				}

				if (bestSearch.foundWords.length < currentSearch.foundWords.length) {
					bestSearch = Object.assign({}, currentSearch);
				}
			}
		}

		if (bip === '' || language === '') { console.error(`BIP and/or language not found for the mnemonic ! Best result -> ${bestSearch.bip} | ${bestSearch.language} | words found: ${bestSearch.foundWords.length} | missing word: ${bestSearch.word}`);  return false; }

		/** @type {string[]} */
		const resultWordsTable = this.BIPTables[bip][language];
		return { bip, language, wordsTable: resultWordsTable };
	}
	getAvailableLanguages(bip = 'BIP-0039') {
		const BIP = this.BIPTables[bip];
		if (!BIP) { console.error('BIP not found'); return false; }
	
		const languages = Object.keys(BIP);
		return languages;
	}
	getSuggestions(partialWord = '', bip = 'BIP-0039', language = 'english') {
		const BIP = this.BIPTables[bip];
		if (!BIP) { console.error('BIP not found'); return false; }
		const wordsTable = BIP[language];
		if (!wordsTable) { console.error('wordsTable not found'); return false; }
	
		const suggestions = [];
		for (let i = 0; i < wordsTable.length; i++) {
			const word = wordsTable[i];
			if (word.startsWith(partialWord)) { suggestions.push(word); }
		}

		return suggestions;
	}
}


/* CODE RELEASED ONLY WHEN EXPORTED --- DONT USE "//" or "/*" COMMENTS IN THIS SECTION !!! ---
*/

//END --- ANY CODE AFTER THIS LINE WILL BE REMOVED DURING EXPORT, SHOULD BE USE FOR TESTING ONLY ---
module.exports = Translator;
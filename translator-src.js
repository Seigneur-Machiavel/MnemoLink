const BIPTablesHardcoded = {};
const base64EncodingChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Class Translator
 * - Used to translate a mnemonic to a pseudo mnemonic and vice versa
 * @param {Object} BIPTables - The BIP tables
 * @param {Object} params - The parameters of the translator
 * @param {string[]} params.mnemonic - The original mnemonic
 */
class Translator {
	constructor(params = { mnemonic: null, pseudoMnemonic: null, encodedTable: null }) {
		this.BIPTables = BIPTablesHardcoded;
		this.initialized = false;
		this.params = params;
		this.prefix = '';
		this.encodedTable = '';
		this.indexTable = [];

		this.origin = {
			bip: '',
			language: '',
			BIPTable: [],
		};
		this.pseudo = {
			bip: '',
			language: '',
			BIPTable: [],
			pseudoBIP: [],
		}
		this.error = '';
	}

	init() {
		if (this.params.mnemonic && this.params.pseudoMnemonic) {
			if (typeof this.params.mnemonic !== 'string' && typeof this.params.mnemonic !== 'object') { console.error('mnemonic is not a string or an array'); return false; }
			if (typeof this.params.pseudoMnemonic !== 'string' && typeof this.params.pseudoMnemonic !== 'object') { console.error('pseudoMnemonic is not a string or an array'); return false; }
			const mnemonic = typeof this.params.mnemonic === 'string' ? this.params.mnemonic.split(' ') : this.params.mnemonic;
			const pseudoMnemonic = typeof this.params.pseudoMnemonic === 'string' ? this.params.pseudoMnemonic.split(' ') : this.params.pseudoMnemonic;
			
			if (this.#mnemonicContainsDuplicates(mnemonic)) { console.error('mnemonic contains duplicates'); this.error = 'invalid mnemonic'; return false; }
			if (this.#mnemonicContainsDuplicates(pseudoMnemonic)) { console.error('pseudoMnemonic contains duplicates'); this.error = 'invalid pseudoMnemonic'; return false; }

			if (!this.genPseudoBipTable(mnemonic, pseudoMnemonic, true)) { console.error('genPseudoBipTable() failed'); return false; }
			this.initialized = true;
		} else if (typeof this.params.encodedTable === 'string') {
			this.encodedTable = this.params.encodedTable;

			if (!this.decodeTable()) { console.info('decodeTable() failed'); return false; }

			this.initialized = true;
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

	/**
	 * Generate pseudo BIP table from mnemonic and pseudoMnemonic
	 * - Language of Mnemonic and pseudoMnemonic should be detected automatically
	 * - Size of Mnemonic and pseudoMnemonic can be 12 or 24 words
	 * - PseudoMnemonic cannot be longer than the original Mnemonic
	 * @param {string|string[]} mnemonic - The original mnemonic
	 * @param {string|string[]} pseudoMnemonic - The pseudo mnemonic
	*/
	genPseudoBipTable(mnemonic, pseudoMnemonic) {
		// CONTROL THE LENGTH OF THE MNEMONIC AND PSEUDOMNEMONIC
		if (mnemonic.length < 12 || mnemonic.length > 24 || pseudoMnemonic.length < 12 || pseudoMnemonic.length > 24) { return false; }
		if (pseudoMnemonic.length > mnemonic.length) { console.error('pseudoMnemonic is longer than mnemonic'); return false; }

		// DETECT THE BIP AND LANGUAGE OF THE MNEMONICS
		const originBIPTable = this.#getBIPTableFromMnemonic(mnemonic);
		const pseudoBIPTable = this.#getBIPTableFromMnemonic(pseudoMnemonic);
		if (!originBIPTable || !pseudoBIPTable) { console.error('Unable to detect the BIP and language of the mnemonic'); return false; }
		
		const doubleWordMode = mnemonic.length === pseudoMnemonic.length * 2; // if true, use 2 words for each pseudo word
		const pseudoBIP = [];
		const freeOriginWords = originBIPTable.wordsTable.slice();

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

		const freeOriginWordsCountControl = freeOriginWords.length;
		
		// GENERATE THE PSEUDO BIP
		for (let i = 0; i < pseudoBIPTable.wordsTable.length; i++) {
			const pseudoWord = pseudoBIPTable.wordsTable[i];
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
					const randomIndex = this.#getRandomInt(0, originBIPTable.wordsTable.length - 1);
					const word2 = originBIPTable.wordsTable[randomIndex];
					if (word2 === undefined) { console.error('word2 is undefined'); return false; }
					pseudo.push(word2);
				}
			}
			
			for (let j = 0; j < pseudo.length; j++) {
				if (pseudo[j] === undefined) { console.error('pseudo contain undefined'); return false; }
			}
			pseudoBIP.push(pseudo);
		}

		// SET THE ORIGIN AND PSEUDO BIP TABLES
		this.origin.BIPTable = originBIPTable.wordsTable;
		this.origin.bip = originBIPTable.bip;
		this.origin.language = originBIPTable.language;

		this.pseudo.BIPTable = pseudoBIPTable.wordsTable;
		this.pseudo.pseudoBIP = pseudoBIP;
		this.pseudo.bip = pseudoBIPTable.bip;
		this.pseudo.language = pseudoBIPTable.language;

		return true;
	}

	setOriginWordsTable(wordsTable = []) {
		this.origin.wordsTable = wordsTable;
	}
	setPseudoLanguageAndBIP(language = '', bip = '') {
		this.pseudo.bip = bip;
		this.pseudo.language = language;
	}

	getPseudoPrefix() {
		if (this.pseudo.bip === '') { console.error('getPseudoPrefix(): bip is empty'); return false; }
		if (this.pseudo.language === '') { console.error('getPseudoPrefix(): language is empty'); return false; }

		const bip = this.pseudo.bip.replace('-', '');
		const language = this.pseudo.language

		return language + bip;
	}
	getOriginPrefix() {
		if (this.origin.bip === '') { console.error('getOriginPrefix(): bip is empty'); return false; }
		if (this.origin.language === '') { console.error('getOriginPrefix(): language is empty'); return false; }

		const bip = this.origin.bip.replace('-', '');
		const language = this.origin.language

		return language + bip;
	}
	getEncodedTable(withPrefix = true) {
		if (this.encodedTable === '') { this.encodeTable(); }
		if (this.encodedTable === '') { console.error('encodedTable is empty'); return false; }

		return withPrefix ? this.getOriginPrefix() + this.encodedTable : this.encodedTable;
	}

	/**
	 * Convert the BIP Table to a base64 string
	 * - base64 is used as numeric basis to index the words, reducing the size of the table
	 * - will clear the indexTable and encodedTable
	 */
	encodeTable() {
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
		this.encodedTable = encodedPseudoTable;
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
	 * @param {string} bipStr - The BIP of the table (default: null) - if null, will try to detect it from prefix
	 * @param {string} languageStr - The language of the table (default: null) - if null, will try to detect it from prefix
	 * @returns {string} - The result of the decoding: 'indexTable' or 'FullyDecoded'
	 */
	decodeTable() {
		if (this.encodedTable === '') { console.error('encodedTable is empty'); return false; }

		// --- Prefix info corresponds to the origin BIPTable ---
		const BipCode = this.encodedTable.split('BIP')[1].substring(0, 4);
		const detectedBip = "BIP-" + BipCode;
		const detectedLanguage = this.encodedTable.split('BIP')[0];
		const detectionSuccess = !(this.BIPTables[detectedBip] === undefined && this.BIPTables[detectedBip][detectedLanguage] === undefined);
		if (detectionSuccess) {
			console.info(`language detected: ${detectedLanguage} | ${detectedBip}`);
			this.origin.language = detectedLanguage;
			this.origin.bip = detectedBip;
			this.origin.BIPTable = this.BIPTables[detectedBip][detectedLanguage];
		}

		// DECODING THE TABLE
		const indexTable = [];
		const prefix = detectedLanguage + "BIP" + BipCode;
		const encoded = detectionSuccess ? this.encodedTable.replace(prefix, '') : this.encodedTable;
		if (encoded.length !== 4096 && encoded.length !== 4096 * 2) { console.error('encodedTable length is not 4096 or 4096 * 2'); return false; }
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
	 * @param {string|string[]} pseudoMnemonic - The pseudo mnemonic to translate
	 * @param {string} outputType - The output type: 'string' (default) or 'array'
	 * @returns {string[]} - The translated mnemonic
	 * @returns {boolean} - False if an error occured
	 */
	translateMnemonic(pseudoMnemonic, outputType = 'string' || 'array') {
		if (!this.#isInitialized()) { console.error('Translator not initialized'); return false; }
		if (this.origin.BIPTable.length === 0) { console.error("originBIPTable is empty -> Language isn't setup"); return false; }
		if (!typeof pseudoMnemonic === 'string' && !typeof pseudoMnemonic === 'object') { console.error('pseudoMnemonic is not a string or an array'); return false; }
		
		const formatedPseudoMnemonic = typeof pseudoMnemonic === 'string' ? pseudoMnemonic.split(' ') : pseudoMnemonic;
		const pseudoBIPTable = this.#getBIPTableFromMnemonic(formatedPseudoMnemonic);
		if (!pseudoBIPTable) { console.error('Unable to detect the BIP and language of the pseudoMnemonic'); return false; }

		this.pseudo.BIPTable = pseudoBIPTable.wordsTable;
		this.pseudo.bip = pseudoBIPTable.bip;
		this.pseudo.language = pseudoBIPTable.language;

		const indexTabletoWordsSuccess = this.#indexTabletoWords();
		if (!indexTabletoWordsSuccess) { console.error('indexTabletoWords() failed'); return false; }

		const tempArray = [];
		for (let i = 0; i < formatedPseudoMnemonic.length; i++) {
			const word = formatedPseudoMnemonic[i];
			const correspondingWords = this.translateWord(word);
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
	translateWord(word) {
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

	#isInitialized() {
		//try {
			if (!this.initialized) { this.init(); }
			if (this.initialized) { return true; }
		//} catch (error) {
			//console.error(error);
		//}
		return false;
	}
}


/* CODE RELEASED ONLY WHEN EXPORTED --- DONT USE "//" or "/*" COMMENTS IN THIS SECTION !!! ---
*/

//END --- ANY CODE AFTER THIS LINE WILL BE REMOVED DURING EXPORT, SHOULD BE USE FOR TESTING ONLY ---
module.exports = Translator;
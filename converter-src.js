const BIPTablesHardcoded = {};
const base64EncodingChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

class converter {
    constructor() {
		this.BIPTables = BIPTablesHardcoded;
    }

	getWord(bip, language, index) {
		return this.BIPTables[bip][language][index];
	}

	getWordIndex(bip, language, word) {
		return this.BIPTables[bip][language].indexOf(word);
	}


}

/**
 * Class Translator
 * - Used to translate a mnemonic to a pseudo mnemonic and vice versa
 * @param {Object} BIPTables - The BIP tables
 * @param {Object} params - The parameters of the translator
 * @param {string[]} params.mnemonic - The original mnemonic
 */
class Translator {
	//constructor(BIPTables, bip = '', language = '', wordsTable = [''], indexTable = []) { to remove
	constructor(params = { mnemonic: null, pseudoMnemonic: null, encodedTable: null }) {
		this.initialized = false;
		this.params = params;
		this.BIPTables = BIPTablesHardcoded;
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
			randomTable: [],
		}
	}

	init() {
		if (this.params.mnemonic && this.params.pseudoMnemonic) {
			if (typeof this.params.mnemonic !== 'string' && typeof this.params.mnemonic !== 'object') { console.error('mnemonic is not a string or an array'); return false; }
			if (typeof this.params.pseudoMnemonic !== 'string' && typeof this.params.pseudoMnemonic !== 'object') { console.error('pseudoMnemonic is not a string or an array'); return false; }
			const mnemonic = typeof this.params.mnemonic === 'string' ? this.params.mnemonic.split(' ') : this.params.mnemonic;
			const pseudoMnemonic = typeof this.params.pseudoMnemonic === 'string' ? this.params.pseudoMnemonic.split(' ') : this.params.pseudoMnemonic;
			
			this.genPseudoBipTable(mnemonic, pseudoMnemonic, true);
			this.initialized = true;
		} else if (typeof this.params.encodedTable === 'string') {
			this.encodedTable = this.params.encodedTable;

			if (!this.decodeTable()) { console.info('decodeTable() failed'); return false; }

			this.initialized = true;
		}

		return false;
	}

	/**
	 * Generate pseudo mnemonic
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
		const originBIPTable = this.getBIPTableFromMnemonic(mnemonic);
		const pseudoBIPTable = this.getBIPTableFromMnemonic(pseudoMnemonic);
		if (!originBIPTable || !pseudoBIPTable) { console.error('Unable to detect the BIP and language of the mnemonic'); return false; }
		
		const doubleWordMode = mnemonic.length !== pseudoMnemonic.length;
		const pseudoBIP = [];
		const freePseudoWords = pseudoBIPTable.wordsTable.slice();

		// REMOVE THE USED PSEUDO WORDS FROM THE FREE PSEUDO WORDS LIST
		for (let i = 0; i < pseudoMnemonic.length; i++) {
			const word = pseudoMnemonic[i];
			const pseudoIndex = freePseudoWords.indexOf(word);
			if (pseudoIndex === -1) { continue; }
			freePseudoWords.splice(pseudoIndex, 1);
		}
		
		// GENERATE THE PSEUDO BIP
		for (let i = 0; i < originBIPTable.wordsTable.length; i++) {
			if (freePseudoWords.length === 0) { 
				console.error('No more free pseudo words available'); return false; }
			const word = originBIPTable.wordsTable[i];
			const index = mnemonic.indexOf(word);
			const isInMnemonic = index !== -1;
			let pseudo = []; // should contain 1 or 2 words depending on the doubleWordMode

			if (isInMnemonic) {
				const pseudoIndex = !doubleWordMode ? index : index * 2;
				pseudo.push(pseudoMnemonic[pseudoIndex]);
				if (doubleWordMode) { pseudo.push(pseudoMnemonic[pseudoIndex + 1]); }

			} else {
				const randomUnusedIndex = getRandomInt(0, freePseudoWords.length - 1);
				const removedWord = freePseudoWords.splice(randomUnusedIndex, 1)[0];
				pseudo.push(removedWord);

				if (doubleWordMode) {
					const randomUnusedIndex2 = getRandomInt(0, freePseudoWords.length - 1);
					const removedWord2 = freePseudoWords.splice(randomUnusedIndex2, 1)[0];
					pseudo.push(removedWord2);
				}
			}
			
			const pseudoStr = pseudo.join(' ');
			pseudoBIP.push(pseudoStr);
		}

		// SET THE ORIGIN AND PSEUDO BIP TABLES
		this.origin.BIPTable = originBIPTable.wordsTable;
		this.origin.bip = originBIPTable.bip;
		this.origin.language = originBIPTable.language;

		this.pseudo.BIPTable = pseudoBIPTable.wordsTable;
		this.pseudo.randomTable = pseudoBIP;
		this.pseudo.bip = pseudoBIPTable.bip;
		this.pseudo.language = pseudoBIPTable.language;


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

		//if (withPrefix && this.prefix === '') { console.error('prefix is empty'); return false; } to remove

		return withPrefix ? this.getOriginPrefix() + this.encodedTable : this.encodedTable;
	}

	/**
	 * Convert the BIP Table to a base64 string
	 * - base64 is used as numeric basis to index the words, reducing the size of the table
	 * - will clear the indexTable and encodedTable
	 */
	encodeTable() {
		if (!this.#isInitialized()) { console.error('Translator not initialized'); return false; }
		if (this.pseudo.randomTable.length === 0) { console.error('randomTable to encode is empty'); return false; }
		if (this.pseudo.BIPTable.length === 0) { console.error('(pseudo)BIPTable to encode is empty'); return false; }
		if (!this.#isRandomTable()) { console.error('randomTable need to be a randomTable'); return false; }
		
		let indexTable = [];
		for (let i = 0; i < this.pseudo.randomTable.length; i++) {
			const word = this.pseudo.randomTable[i];
			const wordIndex = this.pseudo.BIPTable.indexOf(word);
			if (wordIndex === -1) { console.error(`Word not found in (pseudo)BIPTable: ${word}`); return false; }

			indexTable.push(wordIndex);
		}

		let encodedPseudoTable = '';
		for (let i = 0; i < indexTable.length; i++) {
			const wordIndex = indexTable[i];
			const encodedIndex = this.#encode(wordIndex);
			encodedPseudoTable += encodedIndex;
		}

		this.encodedTable = encodedPseudoTable;
		this.indexTable = indexTable;
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
	#isRandomTable() {
		for (let i = 0; i < this.pseudo.BIPTable.length; i++) {
			const word = this.pseudo.BIPTable[i];
			const controlWord = this.pseudo.randomTable[i];
			if (word !== controlWord) { return true; }
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
		const detectedBip = "BIP-" + this.encodedTable.split('BIP')[1].slice(0, 4);
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
		const encoded = detectionSuccess ? this.encodedTable.split('BIP')[1].slice(4) : this.encodedTable;

		for (let i = 0; i < encoded.length; i += 2) {
			const encodedNumber = encoded.slice(i, i + 2);
			const decodedNumber = this.#decode(encodedNumber);
			indexTable.push(decodedNumber);
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
	indexTabletoWords() {
		if (this.indexTable.length === 0) { console.error('indexTable is empty'); return false; }

		const wordsTable = [];

		for (let i = 0; i < this.indexTable.length; i++) {
			const index = this.indexTable[i];
			const word = this.pseudo.BIPTable[index];
			if (!word) { console.error('unable to find the word in the BIP table'); return false; }
			wordsTable.push(word);
		}

		this.pseudo.randomTable = wordsTable;

		return true;
	}

	/**
	 * Translate a pseudo mnemonic to a mnemonic
	 * @param {string|string[]} pseudoMnemonic - The pseudo mnemonic to translate
	 * @returns {string[]} - The translated mnemonic
	 * @returns {boolean} - False if an error occured
	 */
	translate(pseudoMnemonic) {
		if (!this.#isInitialized()) { console.error('Translator not initialized'); return false; }
		if (this.origin.BIPTable.length === 0) { console.error("originBIPTable is empty -> Language isn't setup"); return false; }
		if (!typeof pseudoMnemonic === 'string' && !typeof pseudoMnemonic === 'object') { console.error('pseudoMnemonic is not a string or an array'); return false; }
		
		const formatedPseudoMnemonic = typeof pseudoMnemonic === 'string' ? pseudoMnemonic.split(' ') : pseudoMnemonic;
		const pseudoBIPTable = this.getBIPTableFromMnemonic(formatedPseudoMnemonic);
		if (!pseudoBIPTable) { console.error('Unable to detect the BIP and language of the pseudoMnemonic'); return false; }

		this.pseudo.BIPTable = pseudoBIPTable.wordsTable;
		this.pseudo.bip = pseudoBIPTable.bip;
		this.pseudo.language = pseudoBIPTable.language;

		const indexTabletoWordsSuccess = this.indexTabletoWords();
		if (!indexTabletoWordsSuccess) { console.error('indexTabletoWords() failed'); return false; }

		const translatedMnemonic = [];
		for (let i = 0; i < pseudoMnemonic.length; i++) {
			const word = pseudoMnemonic[i];
			const correspondingWord = this.getCorrespondingWordFromOriginBIP(word);
			if (!correspondingWord) { console.error('unable to find the corresponding word in the BIP table'); return false; }

			translatedMnemonic.push(correspondingWord);
		}

		return translatedMnemonic;
	}
	getCorrespondingWordFromOriginBIP(word) {
		if (!this.#isInitialized()) { console.error('Translator not initialized'); return false; }

		const index = this.pseudo.randomTable.indexOf(word);
		if (index === -1) { console.error('word not found in wordsTable'); return false; }

		const correspondingWord = this.origin.BIPTable[this.indexTable[index]];
		if (!correspondingWord) { console.error('unable to find the corresponding word in the BIP table'); return false; }

		return correspondingWord;
	}

	/**
	 * Find the BIP, language and wordsTable corresponding to the mnemonic
	 * @param {string[]} mnemonic - The mnemonic to get the words list from
	 */
	getBIPTableFromMnemonic(mnemonic = []) {
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

function getRandomInt(min, max) {
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

/* CODE RELEASED ONLY WHEN EXPORTED --- DONT USE "//" or "/*" COMMENTS IN THIS SECTION !!! ---
*/

//END --- ANY CODE AFTER THIS LINE WILL BE REMOVED DURING EXPORT, SHOULD BE USE FOR TESTING ONLY ---
module.exports = {
	converter,
	Translator,
}
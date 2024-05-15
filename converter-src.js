const hardcodedWordsLists = {};

class converter {
    constructor() {
		this.base64EncodingChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		this.wordslists = hardcodedWordsLists;
    }
	
    getListOfBIPs() {
		return Object.keys(this.wordslists);
	}

	getListOfLanguages(bip) {
		return Object.keys(this.wordslists[bip]);
	}

	getWord(bip, language, index) {
		return this.wordslists[bip][language][index];
	}

	getWordIndex(bip, language, word) {
		return this.wordslists[bip][language].indexOf(word);
	}

	/**
	 * Find the BIP, language and wordlist corresponding to the mnemonic
	 * @param {string[]} mnemonic - The mnemonic to get the words list from
	 */
	getWordsListFromMnemonic(mnemonic = []) {
		let bip = '';
		let language = '';

		const BIPs = this.getListOfBIPs();
		const currentSearch = { bip: '', language: '', foundWords: [], word: ''};
		let bestSearch = { bip: '', language: '', foundWords: [], word: ''};

		for (let i = 0; i < BIPs.length; i++) {
			currentSearch.bip = BIPs[i];
			const languages = this.getListOfLanguages(currentSearch.bip);

			for (let j = 0; j < languages.length; j++) {
				currentSearch.foundWords = [];
				currentSearch.language = languages[j];
				const wordsList = this.wordslists[currentSearch.bip][currentSearch.language];

				for (let k = 0; k < mnemonic.length; k++) {
					currentSearch.word = mnemonic[k];

					if (!wordsList.includes(currentSearch.word)) { break; }
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
		const resultWordsList = this.wordslists[bip][language];
		if (resultWordsList === undefined) { return false; }

		return { bip, language, wordsList: resultWordsList };
	}

	/**
	 * Generate pseudo mnemonic
	 * - Language of Mnemonic and pseudoMnemonic should be detected automatically
	 * - Size of Mnemonic and pseudoMnemonic can be 12 or 24 words
	 * - PseudoMnemonic cannot be longer than the original Mnemonic
	 * @param {string[]} mnemonic - The original mnemonic
	 * @param {string[]} pseudoMnemonic - The pseudo mnemonic
	*/
	genPseudoBipTable(mnemonic, pseudoMnemonic) {
		// CONTROL THE LENGTH OF THE MNEMONIC AND PSEUDOMNEMONIC
		if (mnemonic.length < 12 || mnemonic.length > 24 || pseudoMnemonic.length < 12 || pseudoMnemonic.length > 24) { return false; }
		if (pseudoMnemonic.length > mnemonic.length) { return false; }

		// DETECT THE BIP AND LANGUAGE OF THE MNEMONICS
		const originDetected = this.getWordsListFromMnemonic(mnemonic);
		const pseudoDetected = this.getWordsListFromMnemonic(pseudoMnemonic);
		if (!originDetected || !pseudoDetected) { return false; }
		
		const doubleWordMode = mnemonic.length !== pseudoMnemonic.length;
		const originWordsList = originDetected.wordsList;
		const pseudoWordsList = pseudoDetected.wordsList;
		const pseudoBIP = [];
		const freePseudoWords = pseudoWordsList.slice();

		// REMOVE THE USED PSEUDO WORDS FROM THE FREE PSEUDO WORDS LIST
		for (let i = 0; i < pseudoMnemonic.length; i++) {
			const word = pseudoMnemonic[i];
			const pseudoIndex = freePseudoWords.indexOf(word);
			if (pseudoIndex === -1) { continue; }
			freePseudoWords.splice(pseudoIndex, 1);
		}
		
		// GENERATE THE PSEUDO BIP
		for (let i = 0; i < originWordsList.length; i++) {
			if (freePseudoWords.length === 0) { 
				console.error('No more free pseudo words available'); return false; }
			const word = originWordsList[i];
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

		return {
			origin: {
				bip: originDetected.bip,
				language: originDetected.language,
				wordsList: originWordsList
			},
			pseudo: {
				bip: pseudoDetected.bip,
				language: pseudoDetected.language,
				wordsList: pseudoBIP
			},
		};
	}

	/**
	 * Convert a BIP Table to a base64 string
	 * - base64 is used as numeric basis to index the words, reducing the size of the table
	 * @param {BIPTableObject} table - should be the pseudo BIP Table
	 */
	encodeTable(table) {
		const bip = table.bip;
		const language = table.language;
		const rawTable = this.wordslists[bip][language];

		const encodedPseudoTable = '';
		for (let i = 0; i < originTable.wordsList.length; i++) {
			const wordIndex = rawTable.indexOf(table.wordsList[i]);
			if (wordIndex === -1) { console.error(`Word not found in the raw table: ${table.wordsList[i]}`); return false; }

			const encodedIndex = this.#encode(wordIndex);
		}
	}
	/**
	 * Encode a number using base64 as numeric basis - 2 chars per number
	 * - The number is divided by 64 and the remainder is used as the second char
	 * - The maximum number is 4095 (63*64+63)
	 * @param {number} number - The number to encode
	 * @returns {string} - The encoded number
	 */
	#encode(number) {
		const firstChar = this.base64EncodingChars[Math.floor(number / 64)];
		const secondChar = this.base64EncodingChars[number % 64];
		return firstChar + secondChar;
	}

	/**
	 * Convert a base64 string to a BIP Table
	 * @param {string} encodedTable - The encoded table
	 * @returns {BIPTableObject} - The decoded table
	 */
	decodeTable(encodedTable, bip, language) {
		const indexList = [];

		for (let i = 0; i < encodedTable.length; i += 2) {
			const encodedNumber = encodedTable.slice(i, i + 2);
			const decodedNumber = this.#decode(encodedNumber);
			indexList.push(decodedNumber);
		}

		const sample = wordsList.splice(0, 24);
		const detected = getWordsListFromMnemonic(sample);
		if (!detected) { console.error('bip and language not found while decoding table'); return false; }

		return new BIPTableObject(bip, language, wordsList);
	}
	/**
	 * Decode a number using base64 as numeric basis - 2 chars per number
	 * - The first char is multiplied by 64 and the second char is added to it
	 * @param {string} encodedNumber - The encoded number
	 * @returns {number} - The decoded number
	 */
	#decode(encodedNumber) {
		const firstChar = this.base64EncodingChars.indexOf(encodedNumber[0]);
		const secondChar = this.base64EncodingChars.indexOf(encodedNumber[1]);
		return firstChar * 64 + secondChar;
	}
}

class BIPTableObject {
	constructor(bip = '', language = '', wordsList = ['']) {
		this.bip = bip;
		this.language = language;
		this.wordsList = wordsList;
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
module.exports = converter;
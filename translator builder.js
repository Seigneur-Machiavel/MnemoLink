const fs = require('fs');
const path = require('path');
const Translator = require('./translator-src.js');

const BIPTables = {};
const settings = loadSettings();
if (!settings) { console.error('Settings could not be loaded'); return; }
let lastUpdateProgress = -1;

// SOLO TEST -> Used for coding only
/*
const mnemonic12en = "abandon able industry connect town stay such ribbon return cabbage bus spy";
const mnemonic12fr = "abaisser abandon abdiquer abeille abolir aborder aboutir aboyer abrasif abreuver abriter abroger";
const mnemonic24en = "abandon able industry connect town stay such ribbon return cabbage bus spy glue goat goddess gold good goose gorilla gospel gossip govern gown grab";
const pseudoMnemonic12fr = "abaisser abandon abdiquer abeille abolir aborder aboutir aboyer abrasif abreuver abriter abroger";
const mnemonic_ = ["odtud","ortel","rozum","puberta","pacient","glejt","rubrika","jindy","hejkal","nesoulad","lehkost","procento","romaneto","cirkus","bankomat","losos","manko","oproti","omladina","znamenat","mazurka","diplom","tehdy","azyl"]
const pseudoMnemonic_ = ["舍","刀","享","制","央","厘","只","悲","棒","菜","燕","漆"]
const singleTestResult = singleTest(mnemonic_, pseudoMnemonic_);
return true;
*/

// MULTI TEST -> Used to control the validity of the translator before exporting it
const testResult = testLoop(settings.testIterations || 100, 'random', 'random', [12, 24], false);
if (testResult.success === testResult.iterations) {
	console.log('All tests passed successfully, exporting translator...'); 
	exportTranslator();
	console.log('Translator exported successfully');
} else {
	console.error('Some tests failed:');
	testResult.failureInfos.forEach((info) => {
		console.log(JSON.stringify(info));
	});
}

function testLoop(iterations = 100, language = "random", pseudoLanguage = "random", mnemonicLengths = [12, 24], logs = true) {
	lastUpdateProgress = -1;
	let success = 0;
	let failure = 0;
	const failureInfos = [];
	for (let i = 0; i < iterations; i++) {
		const mnemonicLength = mnemonicLengths[ getRandomInt(0, mnemonicLengths.length - 1) ];
		const gen1 = generateMnemonic(mnemonicLength, 'BIP-0039', language);
		const gen2 = generateMnemonic(12, 'BIP-0039', pseudoLanguage);
		const mnemonic = gen1.wordsList;
		const pseudoMnemonic = gen2.wordsList;
		
		const result = singleTest(mnemonic, pseudoMnemonic, logs);
		if (result === true) { success++; } else { 
			failureInfos.push({
				reason: result,
				mnemonic: gen1,
				pseudoMnemonic: gen2
			});
			failure++;
		}

		updateProgressBar(i + 1, iterations);
	}
	console.log(`\n\nSuccess: ${success} / Failure: ${failure}`);

	return { success, failure, iterations, failureInfos };
}
function updateProgressBar(current, total) {
    const length = 50;
    const percentage = (current / total);
    const progress = Math.floor(length * percentage);
	if (progress === lastUpdateProgress) { return; }
	lastUpdateProgress = progress;
    const empty = length - progress;
    
    const progressBar = `[${'='.repeat(progress)}${' '.repeat(empty)}] ${Math.floor(percentage * 100)}%`;

    console.log(progressBar);
}
/**
 * 
 * @param {string|string[]} mnemonic
 * @param {string|string[]} pseudoMnemonic
 * @returns {boolean}
 */
function singleTest(mnemonic, pseudoMnemonic, logs = true) {
	if (!mnemonic || !pseudoMnemonic) { console.error('mnemonic or pseudoMnemonic is undefined'); return "mnemonic or pseudoMnemonic is undefined"; }
	const mnemonicStr = Array.isArray(mnemonic) ? mnemonic.join(' ') : mnemonic;
	if (logs) { console.log(`\nTesting with mnemonic: ${mnemonicStr}\n`) };

	const translatorA = new Translator( {mnemonic, pseudoMnemonic} );
	translatorA.BIPTables = BIPTables; // NOT NECESSARY WHEN EXPORTED TRANSLATOR
	const encodedTable = translatorA.getEncodedTable(true);
	if (!encodedTable) { console.error('getEncodedTable() failed !'); return translatorA.error; }

	if (logs) { console.log(encodedTable) };

	const translatorB = new Translator( {encodedTable, pseudoMnemonic} );
	translatorB.BIPTables = BIPTables; // NOT NECESSARY WHEN EXPORTED TRANSLATOR
	const decodedMnemonic = translatorB.translateMnemonic('string'); // output: 'array' or 'string'

	if (logs) { console.log(`Decoded mnemonic: ${decodedMnemonic}`) };

	// Check if the decoded mnemonic is the same as the original one
	if (mnemonicStr !== decodedMnemonic) { console.error('Decoded mnemonic is different from the original one !'); return "Decoded mnemonic is different from the original one !"; }

	return true;
}
function generateMnemonic(length = 12, bip = "BIP-0039", language = "random") {
	if (!BIPTables[bip]) { console.error(`BIP ${bip} not found`); return false; }

	const BIPLanguages = Object.keys(BIPTables[bip]);
	if (BIPLanguages.length === 0) { console.error(`No languages found for BIP ${bip}`); return false; }

	const randomLanguageIndex = getRandomInt(0, BIPLanguages.length - 1);
	const BIPlangague = language === "random" ? BIPLanguages[randomLanguageIndex] : language;

	const BIPTable = BIPTables[bip][BIPlangague];
	const mnemonic = [];
	for (let i = 0; i < length; i++) {
		let rnd = getRandomInt(0, BIPTable.length - 1);
		while(mnemonic.includes(BIPTable[rnd])) {
			rnd = getRandomInt(0, BIPTable.length - 1);
		}
		mnemonic.push(BIPTable[rnd]);
	}

	return { wordsList: mnemonic, language: BIPlangague };
}
function getRandomInt(min, max) {
	// Create a buffer of one Uint32
	const buffer = new Uint32Array(1);

	// Fill the buffer with a secure random number - manage himself browser compatibility
	crypto.getRandomValues(buffer);

	// Calculate a range of numbers
	const range = max - min + 1;
	
	// Reduce the random number to the desired range [min, max]
	const randomNumberInRange = min + (buffer[0] % range);
	
	return randomNumberInRange;
}
function countSimilaritiesBetweenLanguages(bip = 'BIP-0039', language1, language2) {
	const words1 = BIPTables['BIP-0039'][language1];
	const words2 = BIPTables['BIP-0039'][language2];
	const similarities = [];
	for (let i = 0; i < words1.length; i++) {
		const word = words1[i];
		if (words2.includes(word)) {
			similarities.push(word);
		}
	}
	return similarities.length;
}

//#region LOADING SETTINGS && BIP TABLES
function loadSettings() {
	const settingsLoaded = JSON.parse(fs.readFileSync('settings.json'));
	if (settingsLoaded === undefined) { return false; }
	if (settingsLoaded.BIPtables === undefined) { return false; }

	// LOAD BIP WORDS LISTS
	const bipList = Object.keys(settingsLoaded.BIPtables);
	for (let i = 0; i < bipList.length; i++) {
		const BIPName = bipList[i];
		const BIPFolderName = BIPName.toLowerCase();
		if (BIPName.includes('_')) { continue; }

		const folderPath = path.join(__dirname, settingsLoaded.BIPFolder, BIPFolderName);
		let languagesObject = settingsLoaded.BIPtables[BIPName].languages;
		if (Object.keys(languagesObject).length === 0) {
			languagesObject = languagesFinder(folderPath);
		}

		const languages = Object.keys(languagesObject);
		for (let j = 0; j < languages.length; j++) {
			const language = languages[j];
			const fileName = languagesObject[language];
			const wordsList = arrayFromTxtList(path.join(folderPath, fileName + '.txt'));
			if (!wordsList) { return false; }
			if (BIPTables[BIPName] === undefined) { BIPTables[BIPName] = {}; }
			BIPTables[BIPName][language] = wordsList;
		}
	}

	return settingsLoaded;
}
function languagesFinder(path, AlphabeticOnly = true) {
	// Extract filename of each ".txt" file in the directory
	const files = fs.readdirSync(path);
	const languages = {};
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		if (file.endsWith('.txt')) {
			const fileName = file.split('.txt')[0];
			const language = AlphabeticOnly ? removeNonAlphabeticChars(fileName) : fileName;
			languages[language] = fileName;
		}
	}
	return languages;
}
function removeNonAlphabeticChars(str) {
	return str.replace(/[^a-zA-Z]/g, '');
}
function arrayFromTxtList(path) {
	try {
		const result = [];
		const data = fs.readFileSync(path, 'utf8');
		const lines = data.split('\r\n');
	
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === '' || line.length === 0) { continue; }
			result.push(line);
		}
	
		if (!isMultipleOf1024(result.length)) { console.error('wordsList length is not a multiple of 1024'); return false;}

		return result;
	} catch (error) {
		console.error(error);
	}
	
	return false;
}
function isMultipleOf1024(number) {
	return number % 1024 === 0;
}
//#endregion

function exportTranslator() {
	const srcFile = fs.readFileSync('translator-src.js', 'utf8');
	const BIPTablesStr = JSON.stringify(BIPTables, null, 4);

    let output = srcFile.replace('const BIPTablesHardcoded = {};', `const BIPTablesHardcoded = ${BIPTablesStr};`);
	output = output.split('//END')[0];

    fs.writeFileSync('translator.js', output);
}
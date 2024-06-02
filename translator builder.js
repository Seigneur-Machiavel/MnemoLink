const fs = require('fs');
const path = require('path');

const officialBIPs = {
	"BIP-0039": require('./bip39 3.1.0.js')
}

const Translator = require('./translator-src.js');
let controlTranslator = false;
if (fs.existsSync('lastBuildControl.js')) {
	controlTranslator = require('./lastBuildControl.js');
}

const BIPTables = {};
const BIPTablesToHardcode = {};
const BIPOfficialNames = {};
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
const testResult = testLoop(settings.testIterations || 100, 'random', 'random', [12, 24], true, false);
if (testResult.success === testResult.iterations) {
	console.log('All tests passed successfully, exporting translator...');
	if (testResult.needVersionUpgrade) {
		const currentVersion = settings.version[0] + '.' + settings.version[1];
		const newVersion = settings.version[1] + 1 < 4095 ? [settings.version[0], settings.version[1] + 1] : [settings.version[0] + 1, 0];
		settings.version = newVersion;
		console.log(`Version upgraded from: ${currentVersion} to: ${settings.version[0]}.${settings.version[1]}`);
	}

	const exportSuccess = exportTranslator();
	if (!exportSuccess) { console.error('Translator could not be exported'); return; }

	const settingSaved = saveSettingsInFile(settings);
	if (!settingSaved) { console.error('Settings could not be saved'); return; }
	console.log('Settings.json saved successfully');
} else {
	console.error('Some tests failed:');
	testResult.failureInfos.forEach((info) => {
		console.log(JSON.stringify(info));
	});
}

//#region TEST FUNCTIONS
function testLoop(iterations = 100, language = "random", pseudoLanguage = "random", mnemonicLengths = [12, 24], autoVersionUpgrade = true, logs = true) {
	lastUpdateProgress = -1;
	let success = 0;
	let failure = 0;
	let needVersionUpgrade = false;
	const failureInfos = [];
	for (let i = 0; i < iterations; i++) {
		const mnemonicLength = mnemonicLengths[ getRandomInt(0, mnemonicLengths.length - 1) ];
		const gen1 = generateMnemonic(mnemonicLength, 'BIP-0039', language);
		const gen2 = generateMnemonic(12, 'BIP-0039', pseudoLanguage);
		const mnemonic = gen1.wordsList;
		const pseudoMnemonic = gen2.wordsList;
		
		const result = singleTest(mnemonic, pseudoMnemonic, logs);
		if (result.success === true) { 
			success++;
			if (result.needVersionUpgrade) { needVersionUpgrade = true; }
		} else { 
			failureInfos.push({
				reason: result.reason,
				mnemonic: gen1,
				pseudoMnemonic: gen2
			});
			failure++;
		}

		updateProgressBar(i + 1, iterations);
	}
	console.log(`\n\nSuccess: ${success} / Failure: ${failure}`);

	return { success, failure, iterations, failureInfos, needVersionUpgrade };
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
	const result = { success: false, needVersionUpgrade: false, reason: '' };
	if (!mnemonic || !pseudoMnemonic) { console.error('mnemonic or pseudoMnemonic is undefined'); result.reason = 'mnemonic or pseudoMnemonic is undefined'; return result; }
	const mnemonicStr = Array.isArray(mnemonic) ? mnemonic.join(' ') : mnemonic;
	if (logs) { console.log(`\nTesting with mnemonic: ${mnemonicStr}\n`) };

	const translatorA = new Translator( {mnemonic, pseudoMnemonic, BIPTables: BIPTables, version: settings.version} );
	const pBIP = translatorA.getEncodedPseudoBIP(true);
	if (!pBIP) { console.error('getEncodedPseudoBIP() failed !'); result.reason = 'getEncodedPseudoBIP() failed'; return result; }
	if (logs) { console.log(pBIP) };

	const translatorB = new Translator( {pBIP, pseudoMnemonic, BIPTables: BIPTables, version: settings.version} );
	const decodedMnemonic = translatorB.translateMnemonic('string'); // output: 'array' or 'string'
	if (!decodedMnemonic) { console.error('translateMnemonic() failed !'); result.reason = 'translateMnemonic() failed'; return result; }
	if (logs) { console.log(`Decoded mnemonic: ${decodedMnemonic}`) };

	// Check if the decoded mnemonic is the same as the original one
	if (mnemonicStr !== decodedMnemonic) { 
		if (logs) { console.error('Decoded mnemonic is different from the original one !') };
		result.reason = 'Decoded mnemonic is different from the original one'; 
		return result; 
	} else {
		result.success = true;
	}

	if (!controlTranslator) { return result; }

	// CONTROL VERSION COMPATIBILITY
	try {
		/* GENERATE THE SAME pBIP IS IMPOSSIBLE BECAUSE OF THE RANDOMNESS OF THE PSEUDOMNEMONIC GENERATION
		const controlTranslatorA = new controlTranslator( {mnemonic, pseudoMnemonic} );
		const controlpBIP = controlTranslatorA.getEncodedPseudoBIP(true);
		if (controlpBIP !== pBIP) { throw new Error('Cannot encode the controlpBIP !'); }
		const controlTranslatorB = new Translator( {pBIP: controlpBIP, pseudoMnemonic, BIPTables: BIPTables, version: settings.version} );
		if (controlTranslatorB.translateMnemonic('string') !== mnemonicStr) { throw new Error('Decoded mnemonic is different from the original one !'); }*/
	
		const controlTranslatorC = new controlTranslator( {pBIP, pseudoMnemonic, officialBIPs} );
		if (controlTranslatorC.translateMnemonic('string') !== mnemonicStr) { throw new Error('Decoded mnemonic is different from the original one !'); }
	} catch (error) {
		result.needVersionUpgrade = true;
	}

	return result;
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
//#endregion

//#region LOADING SETTINGS && BIP TABLES && lastBuild
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
		BIPOfficialNames[BIPName] = settingsLoaded.BIPtables[BIPName].officialName;
		const officialWordlists = officialBIPs[BIPName].wordlists;
		const officialLanguages = Object.keys(officialWordlists);
		for (let j = 0; j < languages.length; j++) {
			const language = languages[j];
			const fileName = languagesObject[language];
			const wordsListFromSettings = arrayFromTxtList(path.join(folderPath, fileName + '.txt'));
			if (!wordsListFromSettings) { return false; }
			if (BIPTables[BIPName] === undefined) { BIPTables[BIPName] = {}; }
			BIPTables[BIPName][language] = wordsListFromSettings;

			if (BIPTablesToHardcode[BIPName] === undefined) { BIPTablesToHardcode[BIPName] = {}; }
			BIPTablesToHardcode[BIPName][language] = wordsListFromSettings; // overriden if the language is in the official BIP list

			// Check if the language is in the offical BIP list
			// - if yes, override the words list with the official name for lightening the translator
			const officialLanguageStr = settingsLoaded.BIPtables[BIPName].languages[language];
			if (!officialLanguages.includes(officialLanguageStr)) { continue; }

			for (let k = 0; k < wordsListFromSettings.length; k++) {
				const wordA = wordsListFromSettings[k];
				const wordB = officialWordlists[officialLanguageStr][k];
				if (wordA !== wordB) { 
					console.error(`The ${BIPName} ${language} words list is different from the official one`);
					continue;
				}
				if (k === wordsListFromSettings.length - 1) { 
					BIPTablesToHardcode[BIPName][language] = { officialLanguageStr: officialLanguageStr };
				}
			}
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

function exportTranslator(logs = true) {
	try {
		const srcFile = fs.readFileSync('translator-src.js', 'utf8');
		const BIPTablesStr = JSON.stringify(BIPTablesToHardcode, null, 4);
		const versionStr = JSON.stringify(settings.version);
		const BIPOfficialNamesStr = JSON.stringify(BIPOfficialNames, null, 4);
	
		let output = srcFile.replace('const BIPTablesHardcoded = {};', `const BIPTablesHardcoded = ${BIPTablesStr};`);
		output = output.replace('const versionHardcoded = [];', `const versionHardcoded = ${versionStr};`);
		output = output.replace('const BIPOfficialNamesHardcoded = {};', `const BIPOfficialNamesHardcoded = ${BIPOfficialNamesStr};`);
		const lastBuildControlFile = output;

		// add export to the class Translator and remove the end of the file containing "module.exports = Translator;"
		output = output.replace('class Translator', 'export class Translator');
		output = output.split('//END')[0];
	
		const folder = 'build';
		const outputFileName = `translator_v${settings.version[0]}.${settings.version[1]}.js`;
		const outputPath = path.join(__dirname, folder, outputFileName);
		const controlOutputPath = path.join(__dirname, 'lastBuildControl.js');
	
		fs.writeFileSync(outputPath, output);
		fs.writeFileSync(controlOutputPath, lastBuildControlFile);

		if (logs) { 
			console.log(`Translator exported to: ${outputPath}`); 
			console.log(`Last build control exported to: ${controlOutputPath}`);
		}
	
		return true;
	} catch (error) {
		console.error(error);
		if (logs) { console.error('Translator could not be exported'); }
		return false;
	}
}
function saveSettingsInFile(settings) {
	try {
		const settingsStr = JSON.stringify(settings, null, 4);
		fs.writeFileSync('settings.json', settingsStr);
		return true;
	} catch (error) {
		console.error(error);
		return false;
	}
}
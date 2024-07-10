const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const officialBIPs = {
	"BIP-0039": require('./bip39 3.1.0.js')
}

const MnemoLinker = require('./MnemoLinker-src.js');
let lastBuildExists = false;
try { const libraryImportTest = require('./lastBuildControl.js'); lastBuildExists = true; } catch (error) { console.info('No last build control file found') };
const controlMnemoLinker = lastBuildExists ? require('./lastBuildControl.js') : false;

const BIPTables = {};
const BIPTablesToHardcode = {};
const BIPOfficialNames = {};
const settings = loadSettings();
if (!settings) { console.error('Settings could not be loaded'); return; }
let lastUpdateProgress = -1;

async function main() {
	// CUSTOM TEST -> Used for coding only
	const customTestMnemonics = [
		{ 	
			mnemonic: ["abandon","able","industry","connect","town","stay","such","ribbon","return","cabbage","bus","spy"],
			masterMnemonic: ["abaisser","abandon","abdiquer","abeille","abolir","aborder","aboutir","aboyer","abrasif","abreuver","abriter","abroger"]
		},
		{
			mnemonic: ["abandon","abandon","industry","connect","town","stay","such","ribbon","return","cabbage","bus","spy"],
			masterMnemonic: ["abaisser","abandon","abdiquer","abeille","abeille","aborder","aboutir","aboyer","abrasif","abreuver","abriter","abroger"]
		},
	];
	const customTestSuccess = await specialsTest(customTestMnemonics);
	if (!customTestSuccess) { console.error('Custom tests failed'); return; }

	// MULTI TEST -> Used to control the validity of the MnemoLinker before exporting it
	const testResult = await testLoop(settings.testIterations || 100, 'random', 'random', [12, 24], true, false);
	if (testResult.success === testResult.iterations) {
		console.log('-------------------------------------------------------');
		console.log('All tests passed successfully, exporting MnemoLinker...');
		console.log(`avg time: ${testResult.avgTime}ms`);

		if (testResult.needVersionUpgrade || !controlMnemoLinker) {
			const currentVersion = settings.version[0] + '.' + settings.version[1];
			const newVersion = settings.version[1] + 1 < 4095 ? [settings.version[0], settings.version[1] + 1] : [settings.version[0] + 1, 0];
			settings.version = newVersion;
			console.log(`Version upgraded from: ${currentVersion} to: ${settings.version[0]}.${settings.version[1]}`);
		}

		const exportSuccess = exportMnemoLinker();
		if (!exportSuccess) { console.error('MnemoLinker could not be exported'); return; }

		const settingSaved = saveSettingsInFile(settings);
		if (!settingSaved) { console.error('Settings could not be saved'); return; }
		console.log('Settings.json saved successfully');
	} else {
		console.error('Some tests failed:');
		testResult.failureInfos.forEach((info) => {
			console.log(JSON.stringify(info));
		});
	}
};
main();

//#region TEST FUNCTIONS
async function specialsTest(customTestMnemonics) {
	let singleTestTimings = [];
	for (let i = 0; i < customTestMnemonics.length; i++) {
		const startTimestamp = Date.now();
		const mnemonic_ = customTestMnemonics[i].mnemonic;
		const masterMnemonic_ = customTestMnemonics[i].masterMnemonic;
		const singleTestResult = await singleTest(mnemonic_, masterMnemonic_);
		if (!singleTestResult.success) {
			console.error(`Custom test ${i} failed`);
			console.error(`mnemonic: ${mnemonic_}`);
			console.error(`masterMnemonic: ${masterMnemonic_}`);
			return false;
		}
		const endTimestamp = Date.now();
		singleTestTimings.push(endTimestamp - startTimestamp);
	}
	console.log(`Custom tests passed successfully in avg: ${singleTestTimings.reduce((a, b) => a + b, 0) / singleTestTimings.length}ms`);

	return true;
}
async function testLoop(iterations = 100, language = "random", masterLanguage = "random", mnemonicLengths = [12, 24], autoVersionUpgrade = true, logs = true) {
	lastUpdateProgress = -1;
	let success = 0;
	let failure = 0;
	let needVersionUpgrade = false;
	let singleTestTimings = [];
	const failureInfos = [];
	for (let i = 0; i < iterations; i++) {
		const mnemonicLength = mnemonicLengths[ getRandomInt(0, mnemonicLengths.length - 1) ];
		const gen1 = generateMnemonic(mnemonicLength, 'BIP-0039', language);
		const gen2 = generateMnemonic(12, 'BIP-0039', masterLanguage);
		const mnemonic = gen1.wordsList;
		const masterMnemonic = gen2.wordsList;
		const startTimestamp = Date.now();
		
		const result = await singleTest(mnemonic, masterMnemonic, needVersionUpgrade, logs);
		if (result.success === true) { 
			success++;
			if (result.needVersionUpgrade) { needVersionUpgrade = true; }
		} else {
			if (logs && result.reason) { console.error(result.reason) };
			failureInfos.push({
				reason: result.reason,
				mnemonic: gen1,
				masterMnemonic: gen2
			});
			failure++;
		}
		const endTimestamp = Date.now();
		const totalSingleTestTime = endTimestamp - startTimestamp;
		const singleEncryptionOperationTime = controlMnemoLinker ? totalSingleTestTime / 3 : totalSingleTestTime / 2;
		singleTestTimings.push(singleEncryptionOperationTime);
		updateProgressBar(i + 1, iterations);
	}
	console.log(`\n\nSuccess: ${success} / Failure: ${failure}`);
	const avgTime = singleTestTimings.reduce((a, b) => a + b, 0) / singleTestTimings.length;

	return { success, failure, iterations, failureInfos, needVersionUpgrade, avgTime };
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
 * @param {string|string[]} masterMnemonic
 * @returns {boolean}
 */
async function singleTest(mnemonic, masterMnemonic, needVersionUpgrade = false, logs = true) {
	const result = { success: false, needVersionUpgrade: false, reason: '' };
	if (!mnemonic || !masterMnemonic) { result.reason = 'mnemonic or masterMnemonic is undefined'; return result; }
	const mnemonicStr = Array.isArray(mnemonic) ? mnemonic.join(' ') : mnemonic;
	if (logs) { console.log(`\nTesting with mnemonic: ${mnemonicStr}\n`) };

	// ENCRYPT MNEMONIC => MNEMOLINK
	const MnemoLinkerA = new MnemoLinker( {mnemonic, masterMnemonic, BIPTables, version: settings.version, officialBIPs} );
	const mnemoLink = await MnemoLinkerA.encryptMnemonic();
	if (!mnemoLink) { result.reason = 'encryptMnemonic() failed'; return result; }
	
	const id = await MnemoLinkerA.genPublicId();
	if (logs) { console.log(`mnemoLink: ${mnemoLink}`) };

	// DECRYPT MNEMOLINK => MNEMONIC
	const MnemoLinkerB = new MnemoLinker( {masterMnemonic, BIPTables, version: settings.version, officialBIPs} );
	const decryptedMnemonicStr = await MnemoLinkerB.decryptMnemoLink(mnemoLink);
	if (!decryptedMnemonicStr) { result.reason = 'decryptMnemoLink() failed'; return result; }
	if (logs) { console.log(`Decoded mnemonic: ${decryptedMnemonicStr}`) };

	// CHECK IF THE DECODED MNEMONIC IS THE SAME AS THE ORIGINAL ONE
	if (mnemonicStr !== decryptedMnemonicStr) { 
		if (logs) { console.error('Decoded mnemonic is different from the original one !') };
		result.reason = 'Decoded mnemonic is different from the original one'; 
		return result; 
	} else {
		result.success = true;
	}

	if (needVersionUpgrade) { return result; }
	if (!controlMnemoLinker) { return result; }

	// CONTROL VERSION COMPATIBILITY
	try {
		// DECRYPT MNEMOLINK => MNEMONIC, WITH THE LAST VERSION
		const MnemoLinkerC = new controlMnemoLinker( {masterMnemonic, officialBIPs} );
		const controlDecryptedMnemonicStr = await MnemoLinkerC.decryptMnemoLink(mnemoLink);
		// CHECK IF THE DECODED MNEMONIC IS THE SAME AS THE ORIGINAL ONE
		if (controlDecryptedMnemonicStr !== mnemonicStr) { throw new Error('VERSIONNING CONTROL => Decoded mnemonic is different from the original one !'); }
	
		// CHECK IF ID IS CORRESPONDING
		const controlId = await MnemoLinkerC.genPublicId();
		if (controlId !== id) { throw new Error('VERSIONNING CONTROL => Control IDs are different !'); }
	} catch (error) {
		result.needVersionUpgrade = true;
	}

	return result;
}
function generateMnemonic(length = 12, bip = "BIP-0039", language = "random") { // TESTING ONLY - INVALID MNEMONICS !
	if (!BIPTables[bip]) { console.error(`BIP ${bip} not found`); return false; }

	const BIPLanguages = Object.keys(BIPTables[bip]);
	if (BIPLanguages.length === 0) { console.error(`No languages found for BIP ${bip}`); return false; }

	const randomLanguageIndex = getRandomInt(0, BIPLanguages.length - 1);
	const BIPlangague = language === "random" ? BIPLanguages[randomLanguageIndex] : language;

	const BIPTable = BIPTables[bip][BIPlangague];
	const mnemonic = [];
	for (let i = 0; i < length; i++) {
		const rnd = getRandomInt(0, BIPTable.length - 1);
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
			// - if yes, override the words list with the official name for lightening the MnemoLinker
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
		const data = fs.readFileSync(path, 'utf8');

		function digestData(data, mode = 'windows') {
			const res = [];
			const lines = mode === 'windows' ? data.split('\r\n') : data.split('\n');
		
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line === '' || line.length === 0) { continue; }
				res.push(line);
			}

			return res;
		}

		const windowsData = digestData(data, 'windows');
		const linuxData = digestData(data, 'linux');
	
		if (!isMultipleOf1024(windowsData.length) && !isMultipleOf1024(linuxData.length)) { console.error('wordsList length is not a multiple of 1024'); return false; }
		const dataToUse = isMultipleOf1024(windowsData.length) ? windowsData : linuxData;

		return dataToUse;
	} catch (error) {
		console.error(error);
	}
	
	return false;
}
function isMultipleOf1024(number) {
	return number % 1024 === 0;
}
//#endregion

function exportMnemoLinker(logs = true) {
	try {
		const srcFile = fs.readFileSync('MnemoLinker-src.js', 'utf8');
		const BIPTablesStr = JSON.stringify(BIPTablesToHardcode, null, 4);
		const versionStr = JSON.stringify(settings.version);
		const BIPOfficialNamesStr = JSON.stringify(BIPOfficialNames, null, 4);
	
		let output = srcFile.replace('const BIPTablesHardcoded = {};', `const BIPTablesHardcoded = ${BIPTablesStr};`);
		output = output.replace('const versionHardcoded = [];', `const versionHardcoded = ${versionStr};`);
		output = output.replace('const BIPOfficialNamesHardcoded = {};', `const BIPOfficialNamesHardcoded = ${BIPOfficialNamesStr};`);
		const lastBuildControlFile = output;

		// add export to the class MnemoLinker and remove the end of the file containing "module.exports = MnemoLinker;"
		output = output.replace('class MnemoLinker', 'export class MnemoLinker');
		output = output.split('//END')[0];
	
		const folder = 'builds';
		const outputFileName = `MnemoLinker_v${settings.version[0]}.${settings.version[1]}.js`;
		const outputPath = path.join(__dirname, folder, outputFileName);

		const outputExtensionFolder = 'LinkVault/chrome-extension/scripts/MnemoLinker'
		const outputExtensionPath = path.join(__dirname, outputExtensionFolder, outputFileName);

		const controlOutputPath = path.join(__dirname, 'lastBuildControl.js');
	
		fs.writeFileSync(outputPath, output);
		fs.writeFileSync(outputExtensionPath, output);
		fs.writeFileSync(controlOutputPath, lastBuildControlFile);

		if (logs) { 
			console.log(`MnemoLinker exported to: ${outputPath}`);
			console.log(`MnemoLinker exported to: ${outputExtensionPath}`);
			console.log(`Last build control exported to: ${controlOutputPath}`);
		}
	
		return true;
	} catch (error) {
		console.error(error);
		if (logs) { console.error('MnemoLinker could not be exported'); }
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
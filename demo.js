const mnemoLinkerLastest = require('./MnemoLinker-src.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const officialBIPs = {
	"BIP-0039": require('./bip39 3.1.0.js')
}

const BIPTables = {};
const BIPTablesToHardcode = {};
const BIPOfficialNames = {};
const settings = loadSettings();
if (!settings) { console.error('Settings could not be loaded'); return; }
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


async function demo() {
    const masterMnemonic = generateMnemonic(8, 'BIP-0039', 'french').wordsList;
    const mnemonic = generateMnemonic(12, 'BIP-0039', 'french').wordsList;
    console.log(`Master Mnemonic: ${masterMnemonic}`);
    console.log(`Mnemonic: ${mnemonic}`);
    
    const mnemoLinkerInstance = new mnemoLinkerLastest({masterMnemonic, mnemonic, BIPTables, version: settings.version, officialBIPs});
    mnemoLinkerInstance.minMnemonicLength = 8;
    const mnemoLink = await mnemoLinkerInstance.encryptMnemonic();
    console.log(`MnemoLink: ${mnemoLink}`);

    const decrypterIntance = new mnemoLinkerLastest({masterMnemonic, BIPTables, version: settings.version, officialBIPs});
    decrypterIntance.minMnemonicLength = 8;
    const decryptedMnemonic = await decrypterIntance.decryptMnemoLink(mnemoLink);
    console.log(`Decrypted Mnemonic: ${decryptedMnemonic}`);
}; demo();
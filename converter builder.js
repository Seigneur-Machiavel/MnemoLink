const fs = require('fs');
const path = require('path');
const { converter, Translator } = require('./converter-src.js');

const cter = new converter();
const BIPTables = {};
const settings = loadSettings();
const testMnemonic = "abandon number industry connect town stay such ribbon return cabbage bus spy" // 12 words english BIP39
const testPseudoMnemonic = "abaisser bannière caneton décider ennemi filetage guide hormone infini jauger kiosque lampe" // 12 words french BIP39

//#region LOADING SETTINGS && BIP TABLES
if (!settings) { console.error('Settings could not be loaded'); return; }

function loadSettings() {
	const settings = JSON.parse(fs.readFileSync('settings.json'));
	if (settings === undefined) { return false; }
	if (settings.BIPtables === undefined) { return false; }

	// LOAD BIP WORDS LISTS
	const bipList = Object.keys(settings.BIPtables);
	for (let i = 0; i < bipList.length; i++) {
		const BIPName = bipList[i];
		const BIPFolderName = BIPName.toLowerCase();
		if (BIPName.includes('_')) { continue; }

		const folderPath = path.join(__dirname, settings.BIPFolder, BIPFolderName);
		let languagesObject = settings.BIPtables[BIPName].languages;
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

	return settings;
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

/*function test(mnemonicStr, pseudoMnemonicStr) {
	cter.BIPTables = BIPTables;

	const mnemonic = mnemonicStr.split(' ');
	const pseudoMnemonic = pseudoMnemonicStr.split(' ');

	// Searching for the BIP and language of the mnemonic
	//const detected = cter.getBIPTableFromMnemonic(mnemonic);
	//if (!detected) { console.error('bip and language not found'); return false; }
	//console.log(`bip: ${detected.bip}, language: ${detected.language}`);

	const generated = cter.genPseudoBipTable(mnemonic, pseudoMnemonic);

	return generated;
}*/
function test(mnemonicStr, pseudoMnemonicStr) {
	const mnemonic = mnemonicStr.split(' '); // From "abandon number industry ..." to ["abandon", "number", "industry", ...]
	const pseudoMnemonic = pseudoMnemonicStr.split(' '); // Can be passed as string or array

	const translatorA = new Translator( {mnemonic, pseudoMnemonic} );
	translatorA.BIPTables = BIPTables; // NOT NECESSARY WHEN EXPORTED TRANSLATOR
	const encodedTable = translatorA.getEncodedTable(true);
	if (!encodedTable) { console.error('getEncodedTable() failed !'); return false; }

	const translatorB = new Translator( {encodedTable} );
	translatorB.BIPTables = BIPTables; // NOT NECESSARY WHEN EXPORTED TRANSLATOR
	const decodedMnemonic = translatorB.translate(pseudoMnemonic);

	return decodedMnemonic;
}

function exportConverter() {
	const srcFile = fs.readFileSync('converter-src.js', 'utf8');
	const BIPTablesStr = JSON.stringify(BIPTables, null, 4);

    const output = srcFile.replace('const BIPTablesHardcoded = {};', `const BIPTablesHardcoded = ${BIPTablesStr};`);
	output = output.split('//END')[0];

    fs.writeFileSync('converter.js', output);
}

const testResult = test(testMnemonic, testPseudoMnemonic);
exportConverter();
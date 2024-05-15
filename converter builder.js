const fs = require('fs');
const path = require('path');
const converter = require('./converter-src.js');

const wordslists = {};
const settings = loadSettings();
const testMnemonic = "abandon number industry connect town stay such ribbon return cabbage bus spy" // 12 words english BIP39
const testPseudoMnemonic = "abaisser bannière caneton décider ennemi filetage guide hormone infini jauger kiosque lampe" // 12 words french BIP39

//#region LOADING SETTINGS && WORDSLISTS
if (!settings) { console.error('Settings could not be loaded'); return; }

function loadSettings() {
	const settings = JSON.parse(fs.readFileSync('settings.json'));
	if (settings === undefined) { return false; }
	if (settings.BIPtables === undefined) { return false; }

	// LOAD BIP WORDS LISTS
	const bipList = Object.keys(settings.BIPtables);
	for (let i = 0; i < bipList.length; i++) {
		const bipNumberStr = bipList[i];
		if (bipNumberStr.includes('_')) { continue; }
		const readableBIPName = "BIP" + bipNumberStr;
		const bipNormalizedName = BIPNumberToFixedLength(bipNumberStr);

		const folderPath = path.join(__dirname, settings.BIPFolder, settings.subfolderPrefix + bipNormalizedName);
		let languages = settings.BIPtables[bipNumberStr].languages;
		if (languages.length === 0) {
			languages = languagesFinder(folderPath);
		}

		for (let j = 0; j < languages.length; j++) {
			const language = languages[j];
			const wordsList = arrayFromTxtList(path.join(folderPath, language + '.txt'));
			if (!wordsList) { return false; }
			if (wordslists[readableBIPName] === undefined) { wordslists[readableBIPName] = {}; }
			wordslists[readableBIPName][language] = wordsList;
		}
	}

	return settings;
}
function BIPNumberToFixedLength(numberStr = "39", length = 4) {
	let number = parseInt(numberStr);
	let result = number.toString();
	while (result.length < length) {
		result = "0" + result;
	}
	return result;
}
function languagesFinder(path, AlphabeticOnly = true) {
	// Extract filename of each ".txt" file in the directory
	const files = fs.readdirSync(path);
	const languages = [];
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		if (file.endsWith('.txt')) {
			const fileName = file.split('.txt')[0];
			const language = AlphabeticOnly ? removeNonAlphabeticChars(fileName) : fileName;
			languages.push(language);
		}
	}
	return languages;
}
function removeNonAlphabeticChars(str) {
	return str.replace(/[^a-zA-Z]/g, '');
}
function arrayFromTxtList(path) {
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
}
function isMultipleOf1024(number) {
	return number % 1024 === 0;
}
//#endregion

function test(mnemonicStr, pseudoMnemonicStr) {
	const cter = new converter();
	cter.wordslists = wordslists;

	const mnemonic = mnemonicStr.split(' ');
	const pseudoMnemonic = pseudoMnemonicStr.split(' ');

	// Searching for the BIP and language of the mnemonic
	const detected = cter.getWordsListFromMnemonic(mnemonic);
	if (!detected) { console.error('bip and language not found'); return; };
	console.log(`bip: ${detected.bip}, language: ${detected.language}`);

	const generated = cter.genPseudoBipTable(mnemonic, pseudoMnemonic);
	console.log(generated);
	return generated;
}

function exportConverter() {
	const srcFile = fs.readFileSync('converter-src.js', 'utf8');
	const wordslistsStr = JSON.stringify(wordslists, null, 4);
	srcFile.replace('const hardcodedWordsLists = {};', `const hardcodedWordsLists = ${wordslistsStr};`);

    let output = srcFile.replace('const hardcodedWordsLists = {};', `const hardcodedWordsLists = ${wordslistsStr};`);
	output = output.split('//END')[0];

    fs.writeFileSync('converter.js', output);
}

const testResult = test(testMnemonic, testPseudoMnemonic);
exportConverter();
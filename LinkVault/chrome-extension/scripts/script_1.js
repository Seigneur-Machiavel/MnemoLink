if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)
	const anime = require("./anime.min.js");
	//const bip39 = require('bip39');
	const bip39 = require("./bip39-3.1.0.js");
	const { MnemoLinker } = require("./MnemoLinker/MnemoLinker_v0.1.js");
	const { cryptoLight } = require("./cryptoLight.js");

}

document.addEventListener('DOMContentLoaded', function() {
    chrome.runtime.sendMessage({action: "getPassword"}, function(response) {
		const password = response.password;
        if (!password) { return; }
		
		chrome.storage.local.get(['hashedPassword'], async function(result) {
			const { hash, saltBase64, ivBase64 } = result.hashedPassword;
			const res = await cryptoLight.init(password, saltBase64, ivBase64);
			if (!res.hash === hash) { console.error('Wrong password'); return; }

			console.log(`Ready to decrypt !`);
		});
    });
});

const urlprefix = ""
// Dont forget to use the "urlprefix" while fetching, example :
// .src = `${urlprefix}sprites/cloud`

//#region - CLASSES
class mnemonicObject {
	constructor(mnemonic = [], bip = "BIP-0039", language = "english") {
		this.mnemonic = mnemonic;
		this.bip = bip;
		this.language = language;
	}
	isFilled() {
		if (this.mnemonic.length === 0) { return false; }
		return true;
	}
	getMnemonicStr() {
		return this.mnemonic.join(' ');
	}
	getIndexedMnemonicStr() {
		let mnemonicStr = "";
		for (let i = 0; i < this.mnemonic.length; i++) {
			mnemonicStr += `${i + 1}. ${this.mnemonic[i]}\n`;
		}
		return mnemonicStr;
	}
}
class userDataClass {
	constructor() {
		this.encryptedMasterMnemonicsStr = "";
		this.encryptedMnemoLinksStr = {};
		this.preferences = {
			darkMode: false,
		};
	}
	// Master Mnemonic
	async setMnemonicAsEncrypted(mnemonicStr = "") {
		const mnemonicStrEncrypted = await this.#encrypStringWithPassword(mnemonicStr);
		if (!mnemonicStrEncrypted) { return false; }

		this.encryptedMasterMnemonicsStr = mnemonicStrEncrypted;
		return true;
	}
	clearMasterMnemonic() { this.encryptedMasterMnemonicsStr = ""; }
	async getMasterMnemonicArray() {
		if (!this.isMasterMnemonicFilled()) { return false; }

		const mnemonicStr = await this.#decryptStringWithPassword(this.encryptedMasterMnemonicsStr);
		if (!mnemonicStr) { return false; }

		return mnemonicStr.split(' ');
	}
	async getMasterMnemonicStr() {
		if (!this.isMasterMnemonicFilled()) { return false; }

		const mnemonicStr = await this.#decryptStringWithPassword(this.encryptedMasterMnemonicsStr);
		if (!mnemonicStr) { return false; }

		return mnemonicStr;
	}
	async getIndexedMasterMnemonicStr() {
		if (!this.isMasterMnemonicFilled()) { return false; }
		const mnemonicStrDecrypted = await this.#decryptStringWithPassword(this.encryptedMasterMnemonicsStr);
		if (!mnemonicStrDecrypted) { return false; }

		const mnemonicArray = mnemonicStrDecrypted.split(' ');
		
		let mnemonicStr = "";
		for (let i = 0; i < mnemonicArray.length; i++) {
			mnemonicStr += `${i + 1}. ${mnemonicArray[i]}\n`;
		}

		return mnemonicStr;
	}
	isMasterMnemonicFilled() { return this.encryptedMasterMnemonicsStr === "" ? false : true; }
	// MnemoLinks
	addMnemoLink(mnemoLink, label = '') {
		if (label === '') { label = `key${Object.keys(this.encryptedMnemoLinksStr).length + 1}`; }
		this.encryptedMnemoLinksStr[label] = mnemoLink;
	}
	removeMnemoLink(label) {
		if (!this.encryptedMnemoLinksStr[label]) { return false; }
		delete this.encryptedMnemoLinksStr[label];
	}
	getListOfMnemoLinks() {
		return Object.keys(this.encryptedMnemoLinksStr);
	}
	// Crypto -> local storage
	async #encrypStringWithPassword(str = "") {
		const encryptedStr = await cryptoLight.encryptText(str);
		if (!encryptedStr) { return false; }

		return encryptedStr;
	}
	async #decryptStringWithPassword(encryptedStr = "") {
		const str = await cryptoLight.decryptText(encryptedStr);
		if (!str) { return false; }

		return str;
	}
}
class userInfoClass {
	constructor() {
		this.validMnemonicLengths = [12, 15, 18, 21, 25]; // [12, 24];
		this.mnemonic = [];
		this.mnemonicBip = "";
		this.mnemonicLanguage = "";

		this.pseudoMnemonic = [];
		this.pseudoMnemonicBip = "";
		this.pseudoMnemonicLanguage = "";

		this.mnemoLink = "";
	}
	setMnemonic(mnemonic) {
		if (!this.validMnemonicLengths.includes(mnemonic.length)) { console.error('Mnemonic must be 12 or 24 words long'); return false; }
		this.mnemonic = mnemonic;
		return true;
	}
	setPseudoMnemonic(mnemonic) {
		if (!this.validMnemonicLengths.includes(mnemonic.length)) { console.error('Pseudo mnemonic must be 12 or 24 words long'); return false; }
		this.pseudoMnemonic = mnemonic;
		return true;
	}
	getIndexedMnemonicStr() {
		let mnemonicStr = "";
		for (let i = 0; i < this.mnemonic.length; i++) {
			mnemonicStr += `${i + 1}. ${this.mnemonic[i]}\n`;
		}
		return mnemonicStr;
	}
	getIndexedPseudoMnemonicStr() {
		let mnemonicStr = "";
		for (let i = 0; i < this.pseudoMnemonic.length; i++) {
			mnemonicStr += `${i + 1}. ${this.pseudoMnemonic[i]}\n`;
		}
		return mnemonicStr;
	}
} // DEPRECATED
//#endregion

//#region - VARIABLES
/** @type {MnemoLinker} */
let MnemoLinkerLastest = null;
/** @type {MnemoLinker} */
let emptyMnemoLinker = null;

const skipper = {form1Control: true, form2Control: true} // TO MODIFY
const settings = {
	mnemoLinkerVersion: window.MnemoLinker.latestVersion,
	defaultBip: "BIP-0039",
	defaultLanguage: "english",
	nbOfWordsToCheck: 3,
	delayBeetweenChar: 10,
	fastFillMode: true,
	saveLogs: true,
}
const parkour = { // TO MODIFY
	currentForm: -1,
	formInTransition: false,
	"step0": { fromExistingMnemonic: false },
	"step1": { randomizingMnemonic: false, controllingMnemonic: false, fillAsPlaceholder: true, controlledMnemonic: false, rndMnemonic: [], rndButtonsPressed: 0},
	"step2": { controllingMnemonic: false, controlledMnemonic: false, lockedMnemonic: true },
};
const userData = new userDataClass();
const userInfo = new userInfoClass();
const tempData = {
	rndMnemonic: [],
	rndButtonsPressed: 0,
	mnemonic: new mnemonicObject(),

	init() {
		this.rndMnemonic = [];
		this.rndButtonsPressed = 0;
		this.mnemonic = new mnemonicObject();
	}
};
const eHTML = {
	toggleDarkModeButton: document.getElementById('dark-mode-toggle'),
	footerVersion: document.getElementById('footerVersion'),
	dashboard: {
		element: document.getElementById('dashboard'),
		centerScreenBtn: document.getElementById('centerScreenBtn'),
		mnemolinksList: document.getElementById('mnemolinksList'),
		mnemolinksBubblesContainer: document.getElementById('mnemolinksBubblesContainer'),
	},
	modals: {
		wrap: document.getElementsByClassName('modalsWrap')[0],
		inputMasterMnemonic: {
			wrap : document.getElementById('masterMnemonicModalWrap'),
			element: document.getElementById('masterMnemonicModalWrap').getElementsByClassName('modal')[0],
			/*bipList : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('optionsList')[0],
			languageList : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('optionsList')[1],*/
			previousLanguageBtn : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('arrowButton')[0],
			randomizeBtn : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('languageSelectionBtn')[0],
			nextLanguageBtn : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('arrowButton')[1],
			mnemonicGrid : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('mnemonicGrid')[0],
			mnemonicGridInputs : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('mnemonicGrid')[0].querySelectorAll('input'),
			scoreBarFill : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('scoreBarFill')[0],
			scoreLabel : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('scoreBarWrap')[0].getElementsByClassName('scoreLabelSpan')[0],
			copyMnemonicBtn : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('modalButton')[0],
			downloadMnemonicBtn : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('modalButton')[1],
			confirmBtn : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('modalButton')[2],
			bottomInfo : document.getElementById('masterMnemonicModalWrap').getElementsByClassName('bottomInfo')[0]
		},
		inputMnemonic: {
			wrap : document.getElementById('mnemonicModalWrap'),
			element: document.getElementById('mnemonicModalWrap').getElementsByClassName('modal')[0],
			previousLanguageBtn : document.getElementById('mnemonicModalWrap').getElementsByClassName('arrowButton')[0],
			randomizeBtn : document.getElementById('mnemonicModalWrap').getElementsByClassName('languageSelectionBtn')[0],
			nextLanguageBtn : document.getElementById('mnemonicModalWrap').getElementsByClassName('arrowButton')[1],
			mnemonicGrid : document.getElementById('mnemonicModalWrap').getElementsByClassName('mnemonicGrid')[0],
			mnemonicGridInputs : document.getElementById('mnemonicModalWrap').getElementsByClassName('mnemonicGrid')[0].querySelectorAll('input'),
			copyMnemonicBtn : document.getElementById('mnemonicModalWrap').getElementsByClassName('modalButton')[0],
			downloadMnemonicBtn : document.getElementById('mnemonicModalWrap').getElementsByClassName('modalButton')[1],
			confirmBtn : document.getElementById('mnemonicModalWrap').getElementsByClassName('modalButton')[2],
			bottomInfo : document.getElementById('mnemonicModalWrap').getElementsByClassName('bottomInfo')[0]
		},
	},
	forms: [
		{	
			wrap : document.getElementById('formWrap0'),
			element : document.getElementById('form0'),
			useExistingMnemonicBtn : document.getElementById('useExistingMnemonicBtn'),
			startBtn : document.getElementById('startBtn'),
			retrieveBtn : document.getElementById('retrieveBtn'),
			bottomInfo : document.getElementById('form0').getElementsByClassName('bottomInfo')[0],
		},
		{	
			wrap : document.getElementById('formWrap1'),
			element: document.getElementById('form1'),
			bipList : document.getElementById('form1').getElementsByClassName('optionsList')[0],
			languageList : document.getElementById('form1').getElementsByClassName('optionsList')[1],
			lengthList : document.getElementById('form1').getElementsByClassName('optionsList')[2],
			previousLanguageBtn : document.getElementById('previousLanguageBtn'),
			mnemoLinkRandomizeBtn : document.getElementById('mnemoLinkRandomizeBtn'),
			nextLanguageBtn : document.getElementById('nextLanguageBtn'),
			mnemonicGrid : document.getElementById('pseudoMnemonicGrid'),
			mnemonicGridInputs : document.getElementById('pseudoMnemonicGrid').querySelectorAll('input'),
			scoreBarFill : document.getElementById('scoreBarFill'),
			scoreLabel : document.getElementById('scoreLabel'),
			copyMnemonicBtn : document.getElementById('copyPseudoMnemonicBtn'),
			downloadMnemonicBtn : document.getElementById('downloadPseudoMnemonicBtn'),
			continueBtn : document.getElementById('continueForm1Btn'),
			bottomInfo : document.getElementById('form1').getElementsByClassName('bottomInfo')[0],
		},
		{	
			wrap : document.getElementById('formWrap2'),
			element : document.getElementById('form2'),
			mnemonicGrid : document.getElementById('mnemonicGrid'),
			mnemonicGridInputs : document.getElementById('mnemonicGrid').querySelectorAll('input'),
			copyMnemonicBtn : document.getElementById('copyMnemonicBtn'),
			downloadMnemonicBtn : document.getElementById('downloadMnemonicBtn'),
			continueBtn : document.getElementById('continueForm2Btn'),
			bottomInfo : document.getElementById('form2').getElementsByClassName('bottomInfo')[0],
		},
		{
			wrap : document.getElementById('formWrap3'),
			element : document.getElementById('form3'),
			mnemoLinkWrap : document.getElementById('form3').getElementsByClassName('mnemoLinkWrap')[0],
			mnemoLinkStr : document.getElementById('mnemoLinkStr'),
			copyMnemoLinkBtn : document.getElementById('copyMnemoLinkBtn'),
			downloadMnemoLinkBtn : document.getElementById('downloadMnemoLinkBtn'),
			inscribeBtn : document.getElementById('inscribeBtn'),
			bottomInfo : document.getElementById('form3').getElementsByClassName('bottomInfo')[0],
		}
	]
}
eHTML.footerVersion.innerText = "v" + window.MnemoLinker.latestVersion;
//#endregion

//#region - STORAGE FUNCTIONS
const save = {
	logs: settings.saveLogs,
	async all() {
		const saveFunctions = Object.keys(save).filter((key) => key !== "all" && key !== "logs");
		for (let i = 0; i < saveFunctions.length; i++) {
			const functionName = saveFunctions[i];
			await save[functionName](); // can be promises all, but actually fast.
		}
	},
	async userEncryptedMnemonicsStr() {
		const masterMnemonicStr = userData.encryptedMasterMnemonicsStr;
		await storeDataLocally('encryptedMasterMnemonicsStr', masterMnemonicStr, save.logs);
	},
	async userMnemoLinks() {
		const data = userData.encryptedMnemoLinksStr;
		await storeDataLocally('encryptedMnemoLinksStr', data, save.logs);
	},
	async userPreferences() {
		const data = userData.preferences;
		await storeDataLocally('preferences', data, save.logs);
	}
}
const load = {
	logs: true,
	async all() {
		const loadFunctions = Object.keys(load).filter((key) => key !== "all" && key !== "logs");
		for (let i = 0; i < loadFunctions.length; i++) {
			const functionName = loadFunctions[i];
			await load[functionName](); // can be promises all, but actually fast.
		}
	},
	async userEncryptedMnemonicsStr() {
		const data = await getDataLocally('encryptedMasterMnemonicsStr')
		const logMsg = !data ? 'No encryptedMasterMnemonicsStr found !' : 'encryptedMasterMnemonicsStr loaded !';
		if (load.logs) { console.log(logMsg); }
		if (!data) { return; }

		userData.encryptedMasterMnemonicsStr = data;
	},
	async userMnemoLinks() {
		const data = await getDataLocally('encryptedMnemoLinksStr')
		const logMsg = !data ? 'No encryptedMnemoLinksStr found !' : 'encryptedMnemoLinksStr loaded !';
		if (load.logs) { console.log(logMsg); }
		if (!data) { return; }

		userData.encryptedMnemoLinksStr = data;
	},
	async userPreferences() {
		const data = await getDataLocally('preferences')
		const logMsg = !data ? 'No preferences found !' : 'Preferences loaded !';
		if (load.logs) { console.log(logMsg); }
		if (!data) { return; }

		userData.preferences = data;
	}
}
async function storeDataLocally(key = "toto", data, logs = false) {
	try {
		const result = await chrome.storage.local.set({ [key]: data })
		console.log(result);
		if (logs) { console.log(`${key} stored, data: ${JSON.stringify(data)}`); }
	} catch (error) {
		if (logs) { console.error(`Error while storing ${key}, data: ${data}`); }
	}
}
async function getDataLocally(key = "toto") {
	const fromStorage = await chrome.storage.local.get([key])
	if (!fromStorage[key]) { return false; }
	return fromStorage[key];
}
//#endregion

//#region - PRELOAD FUNCTIONS
async function asyncInitLoad() {
	await load.all();
	fillMnemoLinkList();

	MnemoLinkerLastest = await window.MnemoLinker["v" + window.MnemoLinker.latestVersion];
	emptyMnemoLinker = new MnemoLinkerLastest();
}; asyncInitLoad(); // auto execute
function toggleDarkMode(element) {
	if (element.checked) {
		document.body.classList.add('dark-mode');
		document.getElementById('dashboard').classList.add('invertColors');
	} else {
		document.body.classList.remove('dark-mode');
		document.getElementById('dashboard').classList.remove('invertColors');
	}
}
//#endregion

//#region - WELCOME ANIMATIONS
/*const textWrapper = document.querySelector('.ml3');
textWrapper.innerHTML = textWrapper.textContent.replace(/\S/g, "<span class='letter'>$&</span>");
const titleAnimationDuration = {A: 800, B: 1000, C: 1400};
setTimeout(() => { document.getElementById('appTitleBackground').style.opacity = 1; }, titleAnimationDuration.A / 2);
document.getElementById('appTitle').classList.remove('hidden');
anime.timeline({loop: false})
  .add({
    targets: '.ml3 .letter',
    opacity: [0,1],
	easing: 'easeOutElastic(1.4, .8)',
    duration: titleAnimationDuration.B,
    delay: (el, i) => titleAnimationDuration.A / 10 * (i+1)
  });
setTimeout(() => { 
	document.getElementById('appTitleWrap').classList.add('topScreen');
	document.getElementById('appTitle').getElementsByClassName('titleSufix')[0].classList.add('visible');
	if (parkour.currentForm === -1) { setActiveForm(0); }
}, titleAnimationDuration.C);*/
//#endregion

//#region - SIMPLE FUNCTIONS
function generateBIP39Mnemonic(mnemonicLength = 12, language = "english") {
	const entropy = mnemonicLength === 12 ? 128 : 256;

	bip39.setDefaultWordlist(language);

	const mnemonicStr = bip39.generateMnemonic(entropy);
	const mnemonic = mnemonicStr.split(' ');
	return mnemonic;
}
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }
function cryptoRnd(min, max) {
	const crypto = window.crypto;
	const randomBuffer = new Uint32Array(1);

	crypto.getRandomValues(randomBuffer);
	const randomValue = randomBuffer[0] / (0xffffffff + 1);

	return Math.floor(randomValue * (max - min + 1) + min);
}
async function randomizeMnemonic(modal = eHTML.modals.inputMasterMnemonic, asPlaceholder = false) {
	const mnemonic = [];
	const bip = "BIP-0039";
	const language = modal.randomizeBtn.classList[1];
	const wordsList = emptyMnemoLinker.getWordsTable(bip, language);
	if (!wordsList) { return; }

	modal.mnemonicGrid.classList.add('busy');

	const mnemonicGridInputs = modal.mnemonicGridInputs;
	mnemonicGridInputs.forEach((input) => { input.value = ""; input.placeholder = "";  });

	for (let i = 0; i < mnemonicGridInputs.length; i++) {
		const input = mnemonicGridInputs[i];
		if (input.parentElement.classList.contains('hidden')) { break; }
		const rndWord = getRandomWord(wordsList);
		mnemonic.push(rndWord);
		input.classList.add('random');

		for (let j = 0; j < rndWord.length; j++) { // simple typing animation
			input.placeholder += rndWord.charAt(j);
			if (!asPlaceholder) { input.value += rndWord.charAt(j); };
			const delay = settings.delayBeetweenChar;
			const timeOutRnd = rnd(0, delay);
			await new Promise(r => setTimeout(r, timeOutRnd));
		}
	};

	tempData.init();
	tempData.rndMnemonic = mnemonic;
	modal.mnemonicGrid.classList.remove('busy');
}
function getRandomWord(wordsList = []) {
	const wordsListLength = wordsList.length;
	if (wordsListLength === 0) { return; }

	const rnd = cryptoRnd(0, wordsListLength - 1);
	return wordsList[rnd];
}
function actualizeScore() {
	const mnemonicGridInputs = eHTML.modals.inputMasterMnemonic.mnemonicGridInputs;
	let nbOfRandomWords = 0;
	let nbOfWords = 0;
	for (let i = 0; i < mnemonicGridInputs.length; i++) {
		const input = mnemonicGridInputs[i];
		if (mnemonicGridInputs[i].value === "") { continue; }
		nbOfWords++;
		
		if (input.classList.contains('random')) { nbOfRandomWords++; }
	}
	if (nbOfWords === 0) { return; }
	
	// score will decrease more and more for each word choosen by the user
	const numberOfWordsInTheList = 2048;
	const maxEntropy = nbOfWords * Math.log2(numberOfWordsInTheList);
	const currentEntropy = nbOfRandomWords * Math.log2(numberOfWordsInTheList);
	const score = (currentEntropy / maxEntropy) * 100;
	
	// use of "random word" buttons will slightly decrease the score
	const rndButtonsPressed = tempData.rndButtonsPressed;
	const scoreDecrease = Math.pow(rndButtonsPressed, 2) / (nbOfWords * 1000);
	const finalScore = score - scoreDecrease < 0 ? 0 : score - scoreDecrease;

	setScoreUI(finalScore);
}
function isWordInWordsList(word, bip, language) {
	const wordsList = emptyMnemoLinker.getWordsTable(bip, language);
	if (!wordsList) { return false; }

	return wordsList.includes(word);
}
function focusNextInput(inputElement) {
	const mnemonicGrid = inputElement.parentElement.parentElement;
	const mnemonicGridInputs = mnemonicGrid.querySelectorAll('input');
	for (let i = 0; i < mnemonicGridInputs.length; i++) {
		const input = mnemonicGridInputs[i];
		if (input === inputElement) {
			const nextInput = mnemonicGridInputs[i + 1];
			if (nextInput) { nextInput.focus(); }
			break;
		}
	}
	return;
}
function extractMnemonicFromInputs(modal = eHTML.modals.inputMasterMnemonic) {
	const mnemonicGridInputs = modal.mnemonicGridInputs;
	const bip = "BIP-0039";
	const language = modal.randomizeBtn.classList[1];
	const wordsList = emptyMnemoLinker.getWordsTable(bip, language);
	if (!wordsList) { return; }

	const result = { allWordsAreValid: true, mnemonic: new mnemonicObject() };
	const mnemonic = [];
	for (let i = 0; i < mnemonicGridInputs.length; i++) {
		const input = mnemonicGridInputs[i];
		if (input.parentElement.classList.contains('hidden')) { continue; }

		mnemonic.push(input.value);
	};

	// check if all words are included in the words list
	for (let i = 0; i < mnemonic.length; i++) {
		if (!wordsList.includes(mnemonic[i])) { result.allWordsAreValid = false; break; }
	}

	result.mnemonic = new mnemonicObject(mnemonic, bip, language);

	return result;
}
//#endregion

//#region -  OLD FUNCTIONS - WILL BE DELETED
function setActiveForm(formIndex) {
	parkour.currentForm = formIndex;
	const nbOfForms = eHTML.forms.length;
	for (let i = 0; i < nbOfForms; i++) {
		if (i < formIndex) {
			setFormPosition(eHTML.forms[i].wrap, 'left');
		} else if (i > formIndex) {
			setFormPosition(eHTML.forms[i].wrap, 'right');
		} else {
			setFormPosition(eHTML.forms[i].wrap, 'center');
		}
	}
}
/**
 * Set the position of a form (left, center, right)
 * @param {HTMLElement} formElmnt
 * @param {string} position - 'left' || 'center' || 'right'
 */
function setFormPosition(formElmnt, position = 'left') {
    const defaultAnimation = {
        translateY: '-50%',
        skewX: '1.2deg',
        duration: 500
    };

    const specificAnimations = {
        center: {
            translateX: '0%',
            rotateY: '0deg',
            opacity: 1,
            delay: 300,
            easing: 'easeOutElastic(1.4, .8)',
        },
        left: {
            translateX: '-60%',
            rotateY: '-90deg',
            opacity: 0.2,
            easing: 'easeInOutQuad'
        },
        right: {
            translateX: '60%',
            rotateY: '90deg',
            opacity: 0.2,
            easing: 'easeInOutQuad'
        }
    };
    
    const animation = {
        targets: formElmnt,
        ...defaultAnimation,
        ...specificAnimations[position]
    };
    
    anime(animation);
}
async function fillMnemonicInputs(wrapInputsElmnts, mnemonic = [], setReadOnly = false) {
	if (setReadOnly) {
		wrapInputsElmnts.forEach((input) => {
			input.readOnly = true;
			input.placeholder = ""; 
		});
	}

	const mnemonicGridWrap = eHTML.forms[2].mnemonicGrid.parentElement;
	const mnemonicGridRect = mnemonicGridWrap.getBoundingClientRect();

	// wait form to be visible
	await new Promise(r => setTimeout(r, 500));
	// fill one char by loop
	for (let i = 0; i < mnemonic.length; i++) {
		const word = mnemonic[i];
		const input = wrapInputsElmnts[i];

		// scroll if needed 
		const inputRect = input.getBoundingClientRect();
		if (inputRect.top < mnemonicGridRect.top) { mnemonicGridWrap.scrollTop -= mnemonicGridRect.top - inputRect.top; }
		if (inputRect.bottom > mnemonicGridRect.bottom) { mnemonicGridWrap.scrollTop += inputRect.bottom - mnemonicGridRect.bottom; }
		
		for (let j = 0; j < word.length; j++) {
			const nextChar = word.charAt(j);
			input.value += nextChar;

			const delay = rnd(0, settings.delayBeetweenChar);
			await new Promise(r => setTimeout(r, delay));
		}
	}

	switchContinueBtnIfMnemonicIsControlled();

	console.log(`fillMnemonicInputs done`);
}
function initMnemonicInputs(wrapInputsElmnts, readOnly = false) {
	wrapInputsElmnts.forEach((input) => {
		input.value = "";
		input.readOnly = readOnly;
		input.placeholder = "";
		input.classList.remove('valid');
		input.classList.add('random');
		input.classList.add('disabled');
	});
}
async function clearMnemonicInputs(wrapInputsElmnts, instantMode = false) {
	if (instantMode) { wrapInputsElmnts.forEach((input) => { input.value = ""; }); return }

	function isEmpty() {
		for (let i = 0; i < wrapInputsElmnts.length; i++) {
			if (wrapInputsElmnts[i].value !== "") { return false; }
		}
		return true;
	}

	// remove one char by loop
	while (!isEmpty()) {
		const wordIndex = rnd(0, wrapInputsElmnts.length - 1);
		if (wrapInputsElmnts[wordIndex].value === "") { continue; }

		wrapInputsElmnts[wordIndex].value = wrapInputsElmnts[wordIndex].value.slice(0, -1);

		const timeOutRnd = rnd(0, settings.delayBeetweenChar);
		await new Promise(r => setTimeout(r, timeOutRnd));
	}
}
function setMnemonicInputsVisibility(mnemonicGridElmnt, mnemonicLength) {
	console.log(`setMnemonicInputsVisibility: ${mnemonicLength}`);
	const inputWrapElmnts = mnemonicGridElmnt.getElementsByClassName('wordInputWrap');
	for (let i = 0; i < inputWrapElmnts.length; i++) {
		if (i < mnemonicLength) {
			inputWrapElmnts[i].classList.remove('hidden');
		} else {
			inputWrapElmnts[i].classList.add('hidden');
		}
	}
}
function getInputIndex(input) {
	for (let i = 0; i < eHTML.forms[2].mnemonicGridInputs.length; i++) {
		if (eHTML.forms[2].mnemonicGridInputs[i] === input) { return i; }
	}

	for (let i = 0; i < eHTML.forms[1].mnemonicGridInputs.length; i++) {
		if (eHTML.forms[1].mnemonicGridInputs[i] === input) { return i; }
	}

	return -1;
}
function fillBottomInfo(text, timeout = 5000) {
	// reset bottom info
	for (let i = 0; i < eHTML.forms.length; i++) {
		eHTML.forms[i].bottomInfo.innerText = "";
	}

	const formIndex = parkour.currentForm;
	const bottomInfo = eHTML.forms[formIndex].bottomInfo;
	bottomInfo.innerText = text;

	setTimeout(() => {
		bottomInfo.innerText = "";
	}, timeout);
}
function getMnemonicFromInputs() {
	const wordsList = emptyMnemoLinker.getWordsTable(userInfo.mnemonicBip, userInfo.mnemonicLanguage);
	if (!wordsList) { return; }

	const result = { allWordsAreValid: true, mnemonic: [], mnemonicStr: "" };
	const mnemonic = [];
	for (let i = 0; i < eHTML.forms[2].mnemonicGridInputs.length; i++) {
		const input = eHTML.forms[2].mnemonicGridInputs[i];
		if (input.parentElement.classList.contains('hidden')) { continue; }

		mnemonic.push(input.value);
	};

	// check if all words are included in the words list
	for (let i = 0; i < mnemonic.length; i++) {
		if (!wordsList.includes(mnemonic[i])) { result.allWordsAreValid = false; break; }
	}

	result.mnemonic = mnemonic;

	return result;
}
function switchContinueBtnIfMnemonicIsControlled() {
	const continueBtn = eHTML.forms[2].continueBtn;
	const copyBtn = eHTML.forms[2].copyMnemonicBtn;
	const downloadBtn = eHTML.forms[2].downloadMnemonicBtn;
	const mnemonicFromInputs = getMnemonicFromInputs();

	if (!mnemonicFromInputs.allWordsAreValid || !userInfo.setMnemonic(mnemonicFromInputs.mnemonic)) {
		continueBtn.classList.add('disabled');
		copyBtn.classList.add('crushed');
		downloadBtn.classList.add('crushed');
		return false;
	}

	continueBtn.classList.remove('disabled');
	copyBtn.classList.remove('crushed');
	downloadBtn.classList.remove('crushed');

	copyBtn.focus();

	return true;
}
// form2: pseudo mnemonic specific functions
function setPseudoMnemonicOptionsList() {
	// BIP LIST
	const defaultBip = settings.defaultBip;
	userInfo.pseudoMnemonicBip = defaultBip;
	// const bipList = eHTML.forms[1].bipList;

	// LANGUAGE LIST
	const languages = emptyMnemoLinker.getAvailableLanguages();
	const languageList = eHTML.forms[1].languageList;
	languageList.innerHTML = "";
	for (let i = 0; i < languages.length; i++) {
		const language = languages[i];
		const newElmnt = document.createElement('option');
		newElmnt.value = language;
		newElmnt.innerText = language;
		languageList.appendChild(newElmnt);
	}

	const defaultLanguage = settings.defaultLanguage;
	const defaultLanguageIndex = languages.indexOf(defaultLanguage);
	languageList.selectedIndex = defaultLanguageIndex;
	userInfo.pseudoMnemonicLanguage = defaultLanguage;

	// LENGTH LIST
	const lengthList = eHTML.forms[1].lengthList;
	lengthList.innerHTML = "";
	// const authorizedLengths = userInfo.mnemonic.length === 12 ? [12] : [12, 24];
	const authorizedLengths = [12];
	for (let i = 0; i < authorizedLengths.length; i++) {
		const length = authorizedLengths[i];
		const newElmnt = document.createElement('option');
		newElmnt.value = length;
		newElmnt.innerText = `${length} words`;
		lengthList.appendChild(newElmnt);
	}

	lengthList.selectedIndex = 0;
	setMnemonicInputsVisibility(eHTML.forms[1].mnemonicGrid, authorizedLengths[0]);
}
function isWordInPseudoWordsList(word) {
	const bip = userInfo.pseudoMnemonicBip;
	const language = userInfo.pseudoMnemonicLanguage;
	const wordsList = emptyMnemoLinker.getWordsTable(bip, language);
	if (!wordsList) { return false; }

	return wordsList.includes(word);
}
/*function focusNextInput(inputElement) {
	const mnemonicGrid = input.parentElement.parentElement;
	const mnemonicGridInputs = mnemonicGrid.querySelectorAll('input');
	for (let i = 0; i < mnemonicGridInputs.length; i++) {
		const input = mnemonicGridInputs[i];
		if (input === inputElement) {
			const nextInput = mnemonicGridInputs[i + 1];
			if (nextInput) { nextInput.focus(); }
			break;
		}
	}
	return;
}*/
function getPseudoMnemonicFromInputs() {
	const wordsList = emptyMnemoLinker.getWordsTable(userInfo.pseudoMnemonicBip, userInfo.pseudoMnemonicLanguage);
	if (!wordsList) { return; }

	const result = { allWordsAreValid: true, mnemonic: [], mnemonicStr: "", nbOfRandomWords: 0 };
	const mnemonic = [];
	for (let i = 0; i < eHTML.forms[1].mnemonicGridInputs.length; i++) {
		const input = eHTML.forms[1].mnemonicGridInputs[i];
		if (input.parentElement.classList.contains('hidden')) { continue; }

		const isRandom = input.classList.contains('random');
		if (isRandom) { result.nbOfRandomWords++; }
		
		mnemonic.push(input.value);
	};

	// check if all words are included in the words list
	for (let i = 0; i < mnemonic.length; i++) {
		if (!wordsList.includes(mnemonic[i])) { result.allWordsAreValid = false; break; }
	}

	result.mnemonic = mnemonic;
	result.mnemonicStr = mnemonic.join(' ');
	return result;
}
function getRandomUniqueWord(wordsList = [], mnemonic = []) {
	const wordsListLength = wordsList.length;
	if (wordsListLength === 0) { return; }

	let remainingAttempts = 100;
	let rnd = cryptoRnd(0, wordsListLength - 1);
	let rndWord = wordsList[rnd];
	while (mnemonic.includes(rndWord)) {
		rnd = cryptoRnd(0, wordsListLength - 1);
		rndWord = wordsList[rnd];
		remainingAttempts--;
		if (remainingAttempts === 0) { console.error('No unique word found !'); return false; }
	}

	return rndWord;
}
async function randomizePseudoMnemonic(desiredLength, asPlaceholder = false) {
	eHTML.forms[1].mnemonicGrid.classList.add('busy');
	parkour.step1.rndButtonsPressed = 0;

	const bip = userInfo.pseudoMnemonicBip;
	const language = userInfo.pseudoMnemonicLanguage;
	const wordsList = emptyMnemoLinker.getWordsTable(bip, language);
	if (!wordsList) { return; }

	eHTML.forms[1].mnemonicGridInputs.forEach((input) => { input.value = ""; input.placeholder = "";  });

	const mnemonic = [];
	for (let i = 0; i < desiredLength; i++) {
		const input = eHTML.forms[1].mnemonicGridInputs[i];
		const rndWord = getRandomUniqueWord(wordsList, userInfo.pseudoMnemonic);
		mnemonic.push(rndWord);
		for (let j = 0; j < rndWord.length; j++) {
			/*const rndFakeChar = rnd(0, 5);
			// add fake char and remove it (from a to z, lowercase only) -> just a visual effect
			for (let k = 0; k < rndFakeChar; k++) {
				const fakeChar = String.fromCharCode(rnd(97, 122));
				if (asPlaceholder) { input.placeholder += fakeChar; } else { input.value += fakeChar; };
				await new Promise(r => setTimeout(r, settings.delayBeetweenChar));
				if (asPlaceholder) { input.placeholder = input.placeholder.slice(0, -1); } else { input.value = input.value.slice(0, -1); };
			}*/

			input.placeholder += rndWord.charAt(j);
			if (!asPlaceholder) { input.value += rndWord.charAt(j); };
			const delay = settings.delayBeetweenChar;
			const timeOutRnd = rnd(0, delay);
			await new Promise(r => setTimeout(r, timeOutRnd));
		}
		input.classList.add('random');
	};

	parkour.step1.rndMnemonic = mnemonic;
	switchContinueBtnIfPseudoMnemonicIsControlled();
	actualizeScore();
	eHTML.forms[1].mnemonicGrid.classList.remove('busy');
}
function switchContinueBtnIfPseudoMnemonicIsControlled() {
	const continueBtn = eHTML.forms[1].continueBtn;
	const copyBtn = eHTML.forms[1].copyMnemonicBtn;
	const downloadBtn = eHTML.forms[1].downloadMnemonicBtn;
	const mnemonicFromInputs = getPseudoMnemonicFromInputs();

	if (!mnemonicFromInputs.allWordsAreValid || !userInfo.setPseudoMnemonic(mnemonicFromInputs.mnemonic)) {
		continueBtn.classList.add('disabled');
		copyBtn.classList.add('crushed');
		downloadBtn.classList.add('crushed');
		return false; 
	}

	
	continueBtn.classList.remove('disabled');
	copyBtn.classList.remove('crushed');
	downloadBtn.classList.remove('crushed');

	copyBtn.focus();

	return true;
}
async function controlPseudoMnemonic() {
	if (skipper.form2Control) { return true; }

	await clearMnemonicInputs(eHTML.forms[1].mnemonicGridInputs);
	eHTML.forms[1].mnemonicGridInputs.forEach((input) => { input.classList.remove('disabled') });

	parkour["step1"].controllingMnemonic = true;
	const nbOfWordsToCheck = settings.nbOfWordsToCheck;
	let controlledWordsIndex = [];

	while(controlledWordsIndex.length < nbOfWordsToCheck) {
		const wordIndex = rnd(0, userInfo.pseudoMnemonic.length - 1);
		if (controlledWordsIndex.includes(wordIndex)) { continue; }
		
		const correspondingInput = eHTML.forms[1].mnemonicGridInputs[wordIndex];
		correspondingInput.placeholder = "???";
		correspondingInput.readOnly = false;
		correspondingInput.focus();

		while (parkour.currentForm === 2 && !userInfo.pseudoMnemonic.includes(correspondingInput.value)) {
			await new Promise(r => setTimeout(r, 100));
			if (!parkour["step1"].controllingMnemonic) { console.log('controlPseudoMnemonic aborted'); return false; }
		}
		if (parkour.currentForm !== 2) { console.log('controlPseudoMnemonic aborted'); return false; }

		controlledWordsIndex.push(wordIndex);
		correspondingInput.value = "";
		correspondingInput.placeholder = "✓";
		correspondingInput.readOnly = true;
		deleteExistingSuggestionsHTML();
	}

	parkour["step1"].controllingMnemonic = false;
	parkour["step1"].controlledMnemonic = true;
	return true;
}
// form3: MnemoLink specific functions
async function fillMnemoLinkText(mnemoLinkStr = '', initDelay = 500, animationDuration = 2500) {
	const mnemoLinkStrElmnt = eHTML.forms[3].mnemoLinkStr;
	const mnemoLinkWrapElmnt = eHTML.forms[3].mnemoLinkWrap;

	const mixingOperations = 6;
	const durations = {
		delay: animationDuration * 0.2,
		mixDuration: animationDuration * 0.5,
		showDuration: animationDuration * 0.3,
		mixing: animationDuration * 0.7 / mixingOperations
	};
	const wordsListA = emptyMnemoLinker.getWordsTable(userInfo.mnemonicBip, userInfo.mnemonicLanguage);
	const wordsListB = emptyMnemoLinker.getWordsTable(userInfo.pseudoMnemonicBip, userInfo.pseudoMnemonicLanguage);
	mnemoLinkStrElmnt.innerText = wordsListA.join(' ');

	await new Promise(r => setTimeout(r, initDelay));
	
	setTimeout(() => {
		anime({
			targets: mnemoLinkWrapElmnt,
			width: '0%',
			opacity: .6,
			duration: durations.mixDuration,
			easing: 'easeInOutQuad',
			complete: () => {
				anime({
					targets: mnemoLinkWrapElmnt,
					width: '100%',
					opacity: 1,
					duration: durations.showDuration,
					easing: 'easeInOutQuad',
				});
			}
		});
	}, durations.delay);

	function genMixedWordsList() {
		const desiredLength = wordsListA.length;
		const mixedWordsList = [];
		for (let i = 0; i < desiredLength; i++) {
			const list = rnd(0, 1) === 0 ? wordsListA : wordsListB;
			const rndIndex = rnd(0, list.length - 1);
			mixedWordsList.push(list[rndIndex]);
		}
		return mixedWordsList;
	}

	for (let i = 0; i < mixingOperations; i++) {
		const mixedWordsList = genMixedWordsList();
		mnemoLinkStrElmnt.innerText = mixedWordsList.join(' ');
		await new Promise(r => setTimeout(r, durations.mixing));
	}

	mnemoLinkStrElmnt.innerText = mnemoLinkStr;

	await new Promise(r => setTimeout(r, durations.mixDuration - initDelay > 0 ? durations.mixDuration - initDelay : 0));

	return true;
}
function switchMnemoLinkButtons() {
	const copyBtn = eHTML.forms[3].copyMnemoLinkBtn;
	const downloadBtn = eHTML.forms[3].downloadMnemoLinkBtn;
	//const inscribeBtn = eHTML.forms[3].inscribeBtn;

	copyBtn.classList.remove('crushed');
	downloadBtn.classList.remove('crushed');

	copyBtn.focus();

	return true;
}
//#endregion

//#region - UX FUNCTIONS
function toggleDashboard() {
	const dashboard = eHTML.dashboard.element;
	if (dashboard.classList.contains('open')) { 
		dashboard.classList.remove('open');
	} else {
		dashboard.classList.add('open');
	}
}
function openModal(modalName = '') {
	const modals = eHTML.modals;
	if (!modals.wrap.classList.contains('fold')) { return; }
	modals.wrap.classList.remove('hidden');
	modals.wrap.classList.remove('fold');

	for (let modalKey in modals) {
		if (modalKey === 'wrap') { continue; }
		const modalWrap = modals[modalKey].wrap;
		modalWrap.classList.add('hidden');
		if (modalKey === modalName) { modalWrap.classList.remove('hidden'); }
	}

	const modalsWrap = eHTML.modals.wrap;
	modalsWrap.style.transform = 'scaleX(0) scaleY(0) skewX(0deg)';
	modalsWrap.style.opacity = 0;
	modalsWrap.style.clipPath = 'circle(6% at 50% 50%)';

	anime({
		targets: modalsWrap,
		//skewX: '1.2deg',
		scaleX: 1,
		scaleY: 1,
		opacity: 1,
		duration: 600,
		easing: 'easeOutQuad',
		complete: () => {
			if (modalName === 'inputMasterMnemonic' || modalName === 'inputMnemonic') {
				eHTML.modals[modalName].mnemonicGridInputs[0].focus();
			}
		}
	});
	anime({
		targets: modalsWrap,
		clipPath: 'circle(100% at 50% 50%)',
		delay: 200,
		duration: 800,
		easing: 'easeOutQuad',
	});
}
function closeModal() {
	// clear inputs
	initMnemonicInputs(eHTML.modals.inputMasterMnemonic.mnemonicGridInputs);
	initMnemonicInputs(eHTML.modals.inputMnemonic.mnemonicGridInputs);

	const modalsWrap = eHTML.modals.wrap;
	if (modalsWrap.classList.contains('fold')) { return false; }
	modalsWrap.classList.add('fold');

	anime({
		targets: modalsWrap,
		clipPath: 'circle(6% at 50% 50%)',
		duration: 600,
		easing: 'easeOutQuad',
	});
	anime({
		targets: modalsWrap,
		scaleX: 0,
		scaleY: 0,
		opacity: 0,
		duration: 800,
		easing: 'easeOutQuad',
		complete: () => {
			if (!modalsWrap.classList.contains('fold')) { return; }

			modalsWrap.classList.add('hidden');
			const modals = eHTML.modals;
			for (let modalKey in modals) {
				if (modalKey === 'wrap') { continue; }
				const modalWrap = modals[modalKey].wrap;
				modalWrap.classList.add('hidden');
			}
		}
	});
}
function setScoreUI (score = 100) {
	const modal = eHTML.modals.inputMasterMnemonic;
	modal.scoreBarFill.style.width = `${Math.round(score)}%`;
	modal.scoreLabel.innerText = `${score.toFixed(2)}%`;

	// glitch / checking effect
	modal.scoreBarFill.classList.add('glitch');
	setTimeout(() => { modal.scoreBarFill.classList.remove('glitch'); }, 500);
}
function setModalBottomButtonsState(modal = eHTML.modals.inputMasterMnemonic, ready = false) {
	const confirmBtn = modal.confirmBtn;
	const copyBtn = modal.copyMnemonicBtn;
	const downloadBtn = modal.downloadMnemonicBtn;

	if (!ready) {
		confirmBtn.classList.add('disabled');
		copyBtn.classList.add('crushed');
		downloadBtn.classList.add('crushed');
	} else {
		confirmBtn.classList.remove('disabled');
		copyBtn.classList.remove('crushed');
		downloadBtn.classList.remove('crushed');
	}
}
function switchBtnsIfMnemonicGridIsFilled(modalWrapID = "masterMnemonicModalWrap") {
	const modals = Object.keys(eHTML.modals);
	let modal = null;
	for (let i = 0; i < modals.length; i++) {
		if (!eHTML.modals[modals[i]]) { continue; }
		if (!eHTML.modals[modals[i]].wrap) { continue; }
		if (eHTML.modals[modals[i]].wrap.id === modalWrapID) { modal = eHTML.modals[modals[i]]; break; }
	}
	if (!modal) { 
		console.error('switchBtnsIfMnemonicGridIsFilled: modal not found');
		return { allWordsAreValid: false, mnemonic: new mnemonicObject() };
	}

	const extracted = extractMnemonicFromInputs(modal)

	if (!extracted.allWordsAreValid) {
		setModalBottomButtonsState(modal, false);
		return extracted;
	}

	setModalBottomButtonsState(modal, true);
	return extracted;
}
function deleteExistingSuggestionsHTML() {
	const suggestionsHTMLs = document.getElementsByClassName('suggestions');
	while (suggestionsHTMLs.length > 0) {
		suggestionsHTMLs[0].remove();
	}
}
function modalInfo(modal = eHTML.modals.inputMasterMnemonic, text, timeout = 5000) {
	// reset bottom info
	const infoElmnt = modal.bottomInfo;

	infoElmnt.innerText = text;

	setTimeout(() => {
		infoElmnt.innerText = "";
	}, timeout);
}
function createMnemoLinkElement(label = 'key1') {
	const newMnemoLink = document.createElement('div');
	newMnemoLink.classList.add('mnemolink');
	newMnemoLink.innerHTML = `
		<div class="leftDecoration"></div>
		<div class="deleteBtn"></div>
		<input class="mnemolinkInput" value="key1"></input>
	`;

	const mnemolinkInput = newMnemoLink.getElementsByClassName('mnemolinkInput')[0];
	mnemolinkInput.value = label;

	return newMnemoLink;
}
function fillMnemoLinkList() {
	eHTML.dashboard.mnemolinksList.innerHTML = ''

	const monemoLinksLabels = userData.getListOfMnemoLinks();
	for (let i = 0; i < monemoLinksLabels.length; i++) {
		const label = monemoLinksLabels[i];
		const element = createMnemoLinkElement(label);
		eHTML.dashboard.mnemolinksList.appendChild(element);
	}

	const linkNewMnemonicBtnWrap = document.createElement('div');
	linkNewMnemonicBtnWrap.id = "linkNewMnemonicBtnWrap";
	linkNewMnemonicBtnWrap.innerHTML = '<div id="linkNewMnemonicBtn">+</div>';
	eHTML.dashboard.mnemolinksList.appendChild(linkNewMnemonicBtnWrap);
}
function createMnemoLinkElement(label = 'key1') {
	const newMnemoLink = document.createElement('div');
	newMnemoLink.classList.add('mnemolink');
	newMnemoLink.innerHTML = `
		<div class="leftDecoration"></div>
		<div class="deleteBtn"></div>
		<input class="mnemolinkInput" value="key1"></input>
	`;

	const mnemolinkInput = newMnemoLink.getElementsByClassName('mnemolinkInput')[0];
	mnemolinkInput.value = label;

	return newMnemoLink;
}
/*function fillMnemoLinkBubblesWrap() {
	const mnemolinksBubblesWrap = eHTML.dashboard.mnemolinksBubblesContainer.children[0];
	const monemoLinksLabels = userData.getListOfMnemoLinks();
	for (let i = 0; i < monemoLinksLabels.length; i++) {
		const label = monemoLinksLabels[i];
		const element = createMnemoLinkBubbleElement(label);
		eHTML.dashboard.mnemolinksList.appendChild(element);
	}
}
function positionMnemoLinkBubbles() {
	//const radius = 150; // Rayon du cercle imaginaire
	const radius = window.innerHeight / 3;
	const mnemolinksBubblesContainer = eHTML.dashboard.mnemolinksBubblesContainer;
	const center_x = mnemolinksBubblesContainer.offsetWidth / 2;
	const center_y = mnemolinksBubblesContainer.offsetHeight / 2;
	const mnemoLinks = mnemolinksBubblesContainer.querySelectorAll('.mnemolinkBubble');
  
	mnemoLinks.forEach(function(mnemoLink, index) {
		const width = mnemoLink.offsetWidth;
		const total = mnemoLinks.length;
		const angle = (index / total) * (2 * Math.PI); // Angle for each element
		
		const x = center_x + radius * Math.cos(angle) - (width / 2);
		const y = center_y + radius * Math.sin(angle) - (width / 2);
	
		mnemoLink.style.left = x + 'px';
		mnemoLink.style.top = y + 'px';
	});
}*/
//#endregion

//#region - EVENT LISTENERS
document.getElementById("dark-mode-toggle").addEventListener('change', (event) => {
	toggleDarkMode(eHTML.toggleDarkModeButton)
	// save dark-mode state
	// localStorage.setItem('dark-mode', event.target.checked);
});
document.addEventListener('keydown', (event) => {
	// "tab key" result same as "enter key" for suggestions
	if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		const suggestionsHTML = document.getElementsByClassName('suggestions')[0];
		if (!suggestionsHTML) { return; }
		const activeSuggestion = suggestionsHTML.getElementsByClassName('active')[0];

		function scrollSuggestionToView(suggestion, mode = 'bottom') {
			const suggestionsRect = suggestionsHTML.getBoundingClientRect();
			const suggestionRect = suggestion.getBoundingClientRect();
			if (mode === 'bottom' && suggestionRect.bottom > suggestionsRect.bottom) {
				suggestionsHTML.scrollTop += 2 + suggestionRect.bottom - suggestionsRect.bottom;
			} else if (mode === 'top' && suggestionRect.top < suggestionsRect.top) {
				suggestionsHTML.scrollTop -= suggestionsRect.top - suggestionRect.top;
			}
		}

		switch (event.key) {
			case 'ArrowUp':
				if (!activeSuggestion) { return; }
				const previousSuggestion = activeSuggestion.previousElementSibling;
				if (!previousSuggestion) { return; }

				activeSuggestion.classList.remove('active');
				previousSuggestion.classList.add('active');
				scrollSuggestionToView(previousSuggestion, 'top');
				break;
			case 'ArrowDown':
				if (!activeSuggestion) { suggestionsHTML.getElementsByClassName('suggestion')[0].classList.add('active'); return; }
				const nextSuggestion = activeSuggestion.nextElementSibling;
				if (!nextSuggestion) { return; }

				activeSuggestion.classList.remove('active');
				nextSuggestion.classList.add('active');
				scrollSuggestionToView(nextSuggestion, 'bottom');
				break;
			case 'Tab':
			case 'Enter':
				/** @type {HTMLInputElement} */
				let input = null;
				try {
					input = activeSuggestion.parentElement.parentElement.getElementsByClassName('wordInput')[0];
				} catch (error) {
					if (event.target.classList.contains('wordInput')) { input = event.target; }
				};

				if (input === null) { return; }
				event.preventDefault();
				const modalWrap = input.parentElement.parentElement.parentElement.parentElement.parentElement
				if (!modalWrap || !modalWrap.id) { console.error('modalWrap not found'); return; }
				
				if (!activeSuggestion) {
					if (switchBtnsIfMnemonicGridIsFilled(modalWrap.id).allWordsAreValid) { return; }
					focusNextInput(input);
					return; 
				}

				input.value = activeSuggestion.innerText;
				deleteExistingSuggestionsHTML();
				
				if (modalWrap.id === eHTML.modals.inputMasterMnemonic.wrap.id) {
					if (tempData.rndMnemonic.includes(input.value)) { input.classList.add('random'); } else { input.classList.remove('random'); }
					actualizeScore();
				}

				if (switchBtnsIfMnemonicGridIsFilled(modalWrap.id).allWordsAreValid) { return; }
				focusNextInput(input);
		
				break;
			default:
				break;
		}
	}	
});
document.addEventListener('click', (event) => {
	//if (parkour.currentForm === -1) { setActiveForm(0); }
	if (event.target.classList.contains('suggestion')) { return; }
	if (event.target.classList.contains('suggestions')) { return; }
	deleteExistingSuggestionsHTML();

	if (event.target.id === 'linkNewMnemonicBtn') { openModal('inputMnemonic'); }
});
centerScreenBtn.addEventListener('click', async (event) => {
	if (!userData.isMasterMnemonicFilled()) {
		openModal('inputMasterMnemonic');
		await randomizeMnemonic(eHTML.modals.inputMasterMnemonic, true);
		eHTML.modals.inputMasterMnemonic.mnemonicGridInputs[0].focus();
		return;
	}

	// if master mnemonic is already filled
	toggleDashboard();
});
// MODAL : MASTER MNEMONIC
eHTML.modals.wrap.addEventListener('click', (event) => {
	if (event.target === eHTML.modals.wrap) { closeModal(); }
});
eHTML.modals.inputMasterMnemonic.previousLanguageBtn.addEventListener('click', async (event) => {
	if (eHTML.modals.inputMasterMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	const languageBtn = eHTML.modals.inputMasterMnemonic.randomizeBtn;
	const languages = emptyMnemoLinker.getAvailableLanguages();
	const currentLanguage = languageBtn.classList[1];
	const currentLanguageIndex = languages.indexOf(currentLanguage);
	const previousLanguageIndex = currentLanguageIndex === 0 ? languages.length - 1 : currentLanguageIndex - 1;
	const previousLanguage = languages[previousLanguageIndex];
	if (!previousLanguage) { console.error('previousLanguage not found'); return; }

	const initialClass = languageBtn.classList[0];
	languageBtn.classList = `${initialClass} ${previousLanguage}`;
	await randomizeMnemonic(eHTML.modals.inputMasterMnemonic, true);
	switchBtnsIfMnemonicGridIsFilled(eHTML.modals.inputMasterMnemonic.wrap.id);
	tempData.init();
	eHTML.modals.inputMasterMnemonic.mnemonicGridInputs[0].focus();
});
eHTML.modals.inputMasterMnemonic.nextLanguageBtn.addEventListener('click', async (event) => {
	if (eHTML.modals.inputMasterMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	const languageBtn = eHTML.modals.inputMasterMnemonic.randomizeBtn;
	const languages = emptyMnemoLinker.getAvailableLanguages();
	const currentLanguage = languageBtn.classList[1];
	const currentLanguageIndex = languages.indexOf(currentLanguage);
	const nextLanguageIndex = currentLanguageIndex === languages.length - 1 ? 0 : currentLanguageIndex + 1;
	const nextLanguage = languages[nextLanguageIndex];
	if (!nextLanguage) { console.error('nextLanguage not found'); return; }

	const initialClass = languageBtn.classList[0];
	languageBtn.classList = `${initialClass} ${nextLanguage}`;
	await randomizeMnemonic(eHTML.modals.inputMasterMnemonic, true);
	switchBtnsIfMnemonicGridIsFilled(eHTML.modals.inputMasterMnemonic.wrap.id);
	tempData.init();
	eHTML.modals.inputMasterMnemonic.mnemonicGridInputs[0].focus();
});
eHTML.modals.inputMasterMnemonic.randomizeBtn.addEventListener('click', async (event) => {
	if (eHTML.modals.inputMasterMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	await randomizeMnemonic(eHTML.modals.inputMasterMnemonic, false);
	actualizeScore();
	eHTML.modals.inputMasterMnemonic.mnemonicGridInputs[0].focus();

	const extracted = switchBtnsIfMnemonicGridIsFilled(eHTML.modals.inputMasterMnemonic.wrap.id);
	if (!extracted.allWordsAreValid) { return; }
	tempData.mnemonic = extracted.mnemonic;
});
eHTML.modals.inputMasterMnemonic.mnemonicGrid.addEventListener('input', (event) => {
	if (event.target.tagName !== 'INPUT') { return; }
	
	const modal = eHTML.modals.inputMasterMnemonic;
	const input = event.target;
	//const value = input.value.replace(/[^a-zA-Z]/g, '').toLowerCase();
	const value = input.value.toLowerCase();
	event.target.value = value;
	
	const bip = "BIP-0039";
	const language = modal.randomizeBtn.classList[1];
	const suggestions = emptyMnemoLinker.getSuggestions(value, bip, language);
	if (!suggestions) { return; }
	
	const extracted = switchBtnsIfMnemonicGridIsFilled(modal.wrap.id);
	if (suggestions.length === 1 && isWordInWordsList(suggestions[0], bip, language)) {
		event.target.value = suggestions[0];
		deleteExistingSuggestionsHTML();
		input.classList.add('random');
		actualizeScore();
		if (extracted.allWordsAreValid) { tempData.mnemonic = extracted.mnemonic; return; }
		focusNextInput(input);
		return;
	}

	function createSuggestionsHTML() {
		const newElmnt = document.createElement('div');
		newElmnt.classList.add('suggestions');
		if (getInputIndex(input) > 5) { newElmnt.classList.add('fromBottom'); } else { newElmnt.classList.add('fromTop'); }

		newElmnt.addEventListener('mouseover', (event) => {
			if (!event.target.classList.contains('suggestion')) { return; }
			//console.log(event.target.innerText);

			const activeSuggestion = newElmnt.getElementsByClassName('active')[0];
			if (activeSuggestion) { activeSuggestion.classList.remove('active'); }
			event.target.classList.add('active');
		});
		newElmnt.addEventListener('click', (event) => {
			if (!event.target.classList.contains('suggestion')) { return; }

			const activeSuggestion = newElmnt.getElementsByClassName('active')[0];
			if (!activeSuggestion) { return; }
			input.value = activeSuggestion.innerText;

			if (!isWordInWordsList(value, bip, language)) { console.error('word not in wordsList'); return; }

			deleteExistingSuggestionsHTML();
			if (tempData.rndMnemonic.includes(input.value)) { input.classList.add('random'); } else { input.classList.remove('random'); }
			actualizeScore()
			if (switchBtnsIfMnemonicGridIsFilled(modal.wrap.id).allWordsAreValid) { return; }
			focusNextInput(input);
			return;
		});

		input.parentElement.appendChild(newElmnt);
		return newElmnt;
	}

	const suggestionsHTML = input.parentElement.getElementsByClassName('suggestions')[0] || createSuggestionsHTML();
	suggestionsHTML.innerHTML = "";

	for (let i = 0; i < suggestions.length; i++) {
		const suggestionHTML = document.createElement('div');
		suggestionHTML.classList = 'suggestion';
		suggestionHTML.innerText = suggestions[i];
		if (i === 0) { suggestionHTML.classList.add('active'); }
		suggestionsHTML.appendChild(suggestionHTML);
	}
	input.parentElement.appendChild(suggestionsHTML);
});
eHTML.modals.inputMasterMnemonic.mnemonicGrid.addEventListener('click', (event) => {
	if (event.target.tagName === 'BUTTON') {
		const input = event.target.parentElement.querySelector('input');
		const bip = "BIP-0039";
		const language = eHTML.modals.inputMasterMnemonic.randomizeBtn.classList[1];
		const wordsList = emptyMnemoLinker.getWordsTable(bip, language);
		if (!wordsList) { return; }

		const inputValueIsInWordsList = wordsList.includes(input.value);
		if (inputValueIsInWordsList) { tempData.rndButtonsPressed++; }

		const rndWord = getRandomWord(wordsList);
		input.value = rndWord;
		input.classList.add('random');
		actualizeScore();

		const extracted = switchBtnsIfMnemonicGridIsFilled(eHTML.modals.inputMasterMnemonic.wrap.id);
		if (extracted.allWordsAreValid) { tempData.mnemonic = extracted.mnemonic; }
	}
});
eHTML.modals.inputMasterMnemonic.copyMnemonicBtn.addEventListener('click', (event) => {
	if (eHTML.modals.inputMasterMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	//const indexedMnemonicStr = tempData.mnemonic.getIndexedMnemonicStr();
	//if (!indexedMnemonicStr) { return; }
	const mnemonicStr = tempData.mnemonic.getMnemonicStr();
	if (!mnemonicStr) { return; }

	navigator.clipboard.writeText(mnemonicStr);
	modalInfo(eHTML.modals.inputMasterMnemonic, 'Mnemonic copied to clipboard');
});
eHTML.modals.inputMasterMnemonic.downloadMnemonicBtn.addEventListener('click', (event) => {
	if (eHTML.modals.inputMasterMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	const indexedMnemonicStr = tempData.mnemonic.getIndexedMnemonicStr();
	if (!indexedMnemonicStr) { return; }
	
	const blob = new Blob([indexedMnemonicStr], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = "master_mnemonic.txt";
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 0);
});
eHTML.modals.inputMasterMnemonic.confirmBtn.addEventListener('click', async (event) => {
	if (eHTML.modals.inputMasterMnemonic.confirmBtn.classList.contains('busy')) { return; }
	if (eHTML.modals.inputMasterMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	if (eHTML.modals.inputMasterMnemonic.confirmBtn.classList.contains('disabled')) { return; }

	const mnemonic = tempData.mnemonic.getMnemonicStr();
	if (!mnemonic) { console.error('mnemonic not found'); return; }

	eHTML.modals.inputMasterMnemonic.confirmBtn.classList.add('busy');

	await userData.setMnemonicAsEncrypted(mnemonic);
	await save.userEncryptedMnemonicsStr();
	tempData.init();
	
	closeModal();

	eHTML.modals.inputMasterMnemonic.confirmBtn.classList.remove('busy');
});
// MODAL : INPUT MNEMONIC - used to add a new mnemonic or show an existing one
eHTML.modals.inputMnemonic.wrap.addEventListener('click', (event) => {
	if (event.target === eHTML.modals.inputMnemonic.wrap) { closeModal(); }
});
eHTML.modals.inputMnemonic.nextLanguageBtn.addEventListener('click', async (event) => {
	const languageBtn = eHTML.modals.inputMnemonic.randomizeBtn;
	const languages = emptyMnemoLinker.getAvailableLanguages();
	const currentLanguage = languageBtn.classList[1];
	const currentLanguageIndex = languages.indexOf(currentLanguage);
	const nextLanguageIndex = currentLanguageIndex === languages.length - 1 ? 0 : currentLanguageIndex + 1;
	const nextLanguage = languages[nextLanguageIndex];
	if (!nextLanguage) { console.error('nextLanguage not found'); return; }

	const initialClass = languageBtn.classList[0];
	languageBtn.classList = `${initialClass} ${nextLanguage}`;
});
eHTML.modals.inputMnemonic.previousLanguageBtn.addEventListener('click', async (event) => {
	const languageBtn = eHTML.modals.inputMnemonic.randomizeBtn;
	const languages = emptyMnemoLinker.getAvailableLanguages();
	const currentLanguage = languageBtn.classList[1];
	const currentLanguageIndex = languages.indexOf(currentLanguage);
	const previousLanguageIndex = currentLanguageIndex === 0 ? languages.length - 1 : currentLanguageIndex - 1;
	const previousLanguage = languages[previousLanguageIndex];
	if (!previousLanguage) { console.error('previousLanguage not found'); return; }

	const initialClass = languageBtn.classList[0];
	languageBtn.classList = `${initialClass} ${previousLanguage}`;
});
eHTML.modals.inputMnemonic.randomizeBtn.addEventListener('click', async (event) => {
	if (eHTML.modals.inputMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	await randomizeMnemonic(eHTML.modals.inputMnemonic, false);

	const extracted = switchBtnsIfMnemonicGridIsFilled(eHTML.modals.inputMnemonic.wrap.id);
	if (!extracted.allWordsAreValid) { return; }
	tempData.mnemonic = extracted.mnemonic;
});
eHTML.modals.inputMnemonic.mnemonicGrid.addEventListener('input', (event) => {
	if (event.target.tagName !== 'INPUT') { return; }
	
	const modal = eHTML.modals.inputMnemonic;
	const input = event.target;
	//const value = input.value.replace(/[^a-zA-Z]/g, '').toLowerCase();
	const value = input.value.toLowerCase()
	event.target.value = value;
	
	let bip = "BIP-0039";
	let language = modal.randomizeBtn.classList[1];

	// try to find the language
	const extracted = switchBtnsIfMnemonicGridIsFilled(modal.wrap.id);
	const nonEmptyWords = extracted.mnemonic.mnemonic.filter(word => word.length > 0);
	if (nonEmptyWords.length > 2) {
		const extractedMnemonic = extracted.mnemonic.mnemonic;
		if (!extracted.allWordsAreValid && extractedMnemonic.length > 1) {
			const result = emptyMnemoLinker.getBIPTableFromMnemonic(extracted.mnemonic.mnemonic);
			const initialClass = modal.randomizeBtn.classList[0];
			const detectedLanguage = result.language ? result.language : result.bestLanguage;
			if (detectedLanguage !== language) {
				deleteExistingSuggestionsHTML();
				console.log(result.language ? `language is ${result.language}` : `language is probably ${result.bestLanguage}`);
				modal.randomizeBtn.classList = `${initialClass} ${detectedLanguage}`;
				language = detectedLanguage;
			}
		}
	}

	const suggestions = emptyMnemoLinker.getSuggestions(value, bip, language);
	if (!suggestions) { return; }

	function createSuggestionsHTML() {
		const newElmnt = document.createElement('div');
		newElmnt.classList.add('suggestions');
		if (getInputIndex(input) > 5) { newElmnt.classList.add('fromBottom'); } else { newElmnt.classList.add('fromTop'); }

		newElmnt.addEventListener('mouseover', (event) => {
			if (!event.target.classList.contains('suggestion')) { return; }

			const activeSuggestion = newElmnt.getElementsByClassName('active')[0];
			if (activeSuggestion) { activeSuggestion.classList.remove('active'); }
			event.target.classList.add('active');
		});
		newElmnt.addEventListener('click', (event) => {
			if (!event.target.classList.contains('suggestion')) { return; }

			const activeSuggestion = newElmnt.getElementsByClassName('active')[0];
			if (!activeSuggestion) { return; }
			input.value = activeSuggestion.innerText;

			if (!isWordInWordsList(value, bip, language)) { console.error('word not in wordsList'); return; }

			deleteExistingSuggestionsHTML();
			if (tempData.rndMnemonic.includes(input.value)) { input.classList.add('random'); } else { input.classList.remove('random'); }
			if (switchBtnsIfMnemonicGridIsFilled(modal.wrap.id).allWordsAreValid) { return; }
			focusNextInput(input);
			return;
		});

		input.parentElement.appendChild(newElmnt);
		return newElmnt;
	}

	const suggestionsHTML = input.parentElement.getElementsByClassName('suggestions')[0] || createSuggestionsHTML();
	suggestionsHTML.innerHTML = "";

	for (let i = 0; i < suggestions.length; i++) {
		const suggestionHTML = document.createElement('div');
		suggestionHTML.classList = 'suggestion';
		suggestionHTML.innerText = suggestions[i];
		if (i === 0) { suggestionHTML.classList.add('active'); }
		suggestionsHTML.appendChild(suggestionHTML);
	}
	input.parentElement.appendChild(suggestionsHTML);
});
eHTML.modals.inputMnemonic.copyMnemonicBtn.addEventListener('click', (event) => {
	if (eHTML.modals.inputMnemonic.mnemonicGrid.classList.contains('busy')) { return; }

	const mnemonic = tempData.mnemonic.getMnemonicStr();
	if (!mnemonic) { return; }

	navigator.clipboard.writeText(mnemonic);
	modalInfo(eHTML.modals.inputMnemonic, 'Mnemonic copied to clipboard');
});
eHTML.modals.inputMnemonic.downloadMnemonicBtn.addEventListener('click', (event) => {
	if (eHTML.modals.inputMnemonic.mnemonicGrid.classList.contains('busy')) { return; }

	const mnemonic = tempData.mnemonic.getMnemonicStr();
	if (!mnemonic) { return; }

	const blob = new Blob([mnemonic], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = "mnemonic.txt";
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 0);
});
eHTML.modals.inputMnemonic.confirmBtn.addEventListener('click', async (event) => {
	if (eHTML.modals.inputMnemonic.confirmBtn.classList.contains('busy')) { return; }
	if (eHTML.modals.inputMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	if (eHTML.modals.inputMnemonic.confirmBtn.classList.contains('disabled')) { return; }

	const mnemonic = tempData.mnemonic.getMnemonicStr();
	if (!mnemonic) { console.error('mnemonic not found'); return; }

	eHTML.modals.inputMnemonic.confirmBtn.classList.add('busy');

	const masterMnemonicStr = await userData.getMasterMnemonicStr();
	/** @type {MnemoLinkerLastest} */
	const mnemoLinker = new MnemoLinkerLastest( { pseudoMnemonic: masterMnemonicStr , mnemonic: mnemonic } );
	const mnemoLink = await mnemoLinker.encryptMnemonic();
	if (!mnemoLink) { console.error('Unable to create mnemoLink'); return; }

	userData.addMnemoLink(mnemoLink);
	await save.userMnemoLinks();
	fillMnemoLinkList();
	tempData.init();

	closeModal();

	eHTML.modals.inputMnemonic.confirmBtn.classList.remove('busy');
});
//#endregion
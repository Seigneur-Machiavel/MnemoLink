if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)
	const anime = require("./anime.min.js");
	//const bip39 = require('bip39');
	const bip39 = require("./bip39-3.1.0.js");
	const { MnemoLinker } = require("./MnemoLinker/MnemoLinker_v0.1.js");
	const { cryptoLight } = require("./cryptoLight.js");

}

document.addEventListener('DOMContentLoaded', function() {
	chrome.runtime.sendMessage({action: "getPassword"}, function(response) {
		if (response && response.password) {
			console.log(`Password received: ${JSON.stringify(response.password)}`)
			chrome.storage.local.get(['hashedPassword'], async function(result) {
				const { hash, saltBase64, ivBase64 } = result.hashedPassword;
				const res = await cryptoLight.init(response.password, saltBase64, ivBase64);
				if (res.hash !== hash) { 
					console.info('Wrong password, requesting authentication');
					openModal('authentification');
					return;
				}
				await asyncInitLoad(true);
			});
		} else {
			console.log('No password received, requesting authentication');
			openModal('authentification');
		}
	});
});

const urlprefix = ""
// Dont forget to use the "urlprefix" while fetching, example :
// .src = `${urlprefix}sprites/cloud`

//#region - CLASSES
class centerScreenBtnClass {
	constructor() {
		this.element = document.getElementById('centerScreenBtn');
	}
	show(speed = 200) {
		this.element.classList.remove('hidden');
		anime({
			targets: this.element,
			opacity: 1,
			duration: speed,
			easing: 'easeOutQuad',
			complete: () => { this.element.style.zIndex = 1; }
		});
	}
	hide(speed = 200) {
		anime({
			targets: this.element,
			opacity: 0,
			duration: speed,
			easing: 'easeOutQuad',
			complete: () => { this.element.style.zIndex = -1; this.element.classList.add('hidden'); }
		});
	}
}
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
		return true;
	}
	getListOfMnemoLinks() {
		return Object.keys(this.encryptedMnemoLinksStr);
	}
	replaceMnemoLinkLabel(oldLabel, newLabel, logs = false) {
		if (oldLabel === newLabel) { if (logs) { console.error('oldLabel and newLabel are the same !'); }; return false; }
		if (!this.encryptedMnemoLinksStr[oldLabel]) { if (logs) { console.error('oldLabel not found !'); }; return false; }

		const initialOrder = Object.keys(this.encryptedMnemoLinksStr);
		if (initialOrder.indexOf(newLabel) !== -1) { if (logs) { console.error('newLabel already exists !'); }; return false; }

		const newObject = {};
		for (let i = 0; i < initialOrder.length; i++) {
			const key = initialOrder[i];
			if (key === oldLabel) { newObject[newLabel] = this.encryptedMnemoLinksStr[oldLabel]; }
			else { newObject[key] = this.encryptedMnemoLinksStr[key]; }
		}
		this.encryptedMnemoLinksStr = newObject;

		return true;
	}
	getMnemoLinkEncrypted(label) {
		if (!this.encryptedMnemoLinksStr[label]) { return false; }
		return this.encryptedMnemoLinksStr[label];
	}
	async getMnemoLinkDecrypted(label, logs = false) {
		if (!this.encryptedMnemoLinksStr[label]) { if (logs) { console.error('label not found !'); return false; } }

		const mnemoLinkEncrypted = this.encryptedMnemoLinksStr[label];
		const dissected = emptyMnemoLinker.dissectMnemoLink(mnemoLinkEncrypted);
		const versionStr = `v${dissected.version.join(".")}`;

		let targetMnemoLinkerClass = await MnemoLinker[versionStr];
		if (!targetMnemoLinkerClass) { if (logs) { console.error('version not found !'); return false; } }

		const masterMnemonicStr = await this.getMasterMnemonicStr();
		if (!masterMnemonicStr) { if (logs) { console.error('masterMnemonicStr not found !'); return false; } }

		if (logs) { console.log(`versionStr: ${versionStr}`); }
		/** @type {MnemoLinker} */
		const targetMnemoLinker = new targetMnemoLinkerClass( { pseudoMnemonic: masterMnemonicStr } );
		const mnemoLinkDecrypted = await targetMnemoLinker.decryptMnemoLink(mnemoLinkEncrypted);
		if (!mnemoLinkDecrypted) { if (logs) { console.error('mnemoLinkDecrypted not found !'); return false; } }

		return mnemoLinkDecrypted;
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
class mnemoLinkBubbleObject {
	constructor(label, element, x = 0, y = 0) {
		/** @type {HTMLElement} */
		this.element = element;
		this.label = label;
		this.isShowing = false;
		
		this.x = x;
		this.y = y;
		this.vector = { x: 0, y: 0 };
		this.posSaved = { x: 0, y: 0 };
	}
	setPosition(x = 0, y = 0) {
		this.x = x;
		this.y = y;
		this.element.style.left = `${x}px`;
		this.element.style.top = `${y}px`;
	}
	updatePosition() {
		if ( this.isShowing ) { return; }
		this.setPosition(this.x + this.vector.x, this.y + this.vector.y);
	}
	toCenterScreen() {
		const x = window.innerWidth / 2;
		const y = window.innerHeight / 2;
		if (this.x === x && this.y === y) { return; }
		
		this.vector = { x: 0, y: 0 };
		this.posSaved = { x: this.x, y: this.y };
		centerScreenBtn.hide(240);
		anime({
			targets: this.element,
			left: "50%",
			top: "50%",
			duration: 240,
			easing: 'easeOutQuad',
		});
	}
	showMnemonicInBubble(label, mnemonicStr) {
		if (this.isShowing) { console.error('bubble already showing !'); return; }
		if (this.label !== label) { console.error('label mismatch !'); return; }
		
		// clear bubble
		this.element.innerHTML = '';
		this.element.classList.add('showing');
		this.isShowing = true;
	
		// title
		const emptyDiv = document.createElement('div');
		const titleH2 = document.createElement('h2');
		titleH2.innerText = label;
		emptyDiv.appendChild(titleH2);
		
		// mnemonic grid
		const gridHtml = document.createElement('div');
		gridHtml.classList.add('miniMnemonicGrid');
		const mnemonic = mnemonicStr.split(' ');
		mnemonic.forEach(word => {
			const wordDiv = document.createElement('div');
			wordDiv.innerText = word;
			gridHtml.appendChild(wordDiv);
		});
	
		emptyDiv.appendChild(gridHtml);
	
		// copy and download buttons
		emptyDiv.innerHTML += `<div class="buttonsWrap">
			<div class="copyBtn" id="bubbleCopyBtn">Copy</div>
			<div class="downloadBtn" id="bubbleDownloadBtn">Download</div>
		</div>`;
	
		emptyDiv.classList.add('mnemonicBubbleContent');
		this.element.appendChild(emptyDiv);
	}
	stopShowing() {
		if (!this.isShowing) { return; }
		centerScreenBtn.show(240);
		//this.element.classList.remove('showing');
		this.element.innerHTML = '';
		anime({
			targets: this.element,
			left: `${this.posSaved.x}px`,
			top: `${this.posSaved.y}px`,
			duration: 240,
			easing: 'easeOutQuad',
			complete: () => { 
				this.element.classList.remove('showing');
				this.isShowing = false;
			}
		});
		//this.isShowing = false;
	}
}
//#endregion

const hardcodedPassword = '123456'; // should be "" in production
//#region - VARIABLES
/** @type {MnemoLinker} */
let MnemoLinkerLastest = null;
/** @type {MnemoLinker} */
let emptyMnemoLinker = null;

const settings = {
	mnemoLinkerVersion: window.MnemoLinker.latestVersion,
	defaultBip: "BIP-0039",
	defaultLanguage: "english",
	nbOfWordsToCheck: 3,
	delayBeetweenChar: 10,
	fastFillMode: true,
	saveLogs: true,
	mnemolinkBubblesMinCircleSpots: 6,
}

const mousePos = { x: 0, y: 0 };
const timeOuts = {};
/** @type {mnemoLinkBubbleObject[]} */
let mnemoBubbles = [];
const centerScreenBtn = new centerScreenBtnClass();
const userData = new userDataClass();
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
		mnemolinksList: document.getElementById('mnemolinksList'),
		mnemolinksBubblesContainer: document.getElementById('mnemolinksBubblesContainer'),
	},
	modals: {
		wrap: document.getElementsByClassName('modalsWrap')[0],
		authentification: {
			wrap : document.getElementById('authentificationModalWrap'),
			modal: document.getElementById('authentificationModalWrap').getElementsByClassName('modal')[0],
			loginForm: document.getElementById('loginForm'),
			input: document.getElementById('authentificationModalWrap').getElementsByTagName('input')[0],
			button: document.getElementById('authentificationModalWrap').getElementsByTagName('button')[0],
		},
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
	}
}
eHTML.footerVersion.innerText = "v" + window.MnemoLinker.latestVersion;
//#endregion
eHTML.modals.authentification.input.value = hardcodedPassword;

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
		await this.storeDataLocally('encryptedMasterMnemonicsStr', masterMnemonicStr, save.logs);
	},
	async userMnemoLinks() {
		const data = userData.encryptedMnemoLinksStr;
		await this.storeDataLocally('encryptedMnemoLinksStr', data, save.logs);
	},
	async userPreferences() {
		const data = userData.preferences;
		await this.storeDataLocally('preferences', data, save.logs);
	},
	async storeDataLocally(key = "toto", data, logs = false) {
		try {
			const result = await chrome.storage.local.set({ [key]: data })
			console.log(result);
			if (logs) { console.log(`${key} stored, data: ${JSON.stringify(data)}`); }
		} catch (error) {
			if (logs) { console.error(`Error while storing ${key}, data: ${data}`); }
		}
	}
}
const load = {
	logs: true,
	async all() {
		console.log('Loading all data...');
		const loadFunctions = Object.keys(load).filter((key) => key !== "all" && key !== "logs");
		for (let i = 0; i < loadFunctions.length; i++) {
			const functionName = loadFunctions[i];
			await load[functionName](); // can be promises all, but actually fast.
		}
	},
	async userEncryptedMnemonicsStr() {
		const data = await this.getDataLocally('encryptedMasterMnemonicsStr')
		const logMsg = !data ? 'No encryptedMasterMnemonicsStr found !' : 'encryptedMasterMnemonicsStr loaded !';
		if (load.logs) { console.log(logMsg); }
		if (!data) { return; }

		userData.encryptedMasterMnemonicsStr = data;
	},
	async userMnemoLinks() {
		const data = await this.getDataLocally('encryptedMnemoLinksStr')
		const logMsg = !data ? 'No encryptedMnemoLinksStr found !' : 'encryptedMnemoLinksStr loaded !';
		if (load.logs) { console.log(logMsg); }
		if (!data) { return; }

		userData.encryptedMnemoLinksStr = data;
	},
	async userPreferences() {
		const data = await this.getDataLocally('preferences')
		const logMsg = !data ? 'No preferences found !' : 'Preferences loaded !';
		if (load.logs) { console.log(logMsg); }
		if (!data) { return; }

		userData.preferences = data;
	},
	async getDataLocally(key = "toto") {
		const fromStorage = await chrome.storage.local.get([key])
		if (!fromStorage[key]) { return false; }
		return fromStorage[key];
	}
}
//#endregion

//#region - PRELOAD FUNCTIONS
async function loadMnemoLinkerLatestVersion() {
	MnemoLinkerLastest = await window.MnemoLinker["v" + window.MnemoLinker.latestVersion];
	emptyMnemoLinker = new MnemoLinkerLastest();
	if (userData.preferences.darkMode) { eHTML.toggleDarkModeButton.checked = true; toggleDarkMode(eHTML.toggleDarkModeButton); }
}; loadMnemoLinkerLatestVersion();
function toggleDarkMode(element) {
	if (element.checked) {
		document.body.classList.add('dark-mode');
		eHTML.dashboard.element.classList.add('invertColors');
		eHTML.modals.wrap.classList.add('invertColors');
	} else {
		document.body.classList.remove('dark-mode');
		eHTML.dashboard.element.classList.remove('invertColors');
		eHTML.modals.wrap.classList.remove('invertColors');
	}

	userData.preferences.darkMode = element.checked;
	save.userPreferences();
}
//#endregion

//#region - WELCOME ANIMATIONS
const textWrapper = document.querySelector('.ml3');
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
setTimeout(async () => {
	//document.getElementById('appTitleWrap').classList.add('topScreen');
	document.getElementById('appTitle').getElementsByClassName('titleSufix')[0].classList.add('visible');
}, titleAnimationDuration.C);
//#endregion

//#region - SIMPLE FUNCTIONS
async function asyncInitLoad(logs = false) {
	await load.all();
	fillMnemoLinkList();
	initMnemoLinkBubbles();
	requestAnimationFrame(UXupdateLoop);
	if (logs) { console.log('Ready to decrypt!'); }
	return true;
};
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
function getInputIndex(input) {
	const masterMnemonicGridInputs = eHTML.modals.inputMasterMnemonic.mnemonicGridInputs;
	for (let i = 0; i < masterMnemonicGridInputs.length; i++) {
		if (masterMnemonicGridInputs[i] === input) { return i; }
	}

	const mnemonicGridInputs = eHTML.modals.inputMnemonic.mnemonicGridInputs;
	for (let i = 0; i < mnemonicGridInputs.length; i++) {
		if (mnemonicGridInputs[i] === input) { return i; }
	}

	return -1;
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
async function centerScreenBtnAction() {
	if (!cryptoLight.key) {
		openModal('authentification');
		return;
	}

	if (!userData.isMasterMnemonicFilled()) {
		openModal('inputMasterMnemonic');
		await randomizeMnemonic(eHTML.modals.inputMasterMnemonic, true);
		eHTML.modals.inputMasterMnemonic.mnemonicGridInputs[0].focus();
		return;
	}

	// if master mnemonic is already filled
	toggleDashboard();
}
function downloadStringAsFile(string, filename) {
	const blob = new Blob([string], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 0);
}
//#endregion

//#region - UX FUNCTIONS
function toggleDashboard() {
	const dashboard = eHTML.dashboard.element;
	const appTitleWrap = document.getElementById('appTitleWrap');
	if (dashboard.classList.contains('open')) { 
		dashboard.classList.remove('open');
		timeOuts["appTitleWrapVisible"] = setTimeout(() => { appTitleWrap.classList.add('visible'); }, 400);
	} else {
		dashboard.classList.add('open');
		// cancel the timeout to show the app title
		clearTimeout(timeOuts["appTitleWrapVisible"]);
		appTitleWrap.classList.remove('visible');
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
function initMnemonicInputs(wrapInputsElmnts, readOnly = false) {
	//console.log(`initMnemonicInputs: ${wrapInputsElmnts.length}`);
	wrapInputsElmnts.forEach((input) => {
		input.value = "";
		input.readOnly = readOnly;
		input.placeholder = "";
		input.classList.remove('valid');
		input.classList.add('random');
		input.classList.add('disabled');
	});
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
		<div class="showBtn"></div>
		<div class="editBtn"></div>
		<input class="mnemolinkInput" value="${label}" defaultValue="${label}" readonly></input>
	`;

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
function createMnemoLinkBubbleElement() {
	const newMnemoLink = document.createElement('div');
	newMnemoLink.classList.add('mnemolinkBubble');
	
	return newMnemoLink;
}
function initMnemoLinkBubbles(intRadiusInFractionOfVH = 0.054, angleDecay = -1.5) {
	const radius = window.innerHeight * intRadiusInFractionOfVH;
	const center_x = mnemolinksBubblesContainer.offsetWidth / 2;
	const center_y = mnemolinksBubblesContainer.offsetHeight / 2;
	
	const mnemolinksBubblesWrap = eHTML.dashboard.mnemolinksBubblesContainer.children[0];
	mnemolinksBubblesWrap.innerHTML = '';
	const monemoLinksLabels = userData.getListOfMnemoLinks();
	const total = settings.mnemolinkBubblesMinCircleSpots > monemoLinksLabels.length ? settings.mnemolinkBubblesMinCircleSpots : monemoLinksLabels.length;
	
	mnemoBubbles = [];
	for (let i = 0; i < monemoLinksLabels.length; i++) {
		const element = createMnemoLinkBubbleElement();
		mnemolinksBubblesWrap.appendChild(element);

		const angle = (i / total) * (2 * Math.PI) + angleDecay; // Angle for each element
		
		const x = center_x + radius * Math.cos(angle);
		const y = center_y + radius * Math.sin(angle);

		const mnemoLinkBubbleObj = new mnemoLinkBubbleObject(monemoLinksLabels[i], element, x, y);
		mnemoBubbles.push(mnemoLinkBubbleObj);
	}
}
function positionMnemoLinkBubbles(intRadiusInFractionOfVH = 0.054, extRadiusInFractionOfVH = 0.3, centerMagnet = true) {
	const isModalOpen = !eHTML.modals.wrap.classList.contains('fold');
	//intRadiusInFractionOfVH = 0.084
	const isDashboardOpen = eHTML.dashboard.element.classList.contains('open');
	let circleRadius = window.innerHeight * (isDashboardOpen ? extRadiusInFractionOfVH : intRadiusInFractionOfVH);
	if (isModalOpen) { circleRadius *= 0.5; }
	const maxSpeed = .1;
	const mnemolinksBubblesContainer = eHTML.dashboard.mnemolinksBubblesContainer;
	const center_x = mnemolinksBubblesContainer.offsetWidth / 2;
	const center_y = mnemolinksBubblesContainer.offsetHeight / 2;
	
	for (let i = 0; i < mnemoBubbles.length; i++) {
		/** @type {mnemoLinkBubbleObject} */
		const  mnemoBubble = mnemoBubbles[i];

		const isOutCircle = Math.sqrt((mnemoBubble.x - center_x) ** 2 + (mnemoBubble.y - center_y) ** 2) > circleRadius;
		const remainingDistance = Math.sqrt((mnemoBubble.x - center_x) ** 2 + (mnemoBubble.y - center_y) ** 2) + ( isOutCircle ? -circleRadius : circleRadius );

		const dx = isOutCircle ? center_x - mnemoBubble.x : mnemoBubble.x - center_x;
		const dy = isOutCircle ? center_y - mnemoBubble.y : mnemoBubble.y - center_y;
		const angle = Math.atan2(dy, dx);
		const isOppositeSpeed = Math.sign(mnemoBubble.vector.x) !== Math.sign(dx) || Math.sign(mnemoBubble.vector.y) !== Math.sign(dy);
		
		let speed = Math.min(maxSpeed, Math.sqrt(dx * dx + dy * dy) * 0.1);
		speed = isOppositeSpeed ? Math.sqrt(speed, 1.68) : speed;

		let speedMultiplicator = rnd(.9, 1) * ( isOutCircle ? (remainingDistance / circleRadius * 8) : (remainingDistance / circleRadius * 1) );
		if (isDashboardOpen) {
			//speedMultiplicator = isOutCircle && remainingDistance < .02 ? Math.pow(speedMultiplicator, .1) : speedMultiplicator;
			speedMultiplicator = isOutCircle ? Math.pow(speedMultiplicator, .1) : speedMultiplicator;
		} else {
			speedMultiplicator = 2;
		}

		mnemoBubble.vector.x += Math.cos(angle) * speed * speedMultiplicator;
		mnemoBubble.vector.y += Math.sin(angle) * speed * speedMultiplicator;

		// stop bubbles when they are in the center
		if (centerMagnet && !isDashboardOpen && !isOutCircle) {
			mnemoBubble.vector.x = 0;
			mnemoBubble.vector.y = 0;
		}
		
		mnemoBubble.updatePosition()
	};
}
function clearMnemonicBubbleShowing() {
	mnemoBubbles.forEach((mnemoBubble) => {
		mnemoBubble.stopShowing();
	});

	// reset showBtns
	const showBtns = document.getElementsByClassName('showBtn');
	for (let i = 0; i < showBtns.length; i++) {
		showBtns[i].classList.remove('showing');
	}
}
async function UXupdateLoop() {
	positionMnemoLinkBubbles();

	requestAnimationFrame(UXupdateLoop);
}
//#endregion

//#region - EVENT LISTENERS
eHTML.modals.authentification.loginForm.addEventListener('submit', function(e) {
	e.preventDefault();

	const input = eHTML.modals.authentification.input;
	let password = input.value;
	if (password === '') { return; }
	
	chrome.storage.local.get(['hashedPassword'], async function(result) {
		const { hash, saltBase64, ivBase64 } = result.hashedPassword;
		const res = await cryptoLight.init(password, saltBase64, ivBase64);

		if (res.hash !== hash) { 
			input.classList.add('wrong');
			return;
		}

		password = null;
		input.value = '';
		await asyncInitLoad(true);
		closeModal();

		await centerScreenBtnAction();
	});
});
eHTML.modals.authentification.input.addEventListener('input', function(e) {
	const input = e.target;
	if (input.classList.contains('wrong')) { input.classList.remove('wrong'); }
});
document.addEventListener('mousemove', (event) => {
	mousePos.x = event.clientX;
	mousePos.y = event.clientY;
});
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
	const isTargetSuggestion = event.target.classList.contains('suggestion') || event.target.classList.contains('suggestions');
	if (!isTargetSuggestion) {
		deleteExistingSuggestionsHTML();
		if (event.target.id === 'linkNewMnemonicBtn') { openModal('inputMnemonic'); }
	}

	const isTargetBubbleOrShowBtn = event.target.classList.contains('mnemolinkBubble') || event.target.classList.contains('showBtn');
	if (!isTargetBubbleOrShowBtn) {
		/** @type {mnemoLinkBubbleObject} */
		const bubbleShowing = mnemoBubbles.find((mnemoBubble) => mnemoBubble.isShowing);
		if (!bubbleShowing) { return; }
		
		const mnemolinkBubble = bubbleShowing.element;
		function getMnemonicFromBubble() {
			const gridChildren = mnemolinkBubble.querySelector('.miniMnemonicGrid').children;
			let mnemonicStr = '';
			for (let i = 0; i < gridChildren.length; i++) {
				mnemonicStr += gridChildren[i].innerText + ' ';
			}
			return mnemonicStr;
		}
		const mnemolinkBubbleCopyBtn = document.getElementById('bubbleCopyBtn');
		if (event.target === mnemolinkBubbleCopyBtn) {
			const mnemonic = getMnemonicFromBubble();
			navigator.clipboard.writeText(mnemonic);
			anime({
				targets: mnemolinkBubbleCopyBtn,
				scale: 1.1,
				duration: 100,
				direction: 'alternate',
				easing: 'easeInOutSine',
			});
			return;
		}
			
		const mnemolinkBubbleDownloadBtn = document.getElementById('bubbleDownloadBtn');
		if (event.target === mnemolinkBubbleDownloadBtn) {
			const mnemonic = getMnemonicFromBubble();
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
			anime({
				targets: mnemolinkBubbleDownloadBtn,
				scale: 1.1,
				duration: 100,
				direction: 'alternate',
				easing: 'easeInOutSine',
			});
			return;
		}
		
		let element = event.target;
		for (let i = 0; i < 4; i++) {
			if (!element) { break; }
			if (element === mnemolinkBubble) { return; }
			element = element.parentElement;
		}

		console.log('close bubble');
		clearMnemonicBubbleShowing();
	}
});
centerScreenBtn.element.addEventListener('click', async (event) => { await centerScreenBtnAction(); });
// DASHBOARD : MNEMOLINKS LIST
document.addEventListener('mousedown', (event) => {
	if (!event.target.classList.contains('mnemolinkInput')) { return; }
	event.preventDefault();
});
document.addEventListener('focusout', (event) => {
	// correspond to the "eHTML.dashboard.mnemolinksList" event listener, but work better using "document" event listener
	// console.log(`focusout: ${event.target.tagName}`);
	if (!event.target.classList.contains('mnemolinkInput')) { return; }

	const mnemolinkInput = event.target;
	const editBtn = mnemolinkInput.parentElement.getElementsByClassName('editBtn')[0];
	const rect = editBtn.getBoundingClientRect();
	const x = mousePos.x;
	const y = mousePos.y;
	if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) { return; }

	const value = mnemolinkInput.value;
	if (value !== "" && userData.replaceMnemoLinkLabel(mnemolinkInput.defaultValue, value, true)) {
		mnemolinkInput.defaultValue = value;
		fillMnemoLinkList();
		initMnemoLinkBubbles();
	}
	
	editBtn.classList.remove('trash');
	mnemolinkInput.readOnly = true;
});
eHTML.dashboard.mnemolinksList.addEventListener('mouseover', (event) => {
	mnemoBubbles.forEach((bubble) => { bubble.element.classList.remove('hoverFromList'); });
	const mnemolinkInputs = document.getElementsByClassName('mnemolinkInput')
	for (let i = 0; i < mnemolinkInputs.length; i++) { mnemolinkInputs[i].classList.remove('hoverFromList'); }
	const mnemolink = event.target.classList.contains('mnemolink') ? event.target : event.target.parentElement;
	if (!mnemolink.classList.contains('mnemolink')) { return; }

	const index = Array.from(mnemolink.parentElement.children).indexOf(mnemolink);
	const bubble = mnemoBubbles[index];
	if (!bubble) { return; }

	bubble.element.classList.add('hoverFromList');

	const mnemolinkInput = mnemolink.getElementsByClassName('mnemolinkInput')[0];
	mnemolinkInput.classList.add('hoverFromList');
});
eHTML.dashboard.mnemolinksList.addEventListener('mouseout', (event) => {
	mnemoBubbles.forEach((bubble) => { bubble.element.classList.remove('hoverFromList'); });
	const mnemolinkInputs = document.getElementsByClassName('mnemolinkInput')
	for (let i = 0; i < mnemolinkInputs.length; i++) { mnemolinkInputs[i].classList.remove('hoverFromList'); }
});
eHTML.dashboard.mnemolinksList.addEventListener('click', async (event) => {
	if (event.target.classList.contains('mnemolinkInput')) { event.preventDefault(); return; }

	const isEditBtn = event.target.classList.contains('editBtn');
	if (isEditBtn) {
		const isTrash = event.target.classList.contains('trash');
		if (!isTrash) {
			event.target.classList.add('trash');
			const mnemolinkInput = event.target.parentElement.getElementsByClassName('mnemolinkInput')[0];
			mnemolinkInput.readOnly = false;
			mnemolinkInput.setSelectionRange(mnemolinkInput.value.length, mnemolinkInput.value.length);
			mnemolinkInput.focus();
			return;
		} else {
			console.log('delete mnemolink');
			const index = Array.from(event.target.parentElement.parentElement.children).indexOf(event.target.parentElement);
			const listOfMnemoLinksLabel = userData.getListOfMnemoLinks();
			const label = listOfMnemoLinksLabel[index];
			userData.removeMnemoLink(label);
			save.userMnemoLinks();

			fillMnemoLinkList();
			initMnemoLinkBubbles();

			return;
		}
	}

	const isShowBtn = event.target.classList.contains('showBtn');
	if (isShowBtn) {
		const isShowing = event.target.classList.contains('showing');
		if (!isShowing) {
			clearMnemonicBubbleShowing();
			event.target.classList.add('showing');
			const index = Array.from(event.target.parentElement.parentElement.children).indexOf(event.target.parentElement);
			const listOfMnemoLinksLabel = userData.getListOfMnemoLinks();
			const label = listOfMnemoLinksLabel[index];
			const mnemonic = await userData.getMnemoLinkDecrypted(label, true);
			if (!mnemonic) { console.error(`Unable to get decrypted mnemonic for MnemoLink: ${label}`); return; }
			
			mnemoBubbles[index].showMnemonicInBubble(label, mnemonic);
			mnemoBubbles[index].toCenterScreen();
			return;
		} else {
			event.target.classList.remove('showing');
			clearMnemonicBubbleShowing();
			return;
		}
	}
});
eHTML.dashboard.mnemolinksList.addEventListener('keydown', (event) => {
	if (event.key === 'Enter') {
		event.preventDefault();
		event.target.blur();
	}
});
// MODAL : MASTER MNEMONIC
eHTML.modals.wrap.addEventListener('click', (event) => {
	if (event.target === eHTML.modals.wrap) { closeModal(); } 

	if (eHTML.modals.inputMasterMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	if (eHTML.modals.inputMnemonic.mnemonicGrid.classList.contains('busy')) { return; }

	const eventTargetIsCopyBtn = event.target === eHTML.modals.inputMasterMnemonic.copyMnemonicBtn || event.target === eHTML.modals.inputMnemonic.copyMnemonicBtn;
	if (eventTargetIsCopyBtn) {
		const mnemonic = tempData.mnemonic.getMnemonicStr();
		navigator.clipboard.writeText(mnemonic);
		modalInfo(eHTML.modals.inputMasterMnemonic, 'Mnemonic copied to clipboard');
		modalInfo(eHTML.modals.inputMnemonic, 'Mnemonic copied to clipboard');
	}

	const eventTargetIsDownloadBtn = event.target === eHTML.modals.inputMasterMnemonic.downloadMnemonicBtn || event.target === eHTML.modals.inputMnemonic.downloadMnemonicBtn;
	if (eventTargetIsDownloadBtn) {
		const indexedMnemonicStr = tempData.mnemonic.getIndexedMnemonicStr();
		const fileName = event.target === eHTML.modals.inputMasterMnemonic.downloadMnemonicBtn ? "master_mnemonic.txt" : "mnemonic.txt";
		downloadStringAsFile(indexedMnemonicStr, fileName);
		modalInfo(eHTML.modals.inputMasterMnemonic, 'Mnemonic downloaded');
		modalInfo(eHTML.modals.inputMnemonic, 'Mnemonic downloaded');
	}
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
			if (detectedLanguage.length !== 0 && detectedLanguage !== language) {
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
eHTML.modals.inputMnemonic.confirmBtn.addEventListener('click', async (event) => {
	if (eHTML.modals.inputMnemonic.confirmBtn.classList.contains('busy')) { return; }
	if (eHTML.modals.inputMnemonic.mnemonicGrid.classList.contains('busy')) { return; }
	if (eHTML.modals.inputMnemonic.confirmBtn.classList.contains('disabled')) { return; }

	const mnemonic = tempData.mnemonic.getMnemonicStr();
	if (!mnemonic) { console.error('mnemonic not found'); return; }

	eHTML.modals.inputMnemonic.confirmBtn.classList.add('busy');

	const masterMnemonicStr = await userData.getMasterMnemonicStr();
	/** @type {MnemoLinker} */
	const mnemoLinker = new MnemoLinkerLastest( { pseudoMnemonic: masterMnemonicStr , mnemonic: mnemonic } );
	const mnemoLink = await mnemoLinker.encryptMnemonic();
	if (!mnemoLink) { console.error('Unable to create mnemoLink'); return; }

	userData.addMnemoLink(mnemoLink);
	await save.userMnemoLinks();
	fillMnemoLinkList();
	initMnemoLinkBubbles();
	tempData.init();

	closeModal();

	eHTML.modals.inputMnemonic.confirmBtn.classList.remove('busy');
});
//#endregion
if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)
	const { cryptoLight } = require("./cryptoLight.js");
}

//#region - CLASSES
class lockCircleObject {
	constructor(element, dTransitionMs = 120, strokeTransitionMs = 120, opacityTransitionMs = 120) {
		this.dTransitionMs = dTransitionMs;
		this.strokeTransitionMs = strokeTransitionMs;
		this.opacityTransitionMs = opacityTransitionMs;
		this.shape = 'hexagon';
		this.wrap = element.parentElement;
		/** @type {HTMLElement} */
		this.element = element;
		this.lines = [];
		this.paths = [];

		this.shapes = {
			hexagon: [
				'M 27 5 Q 50 5 73 5',
				'M 27 5 Q 50 5 60 5',
				'M 40 5 Q 50 5 73 5'
			],
			circle: [
				'M 27 5 Q 50 -6 73 5',
				'M 27 5 Q 44.5 -2.5 60 1',
				'M 40 1 Q 55.5 -2.5 73 5'
			],
			dot: 'M 50 5 Q 50 5 50 5',
			lineA: 'M 45 2 Q 50 0 55 2',
			lineB: 'M 40 0 Q 50 2 60 0',
		}
		this.strokeOpacities = { hexagon: .4, circle: .4, dot: .12, lineA: .04, lineB: .06 };
	}

	init(angle = 0, closed = false) {
		this.element.innerHTML = '';
		this.lines = [];
		const nbOfLines = 6;
		let shapeIndex = 0;
		for (let i = 0; i < nbOfLines; i++) {
			shapeIndex = closed ? 0 : ( i > 2 ? 0 : i );
			this.element.innerHTML += `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                   <path d="${this.shapes.hexagon[shapeIndex]}" stroke-opacity="${this.strokeOpacities.hexagon}" style="transition: d ${this.dTransitionMs}ms ease-in-out, stroke ${this.strokeTransitionMs}ms ease-in-out, stroke-opacity ${this.opacityTransitionMs}ms ease-in-out;" />
                </svg>`;
		}
		this.paths = this.element.getElementsByTagName('path');
		this.rotate(angle);
	}
	rotate(angle = 0) { this.wrap.style.transform = `rotate(${angle}deg)`; }
	setShape(shape = 'hexagon', closed = false) {
		this.shape = shape;

		let shapeIndex = 0;
		for (let i = 0; i < this.paths.length; i++) {
			shapeIndex = closed ? 0 : ( i > 2 ? 0 : i );
			const isIdleShape = shape !== 'hexagon' && shape !== 'circle';
			const pathStr = isIdleShape ? this.shapes[shape] : this.shapes[shape][shapeIndex];
			const path = this.paths[i];
			path.setAttribute('d', pathStr);
			path.setAttribute('stroke-opacity', this.strokeOpacities[shape]);
		}
	}
}
class centerScreenBtnObject {
	constructor() {
		this.transitionMs = 240;
		this.delayBeforeIdleAnimationIfLocked = 20000;
		this.idleAnimationLoopMs = 4000;
		this.state = 'locked'; // 'locked' or 'unlocked' or 'welcome'
		this.centerScreenBtnWrap = document.getElementById('centerScreenBtnWrap');
		this.pickAxe = document.getElementById('pickAxe'); // only available in the popup
		this.elementWrap = document.getElementById('centerScreenBtn').parentElement;
		this.element = document.getElementById('centerScreenBtn');

		/** @type {lockCircleObject[]} */
		this.lockCircles = [];
		//this.lockCirclesPos = [ 0, 60, 120, 180, 240, 300, 0 ];
		this.lockCirclesPos = [ 0, 240, 60, 180, 300, 120, 240 ];
		this.lockCirclesIdlePos = [ 0, 60, 120, 180, 240, 300 ];
		this.dTransitionMs = 120;
		this.wrapTransitionMs = 120;
	}
	init(nbOfLockCircles = 7) {
		this.elementWrap.style.transition = `transform ${this.transitionMs}ms ease-in-out`;
		this.lockCircles = [];
		this.element.innerHTML = '';
		for (let i = 0; i < nbOfLockCircles; i++) {
			const angle = this.lockCirclesPos[i];
			const lockCircleDiv = document.createElement('div');
			lockCircleDiv.classList.add('lockCircle');

			const wrap = document.createElement('div');
			wrap.classList.add('wrap');
			wrap.style.transition = `transform ${this.wrapTransitionMs}ms ease-in-out`;
			wrap.appendChild(lockCircleDiv);
			
			const lockCircle = new lockCircleObject( lockCircleDiv, this.dTransitionMs );
			lockCircle.init(angle, this.state === 'welcome');
			this.lockCircles.push(lockCircle);
			this.element.appendChild(wrap);
		}
		this.idleAnimation();
	}
	rotate(angle = 0) { this.elementWrap.style.transform = `rotate(${angle}deg)`; }
	async unlock() {
		this.state = 'unlocking';
		this.rotate(0);
		this.lockCircles.forEach( lc => lc.setShape('hexagon') );

		for (let i = 0; i < this.lockCircles.length; i++) {
			await new Promise(r => setTimeout(r, this.wrapTransitionMs));
			if (this.state !== 'unlocking') { return; }
			
			const lockCircle = this.lockCircles[i];
			lockCircle.setShape('circle');
			
			await new Promise(r => setTimeout(r, this.dTransitionMs));
			if (this.state !== 'unlocking') { return; }

			lockCircle.rotate(0);
		}
		
		await new Promise(r => setTimeout(r, this.wrapTransitionMs * 4));
		this.lockCircles.forEach( lc => lc.setShape('dot') );

		this.state = 'unlocked';
	}
	async lock() {
		this.state = 'locking';
		this.rotate(0);
		this.lockCircles.forEach( lc => lc.setShape('circle') );

		for (let i = this.lockCircles.length -1; i >= 0; i--) {
			await new Promise(r => setTimeout(r, this.dTransitionMs));
			if (this.state !== 'locking') { return; }

			const lockCircle = this.lockCircles[i];
			lockCircle.setShape('hexagon');
			
			await new Promise(r => setTimeout(r, this.wrapTransitionMs));
			if (this.state !== 'locking') { return; }

			lockCircle.rotate(this.lockCirclesPos[i]);
		}

		this.state = 'locked';
	}
	setShape(shape = 'hexagon') {
		this.lockCircles.forEach( lc => lc.setShape(shape) );
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
	async idleAnimation() {
		await new Promise(r => setTimeout(r, 2400));

		let lockedSince = Date.now();
		while (true) {
			if (this.state !== 'locked' && this.state !== 'unlocked') { lockedSince = Date.now(); }
			if (this.state === 'locked' && Date.now() > lockedSince + this.delayBeforeIdleAnimationIfLocked) { this.state = 'welcome'; }

			const startTimestamp = Date.now();

			await this.popCircleAnimation(['welcome']); //, 'locked']);
			await this.turningAnimation(['welcome']); //, 'locked']);

			await this.popDotAnimation(['unlocked']);
			
			//console.log('idleAnimation duration:', Date.now() - startTimestamp);
			await new Promise(r => setTimeout(r, this.idleAnimationLoopMs - ( Date.now() - startTimestamp )));
		}
	}
	async turningAnimation(authorizedStates = ['welcome']) {
		if (!authorizedStates.includes(this.state)) { return }

		const rndFloor = rnd(0, this.lockCircles.length - 1);
		const rndAngleIndex = rnd(0, this.lockCirclesIdlePos.length - 1);
		const rndAngle = this.lockCirclesIdlePos[rndAngleIndex];

		this.lockCircles.forEach( (lc, i) => { lc.setShape(i <= rndFloor ? 'circle' : 'hexagon', this.state === 'welcome' ? rnd(0, 1) : false); } );

		await new Promise(r => setTimeout(r, this.dTransitionMs * 2));
		if (!authorizedStates.includes(this.state)) { return }

		this.lockCircles.forEach( (lc, i) => { if (i <= rndFloor) { lc.rotate(rndAngle) }; } );

		await new Promise(r => setTimeout(r, this.wrapTransitionMs * 2));
		if (!authorizedStates.includes(this.state)) { return }

		this.lockCircles.forEach( lc => lc.setShape('hexagon', this.state === 'welcome' ? true : false) );
	}
	async popCircleAnimation (authorizedStates = ['welcome']) {
		if (!authorizedStates.includes(this.state)) { return }

		this.lockCircles.forEach( lc => lc.setShape('hexagon', this.state === 'welcome' ? true : false) );

		for (let i = 0; i < this.lockCircles.length; i++) {
			await new Promise(r => setTimeout(r, this.dTransitionMs));
			if (!authorizedStates.includes(this.state)) { return }

			this.lockCircles[i].setShape('circle', this.state === 'welcome' ? true : false);
			
			await new Promise(r => setTimeout(r, this.wrapTransitionMs));
			if (!authorizedStates.includes(this.state)) { return }
		}
	}
	async popDotAnimation(authorizedStates = ['unlocked']) {
		if (!authorizedStates.includes(this.state)) { return }

		for (let i = this.lockCircles.length - 1; i >= 0; i--) {
			this.lockCircles[i].setShape('dot');
			await new Promise(r => setTimeout(r, this.dTransitionMs));
			if (!authorizedStates.includes(this.state)) { return }
		}
		
		for (let i = 0; i < this.lockCircles.length; i++) {
			this.lockCircles[i].setShape('lineA');
			await new Promise(r => setTimeout(r, this.wrapTransitionMs));
			if (!authorizedStates.includes(this.state)) { return }
		}

		for (let i = 0; i < this.lockCircles.length; i++) {
			this.lockCircles[i].setShape('dot');
			await new Promise(r => setTimeout(r, this.dTransitionMs));
			if (!authorizedStates.includes(this.state)) { return }
		}

		await new Promise(r => setTimeout(r, this.wrapTransitionMs * 2));
		
		for (let i = this.lockCircles.length - 1; i >= 0; i--) {
			this.lockCircles[i].setShape('lineB');
			await new Promise(r => setTimeout(r, this.wrapTransitionMs));
			if (!authorizedStates.includes(this.state)) { return }
		}

		for (let i = this.lockCircles.length - 1; i >= 0; i--) {
			this.lockCircles[i].setShape('dot');
			await new Promise(r => setTimeout(r, this.dTransitionMs));
			if (!authorizedStates.includes(this.state)) { return }
		}

		await new Promise(r => setTimeout(r, this.wrapTransitionMs * 2));
	}
}
class mnemonicClass {
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
		this.id = "";
		this.encryptedMasterMnemonicsStr = "";
		this.encryptedMnemoLinksStr = {};
		this.preferences = {
			autoCloudSync: true,
			darkMode: false,
		};
		this.state = {
			synchronizedWithCloud: true // consider the data as synchronized because initialized class is empty
		}
	}
	// Master Mnemonic
	async setMnemonicAsEncrypted(mnemonicStr = "") {
		const mnemonicStrEncrypted = await this.#encrypStringWithPassword(mnemonicStr);
		if (!mnemonicStrEncrypted) { return false; }

		this.encryptedMasterMnemonicsStr = mnemonicStrEncrypted;
		this.state.synchronizedWithCloud = false;
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
		if (label === '') {
			let newIndex = Object.keys(this.encryptedMnemoLinksStr).length + 1;
			label = `key${newIndex}`;
			while (this.encryptedMnemoLinksStr[label]) {
				newIndex++;
				label = `key${newIndex}`;
			}
		}
		console.log(`new label: ${label}`);
		this.encryptedMnemoLinksStr[label] = mnemoLink;
		this.state.synchronizedWithCloud = false;
	}
	removeMnemoLink(label) {
		if (!this.encryptedMnemoLinksStr[label]) { return false; }
		delete this.encryptedMnemoLinksStr[label];
		this.state.synchronizedWithCloud = false;
		return true;
	}
	getListOfMnemoLinks() {
		const result = [];
		for (let i = 0; i < Object.keys(this.encryptedMnemoLinksStr).length; i++) {
			const label = Object.keys(this.encryptedMnemoLinksStr)[i];
			const version = emptyMnemoLinker.dissectMnemoLink(this.encryptedMnemoLinksStr[label]).version;
			const versionStr = `v${version.join(".")}`;
			result.push({ label: label, versionStr: versionStr });
		}

		return result;
	}
	replaceMnemoLinkLabel(oldLabel, newLabel, logs = false) {
		if (oldLabel === newLabel) { if (logs) { return true; } }
		if (!this.encryptedMnemoLinksStr[oldLabel]) { if (logs) { console.error('oldLabel not found !'); }; return false; }

		const initialOrder = Object.keys(this.encryptedMnemoLinksStr);
		if (initialOrder.indexOf(newLabel) !== -1) { if (logs) { console.error('newLabel already exists !'); }; return false; }

		const newObject = {};
		for (let i = 0; i < initialOrder.length; i++) {
			const key = initialOrder[i];
			if (key === oldLabel) { 
				newObject[newLabel] = this.encryptedMnemoLinksStr[oldLabel]; 
			} else { 
				newObject[key] = this.encryptedMnemoLinksStr[key];
				this.state.synchronizedWithCloud = false;
			}
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

		const targetMnemoLinkerClass = await MnemoLinker[versionStr];
		if (!targetMnemoLinkerClass) { if (logs) { console.error('version not found !'); return false; } }

		const masterMnemonicStr = await this.getMasterMnemonicStr();
		if (!masterMnemonicStr) { if (logs) { console.error('masterMnemonicStr not found !'); return false; } }

		if (logs) { console.log(`versionStr: ${versionStr}`); }
		try {
			/** @type {MnemoLinker} */
			const targetMnemoLinker = new targetMnemoLinkerClass( { masterMnemonic: masterMnemonicStr } );
			targetMnemoLinker.useArgon2Worker = true;
			const mnemoLinkDecrypted = await targetMnemoLinker.decryptMnemoLink(mnemoLinkEncrypted);
			targetMnemoLinker.terminate(); // terminate worker
			if (!mnemoLinkDecrypted) { if (logs) { console.error('mnemoLinkDecrypted not found !'); return false; } }
			
			return mnemoLinkDecrypted;
		} catch (error) {
			if (logs) { console.error('error:', error); }
		}
		return false;
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
class tempDataClass {
    constructor() {
        this.rndMnemonic = [];
        this.rndButtonsPressed = 0;
        this.mnemonic = new mnemonicClass();
    }
	init() {
		this.rndMnemonic = [];
		this.rndButtonsPressed = 0;
		this.mnemonic = new mnemonicClass();
	}
}
class mnemoBubbleObject {
	constructor(label, mnemoLinkerVersion, x = 0, y = 0) {
		/** @type {HTMLElement} */
		this.element = this.createMnemoLinkBubbleElement(label, mnemoLinkerVersion);
		this.label = label;
		this.mnemoLinkerVersion = mnemoLinkerVersion;
		this.positionLock = false;
		
		this.animation = null;
		this.x = x;
		this.y = y;
		this.vector = { x: 0, y: 0 };
		this.initPosPerc = { 
			x: x / eHTML.vault.mnemolinksBubblesContainer.offsetWidth * 100,
			y: y / eHTML.vault.mnemolinksBubblesContainer.offsetHeight * 100,
		};
		this.fakeCiphering = false;
		this.readyToShow = false;
	}
	createMnemoLinkBubbleElement(label = 'toto', mnemoLinkerVersion = 'v0.1') {
		const newMnemoLink = document.createElement('div');
		newMnemoLink.classList.add('mnemolinkBubble');
	
		const inElement = this.createInBubbleElement(label, mnemoLinkerVersion);
		newMnemoLink.appendChild(inElement);
		
		return newMnemoLink;
	}
	createInBubbleElement(label = 'toto', mnemoLinkerVersion = 'v0.1') {
		const wrap = document.createElement('div');
		wrap.classList.add('wrap');
	
		const h2 = document.createElement('h2');
		h2.innerText = label;
		wrap.appendChild(h2);

		const p = document.createElement('p');
		p.innerText = mnemoLinkerVersion;
		wrap.appendChild(p);

		return wrap;
	}
	setPosition(x = 0, y = 0) {
		this.x = x;
		this.y = y;
		this.element.style.left = `${x}px`;
		this.element.style.top = `${y}px`;
	}
	updatePosition() {
		if ( this.positionLock ) { return; }
		this.setPosition(this.x + this.vector.x, this.y + this.vector.y);
	}
	toCenterContainer(duration = 240) {
		this.positionLock = true;

		const mnemolinksBubblesContainer = eHTML.vault.mnemolinksBubblesContainer;
		const x = mnemolinksBubblesContainer.offsetWidth / 2;
		const y = mnemolinksBubblesContainer.offsetHeight / 2;
		if (this.x === x && this.y === y) { return true; }
		
		this.vector = { x: 0, y: 0 };
		if (duration === 0) { this.setPosition(x, y); return true; }
		const animatedPosition = {
			x: this.x,  // Valeur initiale de x
			y: this.y,  // Valeur initiale de y
		};
		this.animation = anime({
			targets: animatedPosition,
			x: x,
			y: y,
			duration: duration,
			easing: 'easeOutQuad',
			update: () => { 
				this.setPosition(animatedPosition.x, animatedPosition.y);
			}
		});
		return true;
	}
	async prepareBubbleToShow(label, fakeCipher = true) {
		if (this.label !== label) { console.error('label mismatch !'); return; }
		this.fakeCiphering = true;
		
		const duration = 240;
		centerScreenBtn.hide(duration);
		this.toCenterContainer(duration);
		await new Promise(r => setTimeout(r, duration * .4));
		
		// clear bubble
		this.element.innerHTML = '';
		this.element.classList.add('showing');
	
		// title
		const emptyDiv = document.createElement('div');
		const titleH2 = document.createElement('h2');
		titleH2.innerText = label;
		emptyDiv.appendChild(titleH2);
		
		// mnemonic grid
		const gridHtml = document.createElement('div');
		gridHtml.classList.add('miniMnemonicGrid');
		for (let i = 0; i < 12; i++) {
			const fakeWordLength = rnd(3, 7);
			const wordDiv = document.createElement('div');
			wordDiv.innerText = fakeCipher ? this.#generateRndString( fakeWordLength ) : mnemonic[i];
			gridHtml.appendChild(wordDiv);
		};

		emptyDiv.appendChild(gridHtml);
		emptyDiv.classList.add('mnemonicBubbleContent');
		this.element.appendChild(emptyDiv);

		const wordDivs = gridHtml.querySelectorAll('div');
		while (!this.readyToShow) {
			for (let i = 0; i < wordDivs.length; i++) {
				const newRndWordLength = rnd(3, 7);
				const newRndWord = this.#generateRndString( newRndWordLength );
				for (let j = 0; j < newRndWord.length; j++) {
					const char = newRndWord.charAt(j);
					// replace the "fake cipher" char at position j by the real char
					wordDivs[i].innerText = wordDivs[i].innerText.substring(0, j) + char + wordDivs[i].innerText.substring(j + 1);
					await new Promise(r => setTimeout(r, settings.delayBeetweenChar));
					if (this.readyToShow || this.label !== label) { break; }
				}
				if (this.readyToShow || this.label !== label) { break; }
				if (newRndWordLength < wordDivs[i].innerText.length) { wordDivs[i].innerText = newRndWord; }
			}
		}

		this.fakeCiphering = false;
	}
	async prepareMiniGridToDecipher(label, mnemonicStr, fakeCipher = true) {
		if (this.label !== label) { console.error('label mismatch !'); return; }
		this.readyToShow = true;
		while (this.fakeCiphering && this.label === label) { await new Promise(r => setTimeout(r, 40)); }
		setTimeout(() => { this.readyToShow = false; }, 600);

		// get last fake words
		const wordDivs = this.element.children[0].children[1].querySelectorAll('div');
		const lastFakeWords = [];
		for (let i = 0; i < wordDivs.length; i++) { lastFakeWords.push(wordDivs[i].innerText); }

		// clear bubble
		this.element.innerHTML = '';
		this.element.classList.add('showing');
	
		// title
		const emptyDiv = document.createElement('div');
		const titleH2 = document.createElement('h2');
		titleH2.innerText = label;
		emptyDiv.appendChild(titleH2);
		
		// mnemonic grid
		const mnemonic = mnemonicStr.split(' ');
		const gridHtml = document.createElement('div');
		gridHtml.classList.add('miniMnemonicGrid');
		for (let i = 0; i < mnemonic.length; i++) {
			const wordDiv = document.createElement('div');
			let fakeWord = lastFakeWords[i] !== -1 ? lastFakeWords[i] : this.#generateRndString( mnemonic[i].length );
			fakeWord = fakeWord.length > mnemonic[i].length ? fakeWord.substring(0, mnemonic[i].length) : fakeWord;
			fakeWord = fakeWord.length < mnemonic[i].length ? this.#generateRndString( mnemonic[i].length ) : fakeWord;
			wordDiv.innerText = fakeCipher ? fakeWord : mnemonic[i];
			gridHtml.appendChild(wordDiv);
		};

		emptyDiv.appendChild(gridHtml);
		
		// copy and download buttons
		const activeClassBtnsWrap = fakeCipher ? '' : ' active';
		emptyDiv.innerHTML += `<div class="buttonsWrap${activeClassBtnsWrap}">
		<div class="copyBtn" id="bubbleCopyBtn">Copy</div>
		<div class="downloadBtn" id="bubbleDownloadBtn">Download</div>
		</div>`;
		
		emptyDiv.classList.add('mnemonicBubbleContent');
		this.element.appendChild(emptyDiv);

		return true;
	}
	#generateRndString(length = 12) {
		let rndStr = "";
		for (let i = 0; i < length; i++) {
			// choose a rnd char from the base64 Table : A-Z and a-z and 0-9
			const rnd1 = rnd(0, 2);
			const fakeChar = String.fromCharCode( rnd1 === 0 ? rnd(65, 90) : rnd1 === 1 ? rnd(97, 122) : rnd(48, 57) );
			rndStr += fakeChar;
		}
		return rndStr;
	}
	async decipherMiniMnemonicGrid(mnemonicStr) {
		const miniMnemonicGrid = document.getElementsByClassName("miniMnemonicGrid")[0];
		if (!miniMnemonicGrid) { return; }

		const words = mnemonicStr.split(' ');
		const miniMnemonicGridDivs = miniMnemonicGrid.querySelectorAll('div');
		if (words.length !== miniMnemonicGridDivs.length) { console.error('words.length !== miniMnemonicGridDivs.length'); return; }

		for (let i = 0; i < words.length; i++) {
			for (let j = 0; j < words[i].length; j++) {
				const char = words[i].charAt(j);
				// replace the "fake cipher" char at position j by the real char
				miniMnemonicGridDivs[i].innerText = miniMnemonicGridDivs[i].innerText.substring(0, j) + char + miniMnemonicGridDivs[i].innerText.substring(j + 1);
				await new Promise(r => setTimeout(r, settings.delayBeetweenChar));
			}
		}

		const buttonsWrap = this.element.getElementsByClassName('buttonsWrap')[0];
		if (!buttonsWrap) { return; }
		buttonsWrap.classList.add('active');
		return true;
	}
	stopShowing(affectCenterScreenBtn = true) {
		if (!this.positionLock) { return; }
		this.stopDeleteExistingAnimation();

		if (affectCenterScreenBtn) { centerScreenBtn.show(120); }
		this.element.innerHTML = '';

		const inElement = this.createInBubbleElement(this.label, this.mnemoLinkerVersion);
		this.element.appendChild(inElement);

		this.resetPosition();
		this.vector = { x: 0, y: 0 };
		this.element.classList.remove('showing');
		this.positionLock = false;
	}
	resetPosition() {
		this.x = this.initPosPerc.x * eHTML.vault.mnemolinksBubblesContainer.offsetWidth / 100;
		this.y = this.initPosPerc.y * eHTML.vault.mnemolinksBubblesContainer.offsetHeight / 100;
	}
	stopDeleteExistingAnimation() {
		if (!this.animation) { return; }
		this.animation.pause(); 
		this.animation = null;
	}
}
class svgLinkObject {
	constructor(arrayOfSVGPath = [], minOpacity = 0) {
		/** @type {SVGPathElement[]} */
		this.arrayOfSVGPath = arrayOfSVGPath;
		this.maxOffsetDecay = 27; // intial: 10 // how much the line derivate from the straightest path
		this.minOpacity = minOpacity;

		this.pattern = {
			strokeOpacities: [],
			coveredDistanceMultipliers: [],
			offsets: [],
			curveOffsets: [],
		}
	}
	randomizePattern() {
		const arrayOfSVGPath = this.arrayOfSVGPath;
		for (let i = 0; i < arrayOfSVGPath.length; i++) {
			// ex: { 0.6 + 0.4 > 60% to 100% opacity }
			this.pattern.strokeOpacities[i] = Math.random() * 0.2 + 0.21; // should never be under 0.21
			if (this.minOpacity > this.pattern.strokeOpacities[i]) { this.pattern.strokeOpacities[i] = this.minOpacity; }

			// ex: { rnd(20, 60) > 20% to 60% of the remaining distance }
			this.pattern.coveredDistanceMultipliers[i] = rnd(20, 60) / 100;
			
			// ex: { maxOffsetDecay = 10 > -PI/20 to PI/20 angle deviation } for more organic look
			this.pattern.offsets[i] = Math.PI / this.maxOffsetDecay * (Math.random() - 0.5);

			const negativeCurve = rnd(0, 1) === 0 ? -1 : 1; // A higher value will make the curve more pronounced
			this.pattern.curveOffsets[i] = rnd(0, this.maxOffsetDecay) * negativeCurve;
		}
	}
	linkPathWithCurve(path, startX, startY, targetX, targetY, curveOffset, strokeOpacity = 1, opacityVariation = 0.2) {
		const curveX = startX + (targetX - startX) / 2;
		const curveY = startY + (targetY - startY) / 2;

		const curveAngle = Math.atan2(targetY - startY, targetX - startX);
		
		const curveTargetX = curveX + Math.cos(curveAngle + Math.PI / 2) * curveOffset;
		const curveTargetY = curveY + Math.sin(curveAngle + Math.PI / 2) * curveOffset;

		path.setAttribute('d', `M ${startX} ${startY} Q ${curveTargetX} ${curveTargetY} ${targetX} ${targetY}`);
		path.setAttribute('stroke-opacity', strokeOpacity - (Math.random() * opacityVariation));
	}
	linkPathWithStraightLine(path, startX, startY, targetX, targetY) {
		path.setAttribute('d', `M ${startX} ${startY} L ${targetX} ${targetY}`);
	}
	setTransitions(d = 32) {
		const arrayOfSVGPath = this.arrayOfSVGPath;
		for (let i = 0; i < arrayOfSVGPath.length; i++) {
			const path = arrayOfSVGPath[i];
			if (path.style.transition === `d ${d}ms ease-in-out, stroke 120ms ease-in-out, stroke-opacity 120ms ease-in-out`) { continue; }
			path.style.transition = `d ${d}ms ease-in-out, stroke 120ms ease-in-out, stroke-opacity 120ms ease-in-out`;
		}
		//console.log(`setTransitions to ${arrayOfSVGPath.length} paths -> ${d}ms`);
	}
}
class mnemoLinkSVGObject {
	constructor(elementSVG, targetX, targetY, patternChangeSequence = [4, 10, 60]) {
		this.element = elementSVG;
		this.containerHalfWidth = 0;
		this.containerHalfHeight = 0;
		this.targetX = targetX;
		this.targetY = targetY;
		this.deltaBetweenLastTarget = 0;
		this.fastModeMaintain = 240;

		this.patternChangeSequence = patternChangeSequence; // ex: [4, 60] change pattern at frame 4, 60
		this.frame = 0;
		/** @type {svgLinkObject[]} */
		this.lines = [];
		this.pauseAnimation = false;
		this.angle = 0;
	}
	#initLines(nbOfLines = 3) {
		if (this.lines.length === nbOfLines) { return; }

		this.element.innerHTML = '';
		this.lines = [];

		for (let i = 0; i < nbOfLines; i++) {
			const segments = rnd(2, 4);
			//const strokeWidth = Math.random() * 1.5 + 0.5;
			let strokeWidth = Math.random() * 1 + 0.5;
			if (i === 0) { strokeWidth = 2; }

			const arrayOfSVGPath = this.#createArrayOfSVGPath(segments, strokeWidth);
			
			const svgLink = new svgLinkObject(arrayOfSVGPath, i === 0 ? 0.22 : 0);
			svgLink.randomizePattern();
			this.lines.push(svgLink);
		}
	}
	#createArrayOfSVGPath(nbPath = 3, strokeWidth = 1) {
		const paths = [];
		for (let i = 0; i < nbPath; i++) {
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			this.element.appendChild(path);
			paths.push(path);
			path.setAttribute('stroke-width', strokeWidth);
			path.setAttribute('fill', 'none');
		}
		return paths;
	}
	calculateDistance(startX, startY, targetX, targetY) {
		const deltaX = targetX - startX;
		const deltaY = targetY - startY;
		return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	}
	/** @param {svgLinkObject} svgLink */
	#drawTheLine(svgLink) {
		const arrayOfSVGPath = svgLink.arrayOfSVGPath;
		if (!arrayOfSVGPath) {console.error('arrayOfSVGPath not found !'); return;}

		let delta = this.calculateDistance(this.containerHalfWidth, this.containerHalfHeight, this.targetX, this.targetY);
		let startX = this.containerHalfWidth + Math.cos(this.angle) * delta * 0.24; // skip 24% of the distance
		let startY = this.containerHalfHeight + Math.sin(this.angle) * delta * 0.24;
		if (isNaN(startX) || isNaN(startY)) { return; }

		// line from start to bubble split in X parts
		for (let i = 0; i < arrayOfSVGPath.length; i++) {
			const path = arrayOfSVGPath[i];
			const strokeOpacity = svgLink.pattern.strokeOpacities[i];
			const curveOffset = svgLink.pattern.curveOffsets[i];
			
			if (i === arrayOfSVGPath.length - 1) {
				svgLink.linkPathWithCurve(path, startX, startY, this.targetX, this.targetY, curveOffset, strokeOpacity);
				break;
			}
			
			delta = this.calculateDistance(startX, startY, this.targetX, this.targetY);
			const coveredDistance = delta * svgLink.pattern.coveredDistanceMultipliers[i];
			
			const offset = svgLink.pattern.offsets[i];
			const offestAngle = this.angle + offset;
			const targetX = startX + Math.cos(offestAngle) * coveredDistance;
			const targetY = startY + Math.sin(offestAngle) * coveredDistance;

			// curve line
			svgLink.linkPathWithCurve(path, startX, startY, targetX, targetY, curveOffset, strokeOpacity);

			startX = targetX;
			startY = targetY;
		}
	}
	update() {
		if (this.pauseAnimation) { return; }
		const nbOfLines = this.patternChangeSequence.length;
		this.#initLines(nbOfLines);

		for (let i = 0; i < nbOfLines; i++) {
			const svgLink = this.lines[i];
			// adapt transition speed to avoid unconnected links
			if (this.deltaBetweenLastTarget > 10) {
				this.fastModeMaintain = 360;
				svgLink.setTransitions(16);
			} else if (this.fastModeMaintain > 120) {
				svgLink.setTransitions(32);
			} else if (this.fastModeMaintain > 0) {
				svgLink.setTransitions(64);
			} else { svgLink.setTransitions(128); }
			if (this.fastModeMaintain > 0) { this.fastModeMaintain--; }
			
			if (this.frame === this.patternChangeSequence[i]) { svgLink.randomizePattern(); }
			
			this.angle = Math.atan2(this.targetY - this.containerHalfHeight, this.targetX - this.containerHalfWidth);
			this.#drawTheLine(svgLink);
		}
		
		this.frame++;
		if (this.frame > this.patternChangeSequence[nbOfLines - 1]) { this.frame = 0; }
	}
}
class gameControllerClass {
    constructor() {
        this.isGameActive = false;
        this.gameEventListeners = [];
        this.gameTimers = [];
        this.gameControllers = [];
    }
    init(setActive = false) {
        this.isGameActive = setActive;
        this.gameEventListeners = [];
        this.gameTimers = [];
        this.gameControllers = [];
    }
    pause(delay) {
        let abort;
        let controllerIndex;

        const promise = new Promise((resolve, reject) => {
            const timerId = setTimeout(() => resolve(true), delay);
            abort = () => {
                clearTimeout(timerId);
                reject(new Error("Pause aborted"));
                // Remove controller from list
                this.gameControllers = this.gameControllers.filter((_, index) => index !== controllerIndex);
            };
        }).catch(error => {
            //console.log(error.message);
            return false;
        });

        controllerIndex = this.gameControllers.push(abort) - 1;

        return { promise, abort };
    }
    cleanUpGamePauses() {
        this.gameControllers.forEach(abort => abort());
        this.gameControllers = [];
    }
    clearGameTimeouts() {
        this.gameTimers.forEach(timerId => {
            clearTimeout(timerId);
        });
        this.gameTimers = [];
    }
    removeGameEventListeners() {
        this.gameEventListeners.forEach(({element, eventType, handler}) => {
            element.removeEventListener(eventType, handler);
        });
    
        this.gameEventListeners = [];
    }
}
class communicationClass {
    constructor(serverUrl) {
        this.url = serverUrl;
		this.sanitizer = new sanitizerClass();
    }

	async pingServer(serverUrl) {
		try {
			const response = await fetch(`${serverUrl}/api/ping`);
			const result = await response.json();
			if (result.success) { return true; }
		} catch (error) {
		}
		return false;
	}
	/**
	 * Send MnemoLinks to server - Return server's response
	 * @param {string} userId - userData.id
	 * @param {object} encryptedMnemoLinksStr - userData.encryptedMnemoLinksStr
	 * @returns {Promise<boolean>}
	 */
	async sendMnemoLinksToServer(userId, encryptedMnemoLinksStr) {
		const data = { 
			id: userId,
			encryptedMnemoLinksStr: encryptedMnemoLinksStr,
		};
	
		const serverUrl = `${settings.serverUrl}/api/storeMnemoLinks`;
		const requestOptions = {
		  method: 'POST',
		  headers: {
			'Content-Type': 'application/json',
		  },
		  body: JSON.stringify(data)
		};
	  
		try {
		  const response = await fetch(serverUrl, requestOptions);
		  const result = await response.json();

		  if (typeof result.success !== 'boolean') { console.error('Invalid response from server !'); return false; }
		  console.log(`MnemoLinks sent to server: ${result.success}`);
		  return result.success;
		} catch (error) {
		  console.error(`Error while sending MnemoLinks to server: ${error}`);
		  return false;
		}
	}
	/**
	 * Send pubKey with server - Return server's pubKey (sanitized)
	 * @param {string} authID
	 * @param {Uint8Array} publicKey
	 * @returns {Promise<boolean | Uint8Array>}
	 */
	async sharePubKeyWithServer(authID, publicKey) {
		const data = { authID, publicKey };
		const stringifiedData = JSON.stringify(data);
		const serverUrl = `${this.url}/api/sharePubKey`;

		const requestOptions = {
		  method: 'POST',
		  headers: {
			'Content-Type': 'application/json',
		  },
		  body: stringifiedData
		};
	  
		try {
		  const response = await fetch(serverUrl, requestOptions);
		  const result = await response.json();

		  if (typeof result.success !== 'boolean') { console.error('Invalid response from server !'); return false; }
		  if (result.message) { result.message = this.sanitizer.sanitize(result.message); }
		  if (result.serverPublicKey) { result.serverPublicKey = this.sanitizer.sanitize(result.serverPublicKey); }
		  return result;
		} catch (error) {
		  console.error(`Error while sharing public key with server: ${error}`);
		  return false;
		}
	}
	/**
	 * Send encrypted auth data to server - Return server's response
	 * @param {Uint8Array} serverPublicKey
	 * @param {string} authID
	 * @param {string} authTokenHash
	 * @param {string} encryptedPassComplement
	 * @param {cryptoTimingsObject} totalTimings
	 * @returns {Promise<boolean | object>}
	 */
	async sendAuthDataToServer(serverPublicKey, authID, authTokenHash, encryptedPassComplement, totalTimings) {
		if (!serverPublicKey || !authID || !authTokenHash) { console.error('Missing data !'); return false; }

		const authTokenHashEnc = await cryptoLight.encryptData(serverPublicKey, authTokenHash);
		const encryptedPassComplementEnc = encryptedPassComplement ? await cryptoLight.encryptData(serverPublicKey, encryptedPassComplement) : false;
	
		const data = {
			authID,
			authTokenHash: btoa(String.fromCharCode.apply(null, new Uint8Array(authTokenHashEnc))),
			encryptedPassComplement: encryptedPassComplementEnc ? btoa(String.fromCharCode.apply(null, new Uint8Array(encryptedPassComplementEnc))) : false,
		};
		if (totalTimings) {
			data.argon2Time = totalTimings.argon2Time;
			data.deriveKTime = totalTimings.deriveKTime;
			data.totalTime = totalTimings.total;
		}
	
		//console.log(data);
		const apiRoute = encryptedPassComplement ? 'createAuthInfo' : 'loginAuthInfo';
		const serverUrl = `${settings.serverUrl}/api/${apiRoute}`;
		const requestOptions = {
		  method: 'POST',
		  headers: {
			'Content-Type': 'application/json',
		  },
		  body: JSON.stringify(data)
		};
	  
		try {
		  const response = await fetch(serverUrl, requestOptions);
		  const result = await response.json();

		  if (typeof result.success !== 'boolean') { console.error('Invalid response from server !'); return false; }
		  if (result.message) { result.message = this.sanitizer.sanitize(result.message); }
		  if (result.encryptedPassComplement) { result.encryptedPassComplement = this.sanitizer.sanitize(result.encryptedPassComplement); }
		  return result;
		} catch (error) {
		  console.info(`Error while sending AuthData to server: ${error}`);
		  return false;
		}
	}
}
class authInfoObject {
	constructor() {
		this.appVersion = "";
		this.authID = "";
		this.authToken = "";
		this.hash = "";
		this.salt1Base64 = "";
		this.iv1Base64 = "";
		this.serverAuthBoost = false;
	}
}
class sanitizerClass {
	constructor() {
		this.validTypeToReturn = ['number', 'boolean'];
	}

	sanitize(data) {
		if (!data) return false;
		if (this.validTypeToReturn.includes(typeof data)) return data;
		if (typeof data !== 'string' && typeof data !== 'object') return 'Invalid data type';
	
		if (typeof data === 'string') {
			//return data.replace(/[^a-zA-Z0-9+/=$,]/g, ''); // DEPRECATED - losing "."
			return data.replace(/[^a-zA-Z0-9+\/=.$,]/g, '');
		} else if (typeof data === 'object') {
			const sanitized = {};
			for (const key in data) {
				const sanitazedValue = this.sanitize(data[key]);
				sanitized[this.sanitize(key)] = sanitazedValue;
			}
			return sanitized;
		}
		return data;
	}
}
class Miner {
	/**
	* @param {centerScreenBtnObject} centerScreenBtn
	* @param {communicationClass} communication
	*/
	constructor(centerScreenBtn, communication) {
		this.connectionState = null;
		this.sanitizer = new sanitizerClass();
		this.centerScreenBtn = centerScreenBtn;
		this.communication = communication;
	}

	async init() {
		this.connectionState = await this.getConnectionStateFromStorage();
		const miningIsActive = await this.isMiningActive();
        if (miningIsActive) { // continue mining
            console.log(`popup send: startMining (from previous state)`);
            await chrome.runtime.sendMessage({action: "startMining"});
            this.centerScreenBtn.pickAxe.classList.remove('invisible');
        }

		this.initListeners();
        const intensity = await this.getIntensityFromStorage();
        this.setIntensityRangeValue(intensity);
        this.miningAnimationLoop();
	}
	async toogleMining() {
		const miningIsActive = await this.isMiningActive();
		if (miningIsActive) {
			console.log(`popup send: stopMining`);
			await chrome.runtime.sendMessage({action: "stopMining"});
		} else {
			console.log(`popup send: startMining`);
			await chrome.runtime.sendMessage({action: "startMining"});
		}
	}
	async miningAnimationLoop() {
		const pickAxe = this.centerScreenBtn.pickAxe;
		pickAxe.style.transform = 'rotate(0deg) translateX(20%) translateY(0%) scale(.6)';
		const minDuration = 50;
		let circleAnim = null;
	
		while(true) {
			const miningIsActive = await this.isMiningActive();
			const miningIntensity = this.getIntensityFromSpan();
	
			let pauseDuration = miningIntensity === 10 ? 0 : 2000 / (1.4 ** miningIntensity);
			if (this.connectionState !== 'connected') { pauseDuration = 1000; }
			const duration = pauseDuration < minDuration ? minDuration : pauseDuration;
			
			await new Promise(resolve => setTimeout(resolve, duration));

			if (!miningIsActive || miningIntensity === 0) {
				this.centerScreenBtn.pickAxe.classList.add('invisible');
				this.centerScreenBtn.state = 'welcome';
				continue;
			} else {
				//this.centerScreenBtn.state = 'unlocked';
				this.centerScreenBtn.state = 'mining';
				this.centerScreenBtn.pickAxe.classList.remove('invisible');
			}
			
			if (this.connectionState !== 'connected') {
				// rotate (loading)
				circleAnim = anime({
					targets: pickAxe,
					rotate: '+=360deg',
					translateX: ['-10%', '0%', '10%'],
					translateY: '0%',
					scale: [.6, .64, .6],
					opacity: [0, 1],
					
					easing: 'easeOutQuad',
					duration: duration * .5,
				});
				continue;
			}
	
			// Pull
			circleAnim = anime({
				targets: pickAxe,
				rotate: '0deg',
				translateX: '40%',
				translateY: '10%',
				scale: .6,
	
				easing: 'easeOutQuad',
				duration: duration * .7,
			});
	
			setTimeout(async () => {
				this.centerScreenBtn.lockCircles.forEach( lc => lc.setShape('hexagon', true) );
			}, 20);
			await new Promise(resolve => setTimeout(resolve, duration * .7));
	
			// Shot
			circleAnim = anime({
				targets: pickAxe,
				rotate: '-100deg',
				translateX: '20%',
				translateY: '-10%',
				scale: .62,
				easing: 'easeInQuad',
				duration: duration * .3,
			});
	
			setTimeout(async () => { 
				for (let i = this.centerScreenBtn.lockCircles.length - 1; i >= 0; i--) {
					this.centerScreenBtn.lockCircles[i].setShape('dot');
					await new Promise(r => setTimeout(r, 20));
				}
			}, duration * .26);
			await new Promise(resolve => setTimeout(resolve, duration * .3));
		}
	}
	/** @return {Promise<boolean>} - true if mining is active */
	async isMiningActive() {
		const result = await chrome.storage.local.get(['miningState']);
		if (!result) { return; }

		const miningState = sanitizer.sanitize(result.miningState);
		return miningState === 'enabled';
	}
	async getConnectionStateFromStorage() {
		const result = await chrome.storage.local.get(['connectionState']);
		if (!result) { return; }
	
		return sanitizer.sanitize(result.connectionState);
	}
	async getIntensityFromStorage() {
		const result = await chrome.storage.local.get(['miningIntensity']);
		if (!result) { return; }
	
		return sanitizer.sanitize(result.miningIntensity);
	}
	setIntensityRangeValue(value = 1) {
		const rangeInput = document.getElementsByName('intensity')[0];
		rangeInput.value = value;
	
		const rangeSpan = document.getElementById('intensityValueStr');
		rangeSpan.innerText = value;
	}
	getIntensityFromSpan() { // MERGE TO MINER CLASSE
		const rangeSpan = document.getElementById('intensityValueStr');
		return parseInt(rangeSpan.innerText);
	}
	initListeners() {
		chrome.storage.onChanged.addListener((changes, namespace) => {
			//console.log(`storage listener received: ${JSON.stringify(changes)}`);
			for (let key in changes) {
				switch (key) {
					case 'hashRate':
						const hashRate = this.sanitizer.sanitize(changes[key].newValue);
						const hashRateElmnt = document.getElementById('hashRateValueStr');
						hashRateElmnt.innerText = hashRate.toFixed(2);
						break;
					case 'miningIntensity':
						const intensity = this.sanitizer.sanitize(changes[key].newValue);
						this.setIntensityRangeValue(intensity);
						break;
					case 'connectionState':
						//console.log(`connectionState listener received: ${changes[key].newValue}`);
						const connectionState = this.sanitizer.sanitize(changes[key].newValue);
						this.connectionState = connectionState;
						break;
					default:
						break;
				}
			}
		});

		this.centerScreenBtn.centerScreenBtnWrap.addEventListener('click', async () => {
			await this.toogleMining();
		});
	}
}
//#endregion

if (false) {
    module.exports = {
        lockCircleObject,
        centerScreenBtnObject,
        mnemonicClass,
        userDataClass,
        tempDataClass,
        mnemoBubbleObject,
        svgLinkObject,
        mnemoLinkSVGObject,
        gameControllerClass,
		communicationClass,
		authInfoObject,
		sanitizerClass,
		Miner,
    };
}
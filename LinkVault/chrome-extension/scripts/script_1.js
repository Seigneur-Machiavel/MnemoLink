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
			//console.log(`Password received: ${JSON.stringify(response.password)}`)
			chrome.storage.local.get(['hashedPassword'], async function(result) {
				const { hash, saltBase64, ivBase64 } = result.hashedPassword;
				const res = await cryptoLight.init(response.password, saltBase64, ivBase64);
				if (res.hash !== hash) { 
					console.info('Wrong password, requesting authentication');
					openModal('authentification');
					return;
				}
				console.log('Valid password, Ready to decrypt!'); 
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
			
			// console.log('idleAnimation duration:', Date.now() - startTimestamp);
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
class mnemoBubbleObject {
	constructor(label, element, x = 0, y = 0) {
		/** @type {HTMLElement} */
		this.element = element;
		this.label = label;
		this.positionLock = false;
		
		this.animation = null;
		this.x = x;
		this.y = y;
		this.vector = { x: 0, y: 0 };
		this.initPosPerc = { 
			x: x / eHTML.dashboard.mnemolinksBubblesContainer.offsetWidth * 100,
			y: y / eHTML.dashboard.mnemolinksBubblesContainer.offsetHeight * 100,
		};
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

		const mnemolinksBubblesContainer = eHTML.dashboard.mnemolinksBubblesContainer;
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
	async prepareBubbleToShow(label, mnemonicStr, fakeCipher = true) {
		if (this.label !== label) { console.error('label mismatch !'); return; }

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
		const mnemonic = mnemonicStr.split(' ');
		const gridHtml = document.createElement('div');
		gridHtml.classList.add('miniMnemonicGrid');
		for (let i = 0; i < mnemonic.length; i++) {
			const wordDiv = document.createElement('div');
			wordDiv.innerText = fakeCipher ? this.#generateRndString( mnemonic[i].length ) : mnemonic[i];
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

		const h2 = document.createElement('h2');
		h2.innerText = this.label;
		this.element.appendChild(h2);

		this.resetPosition();
		this.vector = { x: 0, y: 0 };
		this.element.classList.remove('showing');
		this.positionLock = false;
	}
	resetPosition() {
		this.x = this.initPosPerc.x * eHTML.dashboard.mnemolinksBubblesContainer.offsetWidth / 100;
		this.y = this.initPosPerc.y * eHTML.dashboard.mnemolinksBubblesContainer.offsetHeight / 100;
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
			//path.setAttribute('transition', `d ${d}ms ease-in-out, stroke 120s ease-in-out, stroke-opacity 120ms ease-in-out;`);
			path.style.transition = `d ${d}ms ease-in-out, stroke 120ms ease-in-out, stroke-opacity 120ms ease-in-out`;
			//path.style.backgroundColor = 'red';
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
/** @type {mnemoBubbleObject[]} */
let mnemoBubblesObj = [];
/** @type {mnemoLinkSVGObject[]} */
let mnemoLinkSVGsObj = [];
const centerScreenBtn = new centerScreenBtnObject();
const userData = new userDataClass();
const tempData = {
	rndMnemonic: [],
	rndButtonsPressed: 0,
	mnemonic: new mnemonicClass(),

	init() {
		this.rndMnemonic = [];
		this.rndButtonsPressed = 0;
		this.mnemonic = new mnemonicClass();
	}
};
const eHTML = {
	toggleDarkModeButton: document.getElementById('dark-mode-toggle'),
	footerVersion: document.getElementById('footerVersion'),
	dashboard: {
		element: document.getElementById('dashboard'),
		mnemolinksList: document.getElementById('mnemolinksList'),
		mnemolinksBubblesContainer: document.getElementById('mnemolinksBubblesContainer'),
		linksWrap: document.getElementById('mnemolinksBubblesContainer').children[0],
		bubblesWrap: document.getElementById('mnemolinksBubblesContainer').children[1],
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
		confirmation: {
			wrap : document.getElementById('confirmChoiceModalWrap'),
			modal: document.getElementById('confirmChoiceModalWrap').getElementsByClassName('modal')[0],
			text: document.getElementById('confirmChoiceModalWrap').getElementsByClassName('modalText')[0],
			yesButton: document.getElementById('confirmChoiceModalWrap').getElementsByClassName('modalButton')[0],
			noButton: document.getElementById('confirmChoiceModalWrap').getElementsByClassName('modalButton')[1],
		},
		inputMasterMnemonic: {
			wrap : document.getElementById('masterMnemonicModalWrap'),
			element: document.getElementById('masterMnemonicModalWrap').getElementsByClassName('modal')[0],
			seedWordsValueStr: document.getElementById('masterMnemonicModalWrap').getElementsByClassName('seedWordsValueStr')[0],
			seedWordsRange: document.getElementById('masterMnemonicModalWrap').getElementsByClassName('seedWordsRangeWrap')[0].getElementsByTagName('input')[0],
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
			seedWordsValueStr: document.getElementById('mnemonicModalWrap').getElementsByClassName('seedWordsValueStr')[0],
			seedWordsRange: document.getElementById('mnemonicModalWrap').getElementsByClassName('seedWordsRangeWrap')[0].getElementsByTagName('input')[0],
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
	async userId() {
		const userId = userData.id;
		await this.storeDataLocally('id', userId, save.logs);
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
			//const result = await chrome.storage.local.set({ [key]: data });
			//console.log(result);
			await chrome.storage.local.set({ [key]: data });
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
	async userId() {
		const data = await this.getDataLocally('id')
		const logMsg = !data ? 'No id found !' : 'id loaded !';
		if (load.logs) { console.log(logMsg); }
		if (!data) { return; }

		userData.id = data;
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
}; loadMnemoLinkerLatestVersion();
(async () => {
	await load.all();
	if (userData.preferences.darkMode) { eHTML.toggleDarkModeButton.checked = true; toggleDarkMode(eHTML.toggleDarkModeButton); }
	if (!userData.isMasterMnemonicFilled()) { centerScreenBtn.state = 'welcome'; }
	centerScreenBtn.init(7);
})();
function toggleDarkMode(element) {
	if (element.checked) {
		document.body.classList.add('dark-mode');
		eHTML.dashboard.element.classList.add('invertColors');
		eHTML.modals.wrap.classList.add('invertColors');
		eHTML.dashboard.linksWrap.classList.add('invertColors');
		centerScreenBtn.element.classList.add('invertColors');
	} else {
		document.body.classList.remove('dark-mode');
		eHTML.dashboard.element.classList.remove('invertColors');
		eHTML.modals.wrap.classList.remove('invertColors');
		eHTML.dashboard.linksWrap.classList.remove('invertColors');
		centerScreenBtn.element.classList.remove('invertColors');
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
	fillMnemoLinkList();
	initMnemoLinkBubbles();
	requestAnimationFrame(UXupdateLoop);
	if (logs) { console.log('Ready to decrypt!'); }
	return true;
};
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

	const result = { allWordsAreValid: true, mnemonic: new mnemonicClass() };
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

	result.mnemonic = new mnemonicClass(mnemonic, bip, language);

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

	// if master mnemonic is already filled - and password is correct
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
async function toggleDashboard() {
	const dashboard = eHTML.dashboard.element;
	const appTitleWrap = document.getElementById('appTitleWrap');

	const isClose = !dashboard.classList.contains('open');
	if (isClose) {
		clearTimeout(timeOuts["appTitleWrapVisible"]); // cancel the timeout to show the app title
		
		await centerScreenBtn.unlock();
		dashboard.classList.add('open');
		appTitleWrap.classList.remove('visible');
		
		//initMnemoLinkBubbles();
		eHTML.dashboard.mnemolinksBubblesContainer.classList.add('visible');
		mnemoBubblesObj.forEach((bubble) => { bubble.stopShowing(false); });
	} else {
		timeOuts["appTitleWrapVisible"] = setTimeout(() => { 
			appTitleWrap.classList.add('visible'); 
			centerScreenBtn.lock();
		}, 800);
		
		dashboard.classList.remove('open');
		mnemoBubblesObj.forEach((bubble) => { bubble.toCenterContainer(480); });
		eHTML.dashboard.mnemolinksBubblesContainer.classList.remove('visible');
	}
}
function prepareConfirmationModal(text = "Are you sure?", yesCallback = () => {}, noCallback = () => { closeModal(); }) {
	const modal = eHTML.modals.confirmation;
	modal.text.innerText = text;
	modal.yesButton.onclick = yesCallback;
	modal.noButton.onclick = noCallback;
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
	switchBtnsIfMnemonicGridIsFilled('masterMnemonicModalWrap');
	switchBtnsIfMnemonicGridIsFilled('mnemonicModalWrap');

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
function setNumberOfVisibleWordsInMnemonicGrid(mnemonicGridInputs, nbOfWords = 12) {
	for (let i = 0; i < mnemonicGridInputs.length; i++) {
		const input = mnemonicGridInputs[i];
		if (i < nbOfWords) {
			input.parentElement.classList.remove('hidden');
		} else {
			input.parentElement.classList.add('hidden');
		}
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
		return { allWordsAreValid: false, mnemonic: new mnemonicClass() };
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
function createMnemoLinkBubbleElement(label = 'toto') {
	const newMnemoLink = document.createElement('div');
	newMnemoLink.classList.add('mnemolinkBubble');

	const h2 = document.createElement('h2');
	h2.innerText = label;
	newMnemoLink.appendChild(h2);
	
	return newMnemoLink;
}
function clearMnemonicBubbleShowing() {
	mnemoBubblesObj.forEach((mnemoBubbleObj) => {
		mnemoBubbleObj.stopShowing();
	});

	// reset showBtns
	const showBtns = document.getElementsByClassName('showBtn');
	for (let i = 0; i < showBtns.length; i++) {
		showBtns[i].classList.remove('showing');
	}
}
function initMnemoLinkBubbles(intRadiusInFractionOfVH = 0.074, angleDecay = -1.5) {
	const mnemolinksBubblesContainer = eHTML.dashboard.mnemolinksBubblesContainer;
	const radius = window.innerHeight * intRadiusInFractionOfVH;
	const center_x = mnemolinksBubblesContainer.offsetWidth / 2;
	const center_y = mnemolinksBubblesContainer.offsetHeight / 2;
	
	const bubblesWrap = eHTML.dashboard.bubblesWrap;
	bubblesWrap.innerHTML = '';
	const monemoLinksLabels = userData.getListOfMnemoLinks();
	const total = settings.mnemolinkBubblesMinCircleSpots > monemoLinksLabels.length ? settings.mnemolinkBubblesMinCircleSpots : monemoLinksLabels.length;
	
	mnemoBubblesObj = [];
	for (let i = 0; i < monemoLinksLabels.length; i++) {
		const element = createMnemoLinkBubbleElement();
		bubblesWrap.appendChild(element);

		const angle = (i / total) * (2 * Math.PI) + angleDecay; // Angle for each element
		
		const x = center_x + radius * Math.cos(angle);
		const y = center_y + radius * Math.sin(angle);

		const mnemoBubbleObj = new mnemoBubbleObject(monemoLinksLabels[i], element, x, y);
		mnemoBubbleObj.toCenterContainer(0);
		mnemoBubblesObj.push(mnemoBubbleObj);
	}

	initMnemoLinkSVGs();
}
function initMnemoLinkSVGs() {
	const linksWrap = eHTML.dashboard.linksWrap;
	const mnemolinkLinks = linksWrap.getElementsByClassName('mnemolinkLink');

	// sequence = [4, 10, 60] => [4, 14, 0] => [8, 18, 4] => ... => [0, 10, 60]
	let sequence = [8, 16, 32];
	//let sequence = [20, 40, 200];
	//let sequence = [4, 30, 60];
	const sequenceFrames = sequence[sequence.length - 1];
	const sequenceIncrement = sequence[0];
	function updateSequence(sequenceIncrement) {
		let newSquence = [];
		for (let i = 0; i < sequence.length; i++) {
			let newFrame = sequence[i] + sequenceIncrement;
			while (newFrame > sequenceFrames) {
				newFrame -= sequenceFrames;
			}
			newSquence.push(newFrame);
		}

		return newSquence;
	}

	if (mnemolinkLinks.length !== mnemoBubblesObj.length) {
		console.log('re create links svg');
		mnemoLinkSVGsObj = [];
		linksWrap.innerHTML = '';
		for (let i = 0; i < mnemoBubblesObj.length; i++) {
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.classList.add('mnemolinkLink');
			linksWrap.appendChild(svg);

			const mnemoLinkSVG = new mnemoLinkSVGObject(svg, mnemoBubblesObj[i].x, mnemoBubblesObj[i].y, sequence);
			mnemoLinkSVGsObj.push(mnemoLinkSVG);
			updateSequence(sequenceIncrement);
		};
	}
}
let MnemoBubblesNaNError = 0;
function positionMnemoLinkBubbles(extRadiusInFractionOfVH = 0.26) {
	const isModalOpen = !eHTML.modals.wrap.classList.contains('fold');
	let circleRadius = window.innerHeight * extRadiusInFractionOfVH;
	if (isModalOpen) { circleRadius *= 0.5; }

	const maxSpeed = .32;
	const acceleration = 0.004;
	const mnemolinksBubblesContainer = eHTML.dashboard.mnemolinksBubblesContainer;
	const center_x = mnemolinksBubblesContainer.offsetWidth / 2;
	const center_y = mnemolinksBubblesContainer.offsetHeight / 2;
	
	for (let i = 0; i < mnemoBubblesObj.length; i++) {
		/** @type {mnemoBubbleObject} */
		const mnemoBubbleObj = mnemoBubblesObj[i];
		if (mnemoBubbleObj.positionLock) { continue; }

		const isOutCircle = Math.sqrt((mnemoBubbleObj.x - center_x) ** 2 + (mnemoBubbleObj.y - center_y) ** 2) > circleRadius;
		const isOutCirclePlus = Math.sqrt((mnemoBubbleObj.x - center_x) ** 2 + (mnemoBubbleObj.y - center_y) ** 2) > circleRadius * 1.2;
		const isInCircleMinus = Math.sqrt((mnemoBubbleObj.x - center_x) ** 2 + (mnemoBubbleObj.y - center_y) ** 2) < circleRadius * .8;
		const isInPerfectRange = !isOutCirclePlus && !isInCircleMinus;
		const remainingDistance = Math.sqrt((mnemoBubbleObj.x - center_x) ** 2 + (mnemoBubbleObj.y - center_y) ** 2) + ( isOutCircle ? -circleRadius : circleRadius );

		const dx = isOutCircle ? center_x - mnemoBubbleObj.x : mnemoBubbleObj.x - center_x;
		const dy = isOutCircle ? center_y - mnemoBubbleObj.y : mnemoBubbleObj.y - center_y;
		const angle = Math.atan2(dy, dx);
		const isOppositeSpeed = Math.sign(mnemoBubbleObj.vector.x) !== Math.sign(dx) || Math.sign(mnemoBubbleObj.vector.y) !== Math.sign(dy);
		
		//if (i === 0) { console.log( Math.sqrt(dx * dx + dy * dy) ) }
		const maxSpeed_ = isInPerfectRange ? maxSpeed * .2 : maxSpeed;
		let speed = Math.min(maxSpeed_, Math.sqrt(dx * dx + dy * dy) * acceleration);
		speed = isOppositeSpeed ? speed * 6 : speed;

		const rnd_ = isOutCirclePlus ? 1 : rnd(0, 1) < .4 ? 0 : 1;
		let speedMultiplicator = rnd_ * ( isOutCircle ? (remainingDistance / circleRadius * 8) : (remainingDistance / circleRadius * 1) );
		speedMultiplicator = isOutCircle ? Math.pow(speedMultiplicator, .1) : speedMultiplicator;

		mnemoBubbleObj.vector.x += Math.cos(angle) * speed * speedMultiplicator;
		mnemoBubbleObj.vector.y += Math.sin(angle) * speed * speedMultiplicator;
		if (isNaN(mnemoBubbleObj.vector.x) || isNaN(mnemoBubbleObj.vector.y)) {
			MnemoBubblesNaNError++;
			if (MnemoBubblesNaNError > 30) {
				MnemoBubblesNaNError = 0;
				initMnemoLinkBubbles();
				if (!eHTML.dashboard.element.classList.contains('open')) { return; }
				mnemoBubblesObj.forEach((bubble) => { bubble.stopShowing(false);})
				return;
			}
		}
		
		mnemoBubbleObj.updatePosition()
	};
}
function positionLinkSVGs() {
	/** @type {HTMLElement} */
	const linksWrapContainer = eHTML.dashboard.linksWrap;

	for (let i = 0; i < mnemoLinkSVGsObj.length; i++) {
		const mnemoLinkSVGObj = mnemoLinkSVGsObj[i];
		mnemoLinkSVGObj.containerHalfWidth = linksWrapContainer.offsetWidth / 2;
		mnemoLinkSVGObj.containerHalfHeight = linksWrapContainer.offsetHeight / 2;
		mnemoLinkSVGObj.deltaBetweenLastTarget = mnemoLinkSVGObj.calculateDistance(mnemoLinkSVGObj.targetX, mnemoLinkSVGObj.targetY, mnemoBubblesObj[i].x, mnemoBubblesObj[i].y);
		mnemoLinkSVGObj.targetX = mnemoBubblesObj[i].x;
		mnemoLinkSVGObj.targetY = mnemoBubblesObj[i].y;
		mnemoLinkSVGObj.update();
	}
}
async function UXupdateLoop() {
	positionMnemoLinkBubbles();
	positionLinkSVGs();

	requestAnimationFrame(UXupdateLoop);
}
//#endregion

//#region - EVENT LISTENERS
window.addEventListener('resize', () => {
	initMnemoLinkBubbles();
	
	// release bubbles
	setTimeout(() => {
		if (!eHTML.dashboard.element.classList.contains('open')) { return; }
		mnemoBubblesObj.forEach((bubble) => { bubble.stopShowing(false);}) 
	}, 600);
});
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
		centerScreenBtn.lock();

		await new Promise(r => setTimeout(r, 600));

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
	}

	if (event.target.id === 'linkNewMnemonicBtn') { openModal('inputMnemonic'); return }
	
	const isTargetBubbleOrShowBtn = event.target.classList.contains('mnemolinkBubble') || event.target.classList.contains('showBtn');
	if (!isTargetBubbleOrShowBtn) {
		/** @type {mnemoBubbleObject} */
		const bubbleShowing = mnemoBubblesObj.find((mnemoBubbleObj) => mnemoBubbleObj.element.classList.contains('showing'));
		if (!bubbleShowing) { return; }
		
		const mnemonic = (() => {
			if (!event.target.parentElement.classList.contains('active')) { return false; }
			const gridChildren = bubbleShowing.element.getElementsByClassName('miniMnemonicGrid')[0].children;
			let mnemonicStr = '';
			for (let i = 0; i < gridChildren.length; i++) {
				mnemonicStr += gridChildren[i].innerText + ' ';
			}
			return mnemonicStr;
		})();

		const mnemolinkBubbleCopyBtn = document.getElementById('bubbleCopyBtn');
		if (mnemonic && event.target === mnemolinkBubbleCopyBtn) {
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
		if (mnemonic && event.target === mnemolinkBubbleDownloadBtn) {
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
		
		// close bubble if click outside mnemolinkBubble modal
		const mnemolinkBubble = bubbleShowing.element;
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
document.addEventListener('input', (event) => {
	const isSeedWordsRange = event.target.name === "seedWords";
	if (!isSeedWordsRange) { return; }

	const parentModalWrap = event.target.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
	const isMasterMnemonicModal = parentModalWrap.id === eHTML.modals.inputMasterMnemonic.wrap.id;
	if (isMasterMnemonicModal) {
		console.log(parseInt(event.target.value));
		const nbOfWords = parseInt(event.target.value) < 12 ? 12 : parseInt(event.target.value);
		eHTML.modals.inputMasterMnemonic.seedWordsValueStr.innerText = nbOfWords;
		setNumberOfVisibleWordsInMnemonicGrid(eHTML.modals.inputMasterMnemonic.mnemonicGridInputs, nbOfWords);
		switchBtnsIfMnemonicGridIsFilled('masterMnemonicModalWrap');
	}
	
	const isMnemonicModal = parentModalWrap.id === eHTML.modals.inputMnemonic.wrap.id;
	if (isMnemonicModal) {
		const mnemonicLengths = [12, 15, 18, 21, 24];
		const nbOfWords = mnemonicLengths[parseInt(event.target.value) -1] ? mnemonicLengths[parseInt(event.target.value) -1] : 12;
		eHTML.modals.inputMnemonic.seedWordsValueStr.innerText = nbOfWords;
		setNumberOfVisibleWordsInMnemonicGrid(eHTML.modals.inputMnemonic.mnemonicGridInputs, nbOfWords);
		switchBtnsIfMnemonicGridIsFilled('mnemonicModalWrap');
	}
});
document.addEventListener('paste', (event) => {
	const target = event.target;
	if (target.tagName !== 'INPUT') { return; }

	const modalWrapId = target.parentElement.parentElement.parentElement.parentElement.parentElement.id;
	const isMasterMnemonicModal = modalWrapId === eHTML.modals.inputMasterMnemonic.wrap.id;
	const isMnemonicModal = modalWrapId === eHTML.modals.inputMnemonic.wrap.id;
	if (!isMasterMnemonicModal && !isMnemonicModal) { return; }
	
	const pastedText = event.clipboardData.getData('text');
	const pastedWords = pastedText.split(' ');
	
	const cleanedPastedWords = [];
	for (let i = 0; i < pastedWords.length; i++) {
		const word = pastedWords[i];
		if (word.length < 2 || word.match(/[^a-zA-Z]/g)) { continue; }
		cleanedPastedWords.push(word);
	}
	
	// control number of words
	if (cleanedPastedWords.length < 12) { modalInfo(eHTML.modals.inputMasterMnemonic, "Mnemonic must contain at least 12 words!", 3000); return; }
	if (isMasterMnemonicModal) {
		eHTML.modals.inputMasterMnemonic.seedWordsRange.value = cleanedPastedWords.length;
		eHTML.modals.inputMasterMnemonic.seedWordsValueStr.innerText = cleanedPastedWords.length; 
	}
	if (isMnemonicModal) { 
		const mnemonicLengths = [12, 15, 18, 21, 24];
		if (!mnemonicLengths.includes(cleanedPastedWords.length)) { modalInfo(eHTML.modals.inputMnemonic, "Mnemonic must contain 12, 15, 18, 21 or 24 words!", 3000); return; }
		eHTML.modals.inputMnemonic.seedWordsRange.value = mnemonicLengths.indexOf(cleanedPastedWords.length);
		eHTML.modals.inputMnemonic.seedWordsValueStr.innerText = cleanedPastedWords.length; 
	}

	// control language
	const randomizeBtn = isMasterMnemonicModal ? eHTML.modals.inputMasterMnemonic.randomizeBtn : eHTML.modals.inputMnemonic.randomizeBtn;
	const result = emptyMnemoLinker.getBIPTableFromMnemonic(cleanedPastedWords);
	const initialLanguage = randomizeBtn.classList[1];
	if (!result.language) { modalInfo(eHTML.modals.inputMasterMnemonic, "Language can't be detected!", 3000); return; }
	randomizeBtn.classList.remove(initialLanguage);
	randomizeBtn.classList.add(result.language);
	
	event.preventDefault();
	const targetGrid = isMnemonicModal ? eHTML.modals.inputMnemonic.mnemonicGridInputs : eHTML.modals.inputMasterMnemonic.mnemonicGridInputs;
	setNumberOfVisibleWordsInMnemonicGrid(targetGrid, cleanedPastedWords.length);
	
	for (let i = 0; i < cleanedPastedWords.length; i++) {
		const input = targetGrid[i];
		input.value = cleanedPastedWords[i];
	}

	const extracted = switchBtnsIfMnemonicGridIsFilled(modalWrapId);
	if (!extracted.allWordsAreValid) { return; }
	tempData.mnemonic = extracted;
});
centerScreenBtn.element.addEventListener('click', async (event) => { event.preventDefault(); await centerScreenBtnAction(); });
// DASHBOARD : MNEMOLINKS LIST
document.addEventListener('mousedown', (event) => {
	if (!event.target.classList.contains('mnemolinkInput')) { return; }
	event.preventDefault();
});
document.addEventListener('focusout', (event) => {
	// correspond to the "eHTML.dashboard.mnemolinksList" event listener, but work better using "document" event listener
	// console.log(`focusout: ${event.target.tagName}`);
	if (!event.target.classList.contains('mnemolinkInput')) { return; }

	/** @type {HTMLInputElement} */
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
	} else {
		mnemolinkInput.classList.add('wrong');
		mnemolinkInput.value = mnemolinkInput.defaultValue;
		setTimeout(() => { mnemolinkInput.classList.remove('wrong'); }, 500);
	}
	
	editBtn.classList.remove('trash');
	mnemolinkInput.readOnly = true;
});
eHTML.dashboard.mnemolinksList.addEventListener('mouseover', (event) => {
	mnemoBubblesObj.forEach((mnemoBubbleObj) => { mnemoBubbleObj.element.classList.remove('hoverFromList'); });
	const mnemolinkInputs = document.getElementsByClassName('mnemolinkInput')
	for (let i = 0; i < mnemolinkInputs.length; i++) { mnemolinkInputs[i].classList.remove('hoverFromList'); }
	const mnemolink = event.target.classList.contains('mnemolink') ? event.target : event.target.parentElement;
	if (!mnemolink.classList.contains('mnemolink')) { return; }

	// if mnemolink hover
	const index = Array.from(mnemolink.parentElement.children).indexOf(mnemolink);

	const mnemoBubbleObj = mnemoBubblesObj[index];
	if (!mnemoBubbleObj) { console.error(`mnemoBubbleObj not found for index: ${index}`); return; }
	mnemoBubbleObj.element.classList.add('hoverFromList');
	
	/*const mnemoLinkSVGObj = mnemoLinkSVGsObj[index]; // ABORTED - USELESS DESIGN...
	if (!mnemoLinkSVGObj) { console.error(`mnemoLinkSVGObj not found for index: ${index}`); return; }
	const angle360 = (mnemoLinkSVGObj.angle + Math.PI) * 180 / Math.PI;
	centerScreenBtn.rotate(angle360);*/

	const mnemolinkInput = mnemolink.getElementsByClassName('mnemolinkInput')[0];
	mnemolinkInput.classList.add('hoverFromList');
});
eHTML.dashboard.mnemolinksList.addEventListener('mouseout', (event) => {
	mnemoBubblesObj.forEach((mnemoBubbleObj) => { mnemoBubbleObj.element.classList.remove('hoverFromList'); });
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

			prepareConfirmationModal(
				`Delete MnemoLink: ${label}?`,
				async () => {
					closeModal();
					userData.removeMnemoLink(label);
					save.userMnemoLinks();
		
					fillMnemoLinkList();
					initMnemoLinkBubbles();
					
					// release bubbles
					setTimeout(() => { mnemoBubblesObj.forEach((bubble) => { bubble.stopShowing(false);}) }, 600);
				},
				() => { 
					closeModal();
					event.target.classList.remove('trash');
					const mnemolinkInput = event.target.parentElement.getElementsByClassName('mnemolinkInput')[0];
					mnemolinkInput.readOnly = true;
				}
			);

			openModal('confirmation');
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
			const mnemonicStr = await userData.getMnemoLinkDecrypted(label, true);
			if (!mnemonicStr) { console.error(`Unable to get decrypted mnemonicStr for MnemoLink: ${label}`); return; }
			
			await mnemoBubblesObj[index].prepareBubbleToShow(label, mnemonicStr);
			await mnemoBubblesObj[index].decipherMiniMnemonicGrid(mnemonicStr);
			
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
	setTimeout(() => { centerScreenBtnAction() }, 600);
	setTimeout(async () => { 
		/** @type {MnemoLinker} */
		const mnemoLinker = new MnemoLinkerLastest( { pseudoMnemonic: mnemonic } );
		const id = await mnemoLinker.genPublicId();
		userData.id = id;
		save.userId();
	}, 200);

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
	//console.log('MnemoLink added and saved');

	fillMnemoLinkList();
	initMnemoLinkBubbles();
	tempData.init();

	closeModal();
	// release bubbles
	setTimeout(() => { mnemoBubblesObj.forEach((bubble) => { bubble.stopShowing(false);}) }, 600);

	eHTML.modals.inputMnemonic.confirmBtn.classList.remove('busy');
});
//#endregion
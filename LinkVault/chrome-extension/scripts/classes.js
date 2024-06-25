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
		if (oldLabel === newLabel) { if (logs) { return true; } }
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

		const targetMnemoLinkerClass = await MnemoLinker[versionStr];
		if (!targetMnemoLinkerClass) { if (logs) { console.error('version not found !'); return false; } }

		const masterMnemonicStr = await this.getMasterMnemonicStr();
		if (!masterMnemonicStr) { if (logs) { console.error('masterMnemonicStr not found !'); return false; } }

		if (logs) { console.log(`versionStr: ${versionStr}`); }
		try {
			/** @type {MnemoLinker} */
			const targetMnemoLinker = new targetMnemoLinkerClass( { pseudoMnemonic: masterMnemonicStr } );
			const mnemoLinkDecrypted = await targetMnemoLinker.decryptMnemoLink(mnemoLinkEncrypted);
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
};
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
			x: x / eHTML.vault.mnemolinksBubblesContainer.offsetWidth * 100,
			y: y / eHTML.vault.mnemolinksBubblesContainer.offsetHeight * 100,
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
    };
}
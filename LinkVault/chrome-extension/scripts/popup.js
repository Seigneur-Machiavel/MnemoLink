if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)-
    const anime = require("./anime.min.js");
	const { cryptoLight } = require("./cryptoLight.js");
    const { lockCircleObject, centerScreenBtnObject, communicationClass, authInfoObject, sanitizerClass, Miner } = require("./classes.js");
    const { htmlAnimations } = require("./htmlAnimations.js");
}

cryptoLight.useArgon2Worker = true; console.log('Argon2 worker enabled!');
const settings = {
    appVersion: chrome.runtime.getManifest().version,
    minVersionAcceptedWithoutReset: '1.2.0',
    hardcodedPassword: '123456',
    serverUrl: "http://localhost:4340"
};
let resizePopUpAnimations = [];
const sanitizer = new sanitizerClass();
const communication = new communicationClass(settings.serverUrl);
const centerScreenBtn = new centerScreenBtnObject();
const miner = new Miner(centerScreenBtn, communication);
centerScreenBtn.state = 'welcome';
centerScreenBtn.init(7);

const busy = [];
//#region - UX FUNCTIONS
function resizePopUp(applyBLur = true, duration = 200) {
    const contentDiv = document.getElementById('popUpContent');
    const contentWrap = contentDiv.children[0];
    const contentDivHeight = contentDiv.offsetHeight;
    const contentWrapHeight = contentWrap.offsetHeight;
    const contentHeight = Math.max(contentDivHeight, contentWrapHeight);
    const newHeight = contentHeight; // + 29;
    console.log(`New height: ${newHeight}px`);
    resizePopUpAnimations = [];
    
    resizePopUpAnimations[0] = anime({
        targets: 'body',
        width: '300px',
        height: `${newHeight}px`,
        filter: applyBLur ? 'blur(2px)' : 'blur(0px)',
        duration,
        easing: 'easeInOutQuad',
        complete: () => {
            if (!applyBLur) { return; }
            resizePopUpAnimations[1] = anime({
                targets: 'body',
                filter: ['blur(4px) brightness(1.4)', 'blur(0px) brightness(1)'],
                easing: 'easeInOutQuad',
                duration: 400
            });
        }
    });
}
async function setMiningIntensityFromLocalStorage() {
    const miningIntensity = await chrome.storage.local.get('miningIntensity');
    const intensity = miningIntensity.miningIntensity || 1;
    document.getElementsByName('intensity')[0].value = intensity;
    document.getElementById('intensityValueStr').innerText = intensity;
}
function setVisibleForm(formId, applyBLur = true) {
    const miningBtn = document.getElementById('miningBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    miningBtn.classList.add('active');
    settingsBtn.classList.add('active');

    centerScreenBtn.centerScreenBtnWrap.classList.remove('active');
    const centerScreenBtnContrainer = document.getElementsByClassName('centerScreenBtnContrainer')[0];
    centerScreenBtnContrainer.classList.remove('hidden');

    const forms = document.getElementsByTagName('form');
    for (let i = 0; i < forms.length; i++) {
        if (forms[i].id === formId) { forms[i].classList.remove('hidden'); continue; }
        forms[i].classList.add('hidden');
    }

    if (formId === "passwordCreationForm" || formId === "loginForm") {
        miningBtn.classList.remove('active');
    }

    if (formId === "miningForm") {
        centerScreenBtn.centerScreenBtnWrap.classList.add('active');
        miningBtn.classList.remove('active');
        setTimeout(async () => { setMiningIntensityFromLocalStorage() }, 100);
    }

    if (formId === "settingsForm") {
        const centerScreenBtnContrainer = document.getElementsByClassName('centerScreenBtnContrainer')[0];
        centerScreenBtnContrainer.classList.add('hidden');
        settingsBtn.classList.remove('active');
    }

    resizePopUp(applyBLur);
}
function setInitialInputValues() {
    const hardcodedPassword = settings.hardcodedPassword;
    document.getElementById('loginForm').getElementsByTagName('input')[0].value = hardcodedPassword;
    document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value = hardcodedPassword;
    document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value = hardcodedPassword;
}
/**
 * Show the form depending on the stored auth info
 * @param {authInfoObject} sanitizedAuthInfo - result of chrome.storage.local.get(['authInfo']).authInfo
 */
function showFormDependingOnStoredPassword(sanitizedAuthInfo) { // DEPRECATED
    const { hash, salt1Base64, iv1Base64 } = sanitizedAuthInfo;
    if (hash && salt1Base64 && iv1Base64) {
        setVisibleForm('loginForm');
        document.getElementById('loginForm').getElementsByTagName('input')[0].focus();
    } else {
        setVisibleForm('passwordCreationForm');
        document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].focus();
    }
}
function bottomInfo(targetForm, text, timeout = 3000) {
    const infoElmnt = targetForm.getElementsByClassName('bottomInfo')[0];

	infoElmnt.innerText = text;

	setTimeout(() => {
		infoElmnt.innerText = "";
	}, timeout);
}
function setWaitingForConnectionFormLoading(loading = true) {
    const waitingForConnectionForm = document.getElementById('waitingForConnectionForm');
    const loadingSvg = waitingForConnectionForm.getElementsByClassName('loadingSvgDiv')[0];
    loadingSvg.innerHTML = loading ? htmlAnimations.horizontalBtnLoading : '';
}
function setWaitingForConnectionFormText(text) {
    const waitingForConnectionForm = document.getElementById('waitingForConnectionForm');
    const blinkingText = waitingForConnectionForm.getElementsByTagName('h2')[0];
    blinkingText.innerText = text;
}
function initUI() {
    document.body.style.width = "0px";
    document.body.style.height = "0px";
}
//#endregion

//#region - FUNCTIONS
(async () => { // --- START ---
    initUI();
    setWaitingForConnectionFormLoading();

    // Check if the vault is unlocked: if not, show the "password creation/login" form
    const vaultState = await chrome.storage.local.get(['vaultUnlocked']);
    console.log(`Vault is ${vaultState.vaultUnlocked ? 'unlocked' : 'locked'}`);

    if (!vaultState || !vaultState.vaultUnlocked) {
        await initAuth();
    } else {
        const connectionResult = await pingServerAndSetMode();
        if (!connectionResult) { return; }

        setVisibleForm('miningForm');

        miner.init();
        centerScreenBtn.delayBeforeIdleAnimationIfLocked = 1;

        /*const bottomBar = document.getElementById('bottomBar');
        bottomBar.classList.remove('hidden');*/ // --> now it's always visible
    }
})();
async function pingServerAndSetMode(iterations = 10, delay = 2000) {
    let tries = 0;
    while (tries < iterations) {
        const localServerIsRunning = await communication.pingServer("http://localhost:4340");
        const webServerIsRunning = await communication.pingServer("https://www.linkvault.app");
        if (!localServerIsRunning && webServerIsRunning) {
            console.log('Running as production mode...');
            settings.hardcodedPassword = '';
            settings.serverUrl = "https://www.linkvault.app";
            communication.url = settings.serverUrl;
            return 'production';
        } else if (localServerIsRunning) {
            console.info('Running as development mode...');
            return 'development';
        }

        if (tries === 0) {setVisibleForm('waitingForConnectionForm');}
        tries++;
        setWaitingForConnectionFormText(`Waiting for connection... (${tries}/${iterations})`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    setWaitingForConnectionFormLoading(false);
    setWaitingForConnectionFormText('Cannot connect to any server!');
    return false;
}
async function initAuth() {
    setInitialInputValues();

    const authInfoResult = await chrome.storage.local.get(['authInfo']);
    /** @type {authInfoObject} */
    const sanitizedAuthInfo = authInfoResult.authInfo ? sanitizer.sanitize(authInfoResult.authInfo) : {};

    if (authInfoResult.authInfo) {
        const resetNecessary = controlVersion(sanitizedAuthInfo);
        if (resetNecessary) { await resetApplication(); }
    }

    if (authInfoResult.authInfo && authInfoResult.authInfo.serverAuthBoost) {
        const connectionResult = await pingServerAndSetMode();
        if (!connectionResult) { return; }
    }

    //showFormDependingOnStoredPassword(sanitizedAuthInfo);
    const { hash, salt1Base64, iv1Base64 } = sanitizedAuthInfo;
    if (hash && salt1Base64 && iv1Base64) {
        chrome.runtime.sendMessage({action: "openPage", password: null});
    } else {
        setVisibleForm('passwordCreationForm');
        document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].focus();
    }
}
/**
 * Check if the stored password is compatible with the current version of the application
 * @param {object} sanitizedAuthInfo - result of chrome.storage.local.get(['authInfo']).authInfo
 * @returns {boolean} - true if reset is necessary
 */
function controlVersion(sanitizedAuthInfo) {
        const { appVersion, serverAuthBoost } = sanitizedAuthInfo;
        console.log(`App version: ${appVersion}, minVersionAcceptedWithoutReset: ${settings.minVersionAcceptedWithoutReset}`);
        console.log(appVersion)
        if (!appVersion) { return true; }

        // Here we can proceed check for version compatibility
        /*const appV = settings.appVersion.split('.');
        const minV = settings.minVersionAcceptedWithoutReset.split('.');

        if (parseInt(appV[0]) < parseInt(minV[0])) { return true; }
        if (parseInt(appV[0]) > parseInt(minV[0])) { return false; }

        if (parseInt(appV[1]) < parseInt(minV[1])) { return true; }
        if (parseInt(appV[1]) > parseInt(minV[1])) { return false; }

        if (parseInt(appV[2]) < parseInt(minV[2])) { return true; }*/
        return false;
}
async function setNewPassword(password, passComplement = false) {
    const startTimestamp = Date.now();

    const passwordReadyUse = passComplement ? `${password}${passComplement}` : password;
    const authInfo = await cryptoLight.generateKey(passwordReadyUse);
    if (!authInfo || !authInfo.encodedHash || !authInfo.salt1Base64 || !authInfo.iv1Base64) { console.error('cryptoLight.generateKey() failed'); return false; }

    const weakEncryptionReady = await cryptoLight.generateKey(password, authInfo.salt1Base64, authInfo.iv1Base64);
    if (!weakEncryptionReady) { console.error('cryptoLight.generateKey() failed'); return false; }
    if (authInfo.salt1Base64 !== weakEncryptionReady.salt1Base64 || authInfo.iv1Base64 !== weakEncryptionReady.iv1Base64) { console.error('Salt1 or IV1 mismatch'); return false; }
    
    const authToken = cryptoLight.generateRndBase64(32); // authToken - used to authenticate the user on the server
    const authTokenHash = await cryptoLight.encryptText(authToken);

    const encryptedPassComplement = passComplement ? await cryptoLight.encryptText(passComplement) : false;
    if (passComplement && !encryptedPassComplement) { console.error('Pass complement encryption failed'); return false; }
    cryptoLight.clear();

    const authID = generateAuthID(); // authID - used to link the passComplement on the server
    await chrome.storage.local.set({
        authInfo: {
            appVersion: settings.appVersion,
            authID,
            authToken,
            hash: authInfo.encodedHash,
            salt1Base64: authInfo.salt1Base64,
            iv1Base64: authInfo.iv1Base64,
            serverAuthBoost: passComplement ? true : false
        }
    }, function () {
        console.log(`Password set, salt1: ${authInfo.salt1Base64}, iv1: ${authInfo.iv1Base64}`);
    });

    const totalTimings = {
        argon2Time: authInfo.argon2Time + weakEncryptionReady.argon2Time,
        deriveKTime: authInfo.deriveKTime + weakEncryptionReady.deriveKTime,
        total: Date.now() - startTimestamp
    };
    return passComplement ? { authID, authTokenHash, encryptedPassComplement, totalTimings } : true;
}
async function resetApplication() {
    await chrome.storage.local.clear(function() {
        var error = chrome.runtime.lastError;
        if (error) {
            console.error(error);
        } else {
            console.log('Application reset');
            setVisibleForm('passwordCreationForm');
            document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].focus();
        }
    });
}
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }
function generateAuthID(length = 32) {
    const authorized = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += authorized[rnd(0, authorized.length - 1)];
    }
    return result;
}
//#endregion

//#region - EVENT LISTENERS
document.getElementById('passwordCreationForm').addEventListener('submit', async function(e) {
    if (busy.includes('passwordCreationForm')) return;
    busy.push('passwordCreationForm');

    e.preventDefault();
    console.log(`serverAuthBoost: ${document.getElementById('serverAuthBoost').checked}`);
    const serverAuthBoost = document.getElementById('serverAuthBoost').checked;
    cryptoLight.cryptoStrength = serverAuthBoost ? 'medium' : 'heavy';

    const passComplement = serverAuthBoost ? cryptoLight.generateRndBase64(32) : false;
    const passwordMinLength = serverAuthBoost ? 6 : 12;
    const password = document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value;
    const passwordConfirm = document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value;
    
    if (password !== passwordConfirm) {
        alert('Passwords do not match');
    } else if (password.length < passwordMinLength) {
        alert(`Password must be at least ${passwordMinLength} characters long`);
    } else {
        const button = document.getElementById('passwordCreationForm').getElementsByTagName('button')[0];
        button.innerHTML = htmlAnimations.horizontalBtnLoading;
        const passwordCreatedInfo = await setNewPassword(password, passComplement);
        setTimeout(() => { button.innerHTML = 'Set password'; }, 1000);
        if (!passwordCreatedInfo) { alert('Password setting failed'); busy.splice(busy.indexOf('passwordCreationForm'), 1); return; }

        document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value = '';
        document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value = '';

       if (serverAuthBoost) {
            const { authID, authTokenHash, encryptedPassComplement, totalTimings } = passwordCreatedInfo;
            const keyPair = await cryptoLight.generateKeyPair();
            const exportedPubKey = await cryptoLight.exportPublicKey(keyPair.publicKey);

            const serverResponse = await communication.sharePubKeyWithServer(authID, exportedPubKey);
            if (!serverResponse) { alert('Server communication failed'); busy.splice(busy.indexOf('passwordCreationForm'), 1); resetApplication(); return; }
            if (!serverResponse.success) { alert(serverResponse.message); busy.splice(busy.indexOf('passwordCreationForm'), 1); resetApplication(); return; }

            const serverPublicKey = await cryptoLight.publicKeyFromExported(serverResponse.serverPublicKey);

            const serverResponse2 = await communication.sendAuthDataToServer(serverPublicKey, authID, authTokenHash, encryptedPassComplement, totalTimings);
            if (!serverResponse2) { alert('Server communication failed'); busy.splice(busy.indexOf('passwordCreationForm'), 1); resetApplication(); return; }
            if (!serverResponse2.success) { alert(serverResponse2.message); busy.splice(busy.indexOf('passwordCreationForm'), 1); resetApplication(); return; }
       }

        chrome.runtime.sendMessage({action: "openPage", password: passComplement ? `${password}${passComplement}` : password });
    }
    
    busy.splice(busy.indexOf('passwordCreationForm'), 1);
});
document.getElementById('loginForm').addEventListener('submit', async function(e) { // DEPRECATED
    if (busy.includes('loginForm')) { return; }
    busy.push('loginForm');

    e.preventDefault();
    const targetForm = document.getElementById('loginForm');
    const input = targetForm.getElementsByTagName('input')[0];
    let passwordReadyUse = input.value;
    input.value = '';
    if (passwordReadyUse === '') { busy.splice(busy.indexOf('loginForm'), 1); return; }

    const button = targetForm.getElementsByTagName('button')[0];
    button.innerHTML = htmlAnimations.horizontalBtnLoading;

    function infoAndWrongAnim(text) {
		bottomInfo(targetForm, text);
		input.classList.add('wrong');
        cryptoLight.clear();
        button.innerHTML = 'Unlock';
	}

    const authInfoResult = await chrome.storage.local.get(['authInfo']);
    if (!authInfoResult || !authInfoResult.authInfo) { infoAndWrongAnim('Password not set'); busy.splice(busy.indexOf('loginForm'), 1); return; }

    const startTimestamp = Date.now();
    const totalTimings = { argon2Time: 0, deriveKTime: 0, total: 0 };

    const { authID, authToken, hash, salt1Base64, iv1Base64, serverAuthBoost } = sanitizer.sanitize(authInfoResult.authInfo);
    const passwordMinLength = serverAuthBoost ? 6 : 12;
    if (passwordReadyUse.length < passwordMinLength) { infoAndWrongAnim(`Password must be at least ${passwordMinLength} characters long`); busy.splice(busy.indexOf('loginForm'), 1); return; }

    if (!hash || !salt1Base64 || !iv1Base64) { infoAndWrongAnim('Password not set'); busy.splice(busy.indexOf('loginForm'), 1); return; }
    if (typeof hash !== 'string' || typeof salt1Base64 !== 'string' || typeof iv1Base64 !== 'string') { console.error('Password data corrupted'); busy.splice(busy.indexOf('loginForm'), 1); return; }
    cryptoLight.cryptoStrength = serverAuthBoost ? 'medium' : 'heavy';

    if (serverAuthBoost) {
        const weakEncryptionReady = await cryptoLight.generateKey(passwordReadyUse, salt1Base64, iv1Base64);
        if (!weakEncryptionReady) { infoAndWrongAnim('Weak encryption failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        const authTokenHash = await cryptoLight.encryptText(authToken);
        totalTimings.argon2Time = weakEncryptionReady.argon2Time;
        totalTimings.deriveKTime = weakEncryptionReady.deriveKTime;
        console.log(`weakEncryption time: ${totalTimings.argon2Time + totalTimings.deriveKTime} ms`);

        const keyPair = await cryptoLight.generateKeyPair();
        const exportedPubKey = await cryptoLight.exportPublicKey(keyPair.publicKey);

        const serverResponse = await communication.sharePubKeyWithServer(authID, exportedPubKey);
        if (!serverResponse) { infoAndWrongAnim('Server communication failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        if (!serverResponse.success) { infoAndWrongAnim(serverResponse.message); busy.splice(busy.indexOf('loginForm'), 1); return; }

        const serverPublicKey = await cryptoLight.publicKeyFromExported(serverResponse.serverPublicKey);

        const serverResponse2 = await communication.sendAuthDataToServer(serverPublicKey, authID, authTokenHash, false);
        if (!serverResponse2) { infoAndWrongAnim('Server communication failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        if (!serverResponse2.success) { infoAndWrongAnim(`authID: ${authID}\n${serverResponse2.message}`); busy.splice(busy.indexOf('loginForm'), 1); return; }

        const encryptedPassComplementEnc = serverResponse2.encryptedPassComplement;
        const encryptedPassComplement = await cryptoLight.decryptData(keyPair.privateKey, encryptedPassComplementEnc);
        const passComplement = await cryptoLight.decryptText(encryptedPassComplement);

        passwordReadyUse = `${passwordReadyUse}${passComplement}`;
    }

    const res = await cryptoLight.generateKey(passwordReadyUse, salt1Base64, iv1Base64, hash);
    if (!res) { infoAndWrongAnim('Key derivation failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }
    
    cryptoLight.clear();
    button.innerHTML = 'Unlock';

    totalTimings.argon2Time += res.argon2Time;
    totalTimings.deriveKTime += res.deriveKTime;
    totalTimings.total = Date.now() - startTimestamp;
    console.log(totalTimings);

    if (res.hashVerified) {
        chrome.runtime.sendMessage({action: "openPage", password: passwordReadyUse});
    } else {
        infoAndWrongAnim('Wrong password');
    }
    
    passwordReadyUse = null;
    busy.splice(busy.indexOf('loginForm'), 1);
});
document.addEventListener('click', function(e) {
    switch (e.target.id) {
        case 'miningBtn':
            setVisibleForm('miningForm', false);
            break;
        case 'settingsBtn':
            setVisibleForm('settingsForm', false);
            break;
        default:
            break;
    }
});
document.addEventListener('input', (event) => {
	const isLoginForm = event.target.form.id === 'loginForm';
    if (isLoginForm) {
        const input = event.target;
        if (input.classList.contains('wrong')) { input.classList.remove('wrong'); }
    }

	const isIntensityRange = event.target.name === "intensity";
    if (isIntensityRange) {
        const rangeValue = event.target.value;
        const valueAsNumber = parseInt(rangeValue);
        chrome.storage.local.set({miningIntensity: valueAsNumber});
        //console.log(`intensity set to ${rangeValue}`);
    }

    const isServerAuthBoost = event.target.id === 'serverAuthBoost';
    if (isServerAuthBoost) {
        console.log('serverAuthBoost changed');
        const label = event.target.parentElement;
        // text : Cloud security boost (min length: 6)
        //<input id="serverAuthBoost" type="checkbox" name="securityOption" value="improveSecurityUsingServer" checked>
        const newText = event.target.checked ? 'Cloud security boost (min length: 6)' : 'Cloud security boost (min length: 12)';
        const checked = event.target.checked ? 'checked' : '';
        label.innerHTML = `<input id="serverAuthBoost" type="checkbox" name="securityOption" value="improveSecurityUsingServer" ${checked}> ${newText}`;
    }
});
//#endregion
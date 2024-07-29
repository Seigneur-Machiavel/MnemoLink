if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)-
    const anime = require("./anime.min.js");
	const { cryptoLight } = require("./cryptoLight.js");
    const { lockCircleObject, centerScreenBtnObject, communicationClass, authInfoObject, sanitizerClass, Miner } = require("./classes.js");
    const { htmlAnimations } = require("./htmlAnimations.js");
}

const settings = {
    appVersion: chrome.runtime.getManifest().version,
    minVersionAcceptedWithoutReset: '1.2.0',
    hardcodedPassword: '123456',
    serverUrl: "http://localhost:4340"
};
const sanitizer = new sanitizerClass();
const communication = new communicationClass(settings.serverUrl);
const centerScreenBtn = new centerScreenBtnObject();
const miner = new Miner(centerScreenBtn, communication);
centerScreenBtn.state = 'welcome';
centerScreenBtn.init(7);

const busy = [];
//#region - UX FUNCTIONS
function setVisibleForm(formId) {
    centerScreenBtn.centerScreenBtnWrap.classList.remove('active');
    const centerScreenBtnContrainer = document.getElementsByClassName('centerScreenBtnContrainer')[0];
    centerScreenBtnContrainer.classList.remove('hidden');

    const forms = document.getElementsByTagName('form');
    for (let i = 0; i < forms.length; i++) {
        if (forms[i].id === formId) { forms[i].classList.remove('hidden'); continue; }
        forms[i].classList.add('hidden');
    }

    if (formId === "miningForm") {
        centerScreenBtn.centerScreenBtnWrap.classList.add('active');
    }

    if (formId === "settingsForm") {
        const centerScreenBtnContrainer = document.getElementsByClassName('centerScreenBtnContrainer')[0];
        centerScreenBtnContrainer.classList.add('hidden');
    }
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
function showFormDependingOnStoredPassword(sanitizedAuthInfo) {
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
//#endregion

//#region - FUNCTIONS
(async () => { // --- START ---
    await pingServerAndSetMode();

    // Check if the vault is unlocked: if not, show the "password creation/login" form
    const result = await chrome.storage.local.get(['vaultUnlocked']);
    console.log(`Vault is ${result.vaultUnlocked ? 'unlocked' : 'locked'}`);

    if (!result || !result.vaultUnlocked) {
        await initAuth();
    } else {
        setVisibleForm('miningForm');

        miner.init();
        centerScreenBtn.delayBeforeIdleAnimationIfLocked = 1;

        const bottomBar = document.getElementById('bottomBar');
        bottomBar.classList.remove('hidden');
    }
})();
async function pingServerAndSetMode() {
	const localServerIsRunning = await communication.pingServer("http://localhost:4340");
	const webServerIsRunning = await communication.pingServer("https://www.linkvault.app");
	if (!localServerIsRunning && webServerIsRunning) {
		console.log('Running as production mode...');
		settings.hardcodedPassword = '';
		settings.serverUrl = "https://www.linkvault.app";
		communication.url = settings.serverUrl;
        return;
	} else if (localServerIsRunning) {
		console.info('Running as development mode...');
        return;
	}

	console.info('Cannot connect to any server!');
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

    showFormDependingOnStoredPassword(sanitizedAuthInfo);
}
/**
 * Check if the stored password is compatible with the current version of the application
 * @param {object} sanitizedAuthInfo - result of chrome.storage.local.get(['authInfo']).authInfo
 * @returns {boolean} - true if reset is necessary
 */
function controlVersion(sanitizedAuthInfo) {
        const { appVersion, serverAuthBoost } = sanitizedAuthInfo;
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
    const passwordMinLength = serverAuthBoost ? 6 : 8;
    const password = document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value;
    const passwordConfirm = document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value;
    
    if (password !== passwordConfirm) {
        alert('Passwords do not match');
    } else if (password.length < passwordMinLength) {
        alert(`Password must be at least ${passwordMinLength} characters long`);
    } else {
        const passwordCreatedInfo = await setNewPassword(password, passComplement);
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

        chrome.runtime.sendMessage({action: "openPage", password, passComplement});
    }
    
    busy.splice(busy.indexOf('passwordCreationForm'), 1);
});
document.getElementById('loginForm').addEventListener('submit', function(e) {
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

    chrome.storage.local.get(['authInfo'], async function(result) {
        const startTimestamp = Date.now();
        const totalTimings = { argon2Time: 0, deriveKTime: 0, total: 0 };

        const { authID, authToken, hash, salt1Base64, iv1Base64, serverAuthBoost } = sanitizer.sanitize(result.authInfo);
        const passwordMinLength = serverAuthBoost ? 6 : 8;
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
});
document.addEventListener('click', function(e) {
    switch (e.target.id) {
        case 'miningBtn':
            setVisibleForm('miningForm');
            break;
        case 'settingsBtn':
            setVisibleForm('settingsForm');
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
});
//#endregion
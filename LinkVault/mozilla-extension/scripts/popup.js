if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)
	const { cryptoLight } = require("./cryptoLight.js");
    const { lockCircleObject, centerScreenBtnObject, communicationClass, sanitizerClass } = require("./classes.js");
    const { htmlAnimations } = require("./htmlAnimations.js");
}

const isProduction = true //!(window.location.href.includes('localhost') || window.location.href.includes('fabjnjlbloofmecgongkjkaamibliogi') || window.location.href.includes('fc1e0f4c-64db-4911-86e2-2ace9a761647'));
const settings = {
    appVersion: chrome.runtime.getManifest().version,
    minVersionAcceptedWithoutReset: '1.2.0',
    hardcodedPassword: isProduction ? '' : '123456',
    serverUrl: isProduction ? "https://www.linkvault.app": "http://localhost:4340"
};
const sanitizer = new sanitizerClass();
const communication = new communicationClass(settings.serverUrl);

const centerScreenBtn = new centerScreenBtnObject();
centerScreenBtn.state = 'welcome';
centerScreenBtn.init(7);

const busy = [];
//#region - UX FUNCTIONS
function setVisibleForm(formId) {
    const forms = document.getElementsByTagName('form');
    for (let i = 0; i < forms.length; i++) {
        if (forms[i].id === formId) { forms[i].classList.remove('hidden'); continue; }
        forms[i].classList.add('hidden');
    }
}
function setInitialInputValues() {
    const hardcodedPassword = settings.hardcodedPassword;
    document.getElementById('loginForm').getElementsByTagName('input')[0].value = hardcodedPassword;
    document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value = hardcodedPassword;
    document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value = hardcodedPassword;
}
function showFormDependingOnStoredPassword() {
    chrome.storage.local.get(['authInfo'], function(result) {
        const { hash, salt1Base64, iv1Base64 } = sanitizer.sanitize(result.authInfo);
        if (hash && salt1Base64 && iv1Base64) {
            setVisibleForm('loginForm');
            document.getElementById('loginForm').getElementsByTagName('input')[0].focus();
        } else {
            setVisibleForm('passwordCreationForm');
            document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].focus();
        }
    });
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
function controlVersionAndResetIfNeeded() {
    const appV = settings.appVersion.split('.');
    const minV = settings.minVersionAcceptedWithoutReset.split('.');

    if (parseInt(appV[0]) < parseInt(minV[0])) { resetApplication(); return; }
    if (parseInt(appV[0]) > parseInt(minV[0])) { return; }

    if (parseInt(appV[1]) < parseInt(minV[1])) { resetApplication(); return; }
    if (parseInt(appV[1]) > parseInt(minV[1])) { return; }

    if (parseInt(appV[2]) < parseInt(minV[2])) { resetApplication(); return; }
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
    chrome.storage.local.set({
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
            showFormDependingOnStoredPassword();
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
document.getElementById('loginForm').addEventListener('input', function(e) {
    const input = e.target;
    if (input.classList.contains('wrong')) { input.classList.remove('wrong'); }
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
//#endregion

controlVersionAndResetIfNeeded();
setInitialInputValues();
showFormDependingOnStoredPassword();
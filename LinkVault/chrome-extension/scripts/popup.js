if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)-
    const anime = require("./anime.min.js");
	const { cryptoLight } = require("./cryptoLight.js");
    const { lockCircleObject, centerScreenBtnObject, communicationClass, authInfoObject, sanitizerClass } = require("./classes.js");
    const { htmlAnimations } = require("./htmlAnimations.js");
}

const isProduction = true // !(window.location.href.includes('localhost') || window.location.href.includes('fabjnjlbloofmecgongkjkaamibliogi') || window.location.href.includes('fc1e0f4c-64db-4911-86e2-2ace9a761647'));
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
let miningState = 'disabled';

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
async function miningAnimationLoop() {
    const pickAxe = centerScreenBtn.pickAxe;
    pickAxe.style.transform = 'rotate(0deg) translateX(20%) translateY(0%) scale(.6)';
    const minDuration = 50;
    let circleAnim = null;

    while(true) {
        const miningIsActive = await updateMiningState();
        const miningIntensity = getIntensityFromSpan();

        //const speed = miningIntensity * 100;
        //const duration = (1000 - speed) < minDuration ? minDuration : 1000 - speed;
        const pauseDuration = miningIntensity === 10 ? 0 : 2000 / (1.4 ** miningIntensity);
        const duration = pauseDuration < minDuration ? minDuration : pauseDuration;
        
        await new Promise(resolve => setTimeout(resolve, duration));
        if (!miningIsActive || miningIntensity === 0) {
            centerScreenBtn.state = 'welcome';
            continue;
        }

        // Pull
        anime({
            targets: pickAxe,
            rotate: '0deg',
            /*translateX: '0%',
            translateY: '-20%',*/
            translateX: '40%',
            translateY: '10%',
            scale: .6,

            easing: 'easeOutQuad',
            duration: duration * .7,
        });

        setTimeout(async () => {
            centerScreenBtn.state = 'mining';
            centerScreenBtn.lockCircles.forEach( lc => lc.setShape('hexagon', true) );
        }, 20);
        await new Promise(resolve => setTimeout(resolve, duration * .7));

        // Shot
        circleAnim = anime({
            targets: pickAxe,
            rotate: '-100deg',
            translateX: '20%',
            translateY: '-10%',
            scale: .62,
            
            //easing: 'spring(1, 80, 10, 0)',
            // easing accelation and choc
            easing: 'easeInQuad',
            duration: duration * .3,
        });

        circleAnim = setTimeout(async () => { 
            for (let i = centerScreenBtn.lockCircles.length - 1; i >= 0; i--) {
                centerScreenBtn.lockCircles[i].setShape('dot');
                await new Promise(r => setTimeout(r, 20));
            }
        }, duration * .26);
        await new Promise(resolve => setTimeout(resolve, duration * .3));
    }
}
function setIntensityRangeValue(value) {
    const rangeInput = document.getElementsByName('intensity')[0];
    rangeInput.value = value;

    const rangeSpan = document.getElementById('intensityValueStr');
    rangeSpan.innerText = value;
}
//#endregion

//#region - FUNCTIONS
(async () => {
    // Check if the vault is unlocked: if not, show the "password creation/login" form
    const result = await chrome.storage.local.get(['vaultUnlocked', 'timestamp']);
    if (!result || !result.vaultUnlocked) {
        await initAuth();
    } else {
        console.log('Vault is unlocked');

        setVisibleForm('miningForm');

        const miningIsActive = await updateMiningState();
        if (miningIsActive) { // continue mining
            console.log(`popup send: startMining (from previous state)`);
            await chrome.runtime.sendMessage({action: "startMining"});
            centerScreenBtn.pickAxe.classList.add('visible');
        }

        const intensity = await getIntensityFromStorage();
        setIntensityRangeValue(intensity);
        miningAnimationLoop();

        const bottomBar = document.getElementById('bottomBar');
        bottomBar.classList.remove('hidden');
    }
})();
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
/** @return {Promise<boolean>} - true if mining is active */
async function updateMiningState() {
    const result = await chrome.storage.local.get(['miningState']);
    if (!result) { return; }

    const miningState = sanitizer.sanitize(result.miningState);
    return miningState === 'enabled';
}
async function getIntensityFromStorage() {
    const result = await chrome.storage.local.get(['miningIntensity']);
    if (!result) { return; }

    return sanitizer.sanitize(result.miningIntensity);
}
function getIntensityFromSpan() {
    const rangeSpan = document.getElementById('intensityValueStr');
    return parseInt(rangeSpan.innerText);
}
async function toogleMining(miningIsActive = false) {
    if (miningIsActive) {
        console.log(`popup send: stopMining`);
        await chrome.runtime.sendMessage({action: "stopMining"});
        centerScreenBtn.pickAxe.classList.remove('visible');
    } else {
        console.log(`popup send: startMining`);
        await chrome.runtime.sendMessage({action: "startMining"});
        centerScreenBtn.pickAxe.classList.add('visible');
    }
}
//#endregion

//#region - EVENT LISTENERS
chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (let key in changes) {
        switch (key) {
            case 'hashRate':
                const hashRate = changes[key].newValue;

                const hashRateElmnt = document.getElementById('hashRateValueStr');
                hashRateElmnt.innerText = hashRate.toFixed(2);
                break;
            case 'miningIntensity':
                const intensity = changes[key].newValue;
                setIntensityRangeValue(intensity);
                break;
            default:
                break;
        }
    }
});
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
        chrome.storage.local.set({miningIntensity: rangeValue});
        console.log(`intensity set to ${rangeValue}`);
    }
});
centerScreenBtn.centerScreenBtnWrap.addEventListener('click', async function() {
    const miningIsActive = await updateMiningState();
    await toogleMining(miningIsActive);
});
//#endregion
if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)
	const { cryptoLight } = require("./cryptoLight.js");
    const { lockCircleObject, centerScreenBtnObject } = require("./classes.js");
}

const settings = { serverUrl: 'http://localhost:4340' };
const centerScreenBtn = new centerScreenBtnObject();
centerScreenBtn.state = 'welcome';
centerScreenBtn.init(7);

const isDebug = window.location.href.includes('localhost') || window.location.href.includes('fabjnjlbloofmecgongkjkaamibliogi') || window.location.href.includes('fc1e0f4c-64db-4911-86e2-2ace9a761647');
const hardcodedPassword = isDebug ? '123456' : '';
const busy = [];
function setVisibleForm(formId) {
    const forms = document.getElementsByTagName('form');
    for (let i = 0; i < forms.length; i++) {
        if (forms[i].id === formId) { forms[i].classList.remove('hidden'); continue; }
        forms[i].classList.add('hidden');
    }
}
async function setNewPassword(password, passComplement = false) {
    const startTimestamp = Date.now();

    const passwordReadyUse = passComplement ? `${password}${passComplement}` : password;
    const authInfo = await cryptoLight.generateKey(passwordReadyUse);
    if (!authInfo || !authInfo.encodedHash || !authInfo.salt1Base64 || !authInfo.iv1Base64) { console.error('cryptoLight.generateKey() failed'); return false; }
    cryptoLight.clear();

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
function showFormDependingOnStoredPassword() {
    chrome.storage.local.get(['authInfo'], function(result) {
        const { hash, salt1Base64, iv1Base64 } = sanitize(result.authInfo);
        if (hash && salt1Base64 && iv1Base64) {
            setVisibleForm('loginForm');
            document.getElementById('loginForm').getElementsByTagName('input')[0].focus();
        } else {
            setVisibleForm('passwordCreationForm');
            document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].focus();
        }
    });
}
function sanitize(data) {
    if (!data) return false;
	if (typeof data === 'number' || typeof data === 'boolean') return data;
    if (typeof data !== 'string' && typeof data !== 'object') return 'Invalid data type';

    if (typeof data === 'string') {
        //return data.replace(/[^a-zA-Z0-9]/g, '');
        // accept all base64 characters
        return data.replace(/[^a-zA-Z0-9+/=$,]/g, '');
    } else if (typeof data === 'object') {
        const sanitized = {};
        for (const key in data) {
			const sanitazedValue = sanitize(data[key]);
            sanitized[sanitize(key)] = sanitazedValue;
        }
        return sanitized;
    }
    return data;
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

            const serverResponse = await sharePubKeyWithServer(authID, exportedPubKey);
            if (!serverResponse) { alert('Server communication failed'); busy.splice(busy.indexOf('passwordCreationForm'), 1); resetApplication(); return; }
            if (!serverResponse.success) { alert(serverResponse.message); busy.splice(busy.indexOf('passwordCreationForm'), 1); resetApplication(); return; }

            const serverPublicKey = await cryptoLight.publicKeyFromExported(serverResponse.serverPublicKey);

            const serverResponse2 = await sendAuthDataToServer(serverPublicKey, authID, authTokenHash, encryptedPassComplement, totalTimings);
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
    const input = document.getElementById('loginForm').getElementsByTagName('input')[0];
    let passwordReadyUse = input.value;
    input.value = '';
    if (passwordReadyUse === '') { busy.splice(busy.indexOf('loginForm'), 1); return; }

    chrome.storage.local.get(['authInfo'], async function(result) {
        const { authID, authToken, hash, salt1Base64, iv1Base64, serverAuthBoost } = sanitize(result.authInfo);
        if (!hash || !salt1Base64 || !iv1Base64) { alert('Password not set'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        if (typeof hash !== 'string' || typeof salt1Base64 !== 'string' || typeof iv1Base64 !== 'string') { console.error('Password data corrupted'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        cryptoLight.cryptoStrength = serverAuthBoost ? 'medium' : 'heavy';

        if (serverAuthBoost) {
            const weakEncryptionReady = await cryptoLight.generateKey(passwordReadyUse, salt1Base64, iv1Base64);
            if (!weakEncryptionReady) { alert('Weak encryption failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }
            const authTokenHash = await cryptoLight.encryptText(authToken);

            const keyPair = await cryptoLight.generateKeyPair();
            const exportedPubKey = await cryptoLight.exportPublicKey(keyPair.publicKey);

            const serverResponse = await sharePubKeyWithServer(authID, exportedPubKey);
            if (!serverResponse) { alert('Server communication failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }
            if (!serverResponse.success) { alert(serverResponse.message); busy.splice(busy.indexOf('loginForm'), 1); return; }

            const serverPublicKey = await cryptoLight.publicKeyFromExported(serverResponse.serverPublicKey);

            const serverResponse2 = await sendAuthDataToServer(serverPublicKey, authID, authTokenHash, false);
            if (!serverResponse2) { alert('Server communication failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }
            if (!serverResponse2.success) { alert(`authID: ${authID}\n${serverResponse2.message}`); busy.splice(busy.indexOf('loginForm'), 1); return; }

            const encryptedPassComplementEnc = serverResponse2.encryptedPassComplement;
            const encryptedPassComplement = await cryptoLight.decryptData(keyPair.privateKey, encryptedPassComplementEnc);
            const passComplement = await cryptoLight.decryptText(encryptedPassComplement);

            passwordReadyUse = `${passwordReadyUse}${passComplement}`;
            cryptoLight.clear();
        }

        const res = await cryptoLight.generateKey(passwordReadyUse, salt1Base64, iv1Base64, hash);
        if (!res) { alert('Key derivation failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }

        if (res.hashVerified) {
            input.value = '';
            chrome.runtime.sendMessage({action: "openPage", password: passwordReadyUse});
        } else {
            input.classList.add('wrong');
        }
        
        passwordReadyUse = null;
        busy.splice(busy.indexOf('loginForm'), 1);
    });
});

showFormDependingOnStoredPassword();
document.getElementById('loginForm').getElementsByTagName('input')[0].value = hardcodedPassword;
document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value = hardcodedPassword;
document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value = hardcodedPassword;

//#region - SERVER COMMUNICATION
async function sharePubKeyWithServer(authID, publicKey) {
    const data = { authID, publicKey };
    const serverUrl = `${settings.serverUrl}/api/sharePubKey`;
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    };
  
    try {
      const response = await fetch(serverUrl, requestOptions);
      return await response.json();
    } catch (error) {
      console.error(`Error while sharing public key with server: ${error}`);
      return false;
    }
}
async function sendAuthDataToServer(serverPublicKey, authID, authTokenHash, encryptedPassComplement, totalTimings) {
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
	  return await response.json();
	} catch (error) {
	  console.error(`Error while sending AuthData to server: ${error}`);
	  return false;
	}
}
//#endregion
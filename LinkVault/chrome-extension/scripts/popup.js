if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)
	const { cryptoLight } = require("./cryptoLight.js");
    const { lockCircleObject, centerScreenBtnObject } = require("./classes.js");
}

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
    // Generate a hash from the password - this hash will be used to encrypt the data
    const simpleAuthResult = await cryptoLight.init(password);
    if (!simpleAuthResult || !simpleAuthResult.hash || !simpleAuthResult.salt1Base64 || !simpleAuthResult.iv1Base64) { console.error('cryptoLight.init() failed'); return false; }

    const authInfoToStore = {
        hash: simpleAuthResult.hash,
        salt1Base64: simpleAuthResult.salt1Base64,
        iv1Base64: simpleAuthResult.iv1Base64,
    };
    
    if (passComplement) {
        // Encrypt the passComplement with the password -> passComplement is high entropy
        const encryptedPassComplement = await cryptoLight.encryptText(passComplement);
        if (!encryptedPassComplement) { console.error('Pass complement encryption failed'); return false; }
        cryptoLight.clear();
        authInfoToStore.passComplement = encryptedPassComplement;

        // Overwrite the hash with a hash of the full password
        const fullPassword = passComplement ? `${password}${passComplement}` : password;
        const fullAuthResult = await cryptoLight.init(fullPassword, simpleAuthResult.salt1Base64, simpleAuthResult.iv1Base64);
        if (!fullAuthResult || !fullAuthResult.hash) { console.error('cryptoLight.init() failed'); return false; }
        if (simpleAuthResult.salt1Base64 !== fullAuthResult.salt1Base64 || simpleAuthResult.iv1Base64 !== fullAuthResult.iv1Base64) { console.error('Salt and IV mismatch'); return false; }
        authInfoToStore.hash = fullAuthResult.hash;

        // Generate a random authID - used to link the passComplement on the server
        const authID = cryptoLight.generateRndBase64(32);
        authInfoToStore.authID = cryptoLight.encryptText(authID);
    }

    chrome.storage.local.set({
        authInfo: authInfoToStore
    }, function () {
        console.log(`Password set, salt1: ${simpleAuthResult.salt1Base64}, iv1: ${simpleAuthResult.iv1Base64}`);
    });

    cryptoLight.clear();
    return result;
}
function resetApplication() {
    chrome.storage.local.clear(function() {
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

document.getElementById('passwordCreationForm').addEventListener('submit', async function(e) {
    if (busy.includes('passwordCreationForm')) return;
    busy.push('passwordCreationForm');

    e.preventDefault();
    const serverAuthBoost = document.getElementById('serverAuthBoost').checked;
    const passComplement = serverAuthBoost ? cryptoLight.generateRndBase64(32) : false;
    const passwordMinLength = serverAuthBoost ? 8 : 6;
    const password = document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value;
    const passwordConfirm = document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value;
    
    if (password !== passwordConfirm) {
        alert('Passwords do not match');
    } else if (password.length < passwordMinLength) {
        alert(`Password must be at least ${passwordMinLength} characters long`);
    } else {
        const passwordIsSet = await setNewPassword(password, passComplement);
        if (!passwordIsSet) { alert('Password setting failed'); busy.splice(busy.indexOf('passwordCreationForm'), 1); return; }

        document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value = '';
        document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value = '';

        // await new Promise(resolve => setTimeout(resolve, 10000)); // for debugging

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
    let password = input.value;
    if (password === '') { busy.splice(busy.indexOf('loginForm'), 1); return; }

    chrome.storage.local.get(['authInfo'], async function(result) {
        const { hash, salt1Base64, iv1Base64 } = result.authInfo;
        if (!hash || !salt1Base64 || !iv1Base64) { alert('Password not set'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        if (typeof hash !== 'string' || typeof salt1Base64 !== 'string' || typeof iv1Base64 !== 'string') { console.error('Password data corrupted'); busy.splice(busy.indexOf('loginForm'), 1); return; }

        const res = await cryptoLight.init(password, salt1Base64, iv1Base64);
        if (!res) { alert('Key derivation failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }

        console.log('res.strongEntropyPassStr', res.strongEntropyPassStr);
        console.log('hash', hash);
        const hashIsValid = await cryptoLight.verifyArgon2Hash(res.strongEntropyPassStr, hash);
        if (hashIsValid) {
            //await new Promise(resolve => setTimeout(resolve, 10000));
            input.value = '';
            chrome.runtime.sendMessage({action: "openPage", password: password});
            password = null;
        } else {
            input.classList.add('wrong');
        }
        busy.splice(busy.indexOf('loginForm'), 1);
    });
});

showFormDependingOnStoredPassword();
document.getElementById('loginForm').getElementsByTagName('input')[0].value = hardcodedPassword;
document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value = hardcodedPassword;
document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value = hardcodedPassword;

//#region - SERVER COMMUNICATION
async function sendPassComplementToServer(encryptedPassComplement = 'toto') {
	const data = { 
		id: userData.id,
		encryptedMnemoLinksStr: userData.encryptedMnemoLinksStr,
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
	  console.log(`MnemoLinks sent to server: ${result.success}`);
	  return result.success;
	} catch (error) {
	  console.error(`Error while sending MnemoLinks to server: ${error}`);
	  return false;
	}
}
//#endregion
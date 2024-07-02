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
async function setNewPassword(password) {
    const result = await cryptoLight.init(password);
    chrome.storage.local.set({
        hashedPassword: {
            hash: result.hash,
            saltBase64: result.saltBase64,
            ivBase64: result.ivBase64,
        }
    }, function () {
        console.log(`Password set, salt L: ${result.saltBase64.length}, iv L: ${result.ivBase64.length}`);
        console.log(`Password hash L: ${result.hash.length}`);
    });
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
    chrome.storage.local.get(['hashedPassword'], function(result) {
        const { hash, saltBase64, ivBase64 } = sanitize(result.hashedPassword);
        if (hash && saltBase64 && ivBase64) {
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
    if (!typeof data === 'string' || !typeof data === 'object') return 'Invalid data type';

    if (typeof data === 'string') {
        //return data.replace(/[^a-zA-Z0-9]/g, '');
        // accept all base64 characters
        return data.replace(/[^a-zA-Z0-9+/=]/g, '');
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
    const password = document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value;
    const passwordConfirm = document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value;
    
    if (password !== passwordConfirm) {
        alert('Passwords do not match');
    } else if (password.length < 6) {
        alert('Password must be at least 6 characters long');
    } else {
        await setNewPassword(password);
        document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].value = '';
        document.getElementById('passwordCreationForm').getElementsByTagName('input')[1].value = '';
        //setVisibleForm('loginForm');
        chrome.runtime.sendMessage({action: "openPage", password: password});
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

    chrome.storage.local.get(['hashedPassword'], async function(result) {
        const { hash, saltBase64, ivBase64 } = result.hashedPassword;
        if (!hash || !saltBase64 || !ivBase64) { alert('Password not set'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        if (typeof hash !== 'string' || typeof saltBase64 !== 'string' || typeof ivBase64 !== 'string') { alert('Password data corrupted'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        //console.log(`Password-retrieved, salt: ${saltBase64}, iv: ${ivBase64}`)
        //console.log(`Password-retrieved hash: ${hash}`);

        const res = await cryptoLight.init(password, saltBase64, ivBase64);
        if (!res) { alert('Key derivation failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        //console.log(`Password-derived hash: ${res.hash}`);

        if (res.hash === hash) {
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
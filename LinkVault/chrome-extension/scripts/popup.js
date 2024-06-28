if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)
	const { cryptoLight } = require("./cryptoLight.js");
}

const hardcodedPassword = '123456'; // should be "" in production
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
        if (result.hashedPassword && typeof result.hashedPassword === 'string') {
            setVisibleForm('loginForm');
            document.getElementById('loginForm').getElementsByTagName('input')[0].focus();
        } else {
            setVisibleForm('passwordCreationForm');
            document.getElementById('passwordCreationForm').getElementsByTagName('input')[0].focus();
        }
    });
}

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
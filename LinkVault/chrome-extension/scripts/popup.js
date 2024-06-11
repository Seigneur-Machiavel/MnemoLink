if (false) { // THIS IS FOR DEV ONLY ( to get better code completion)
	const { cryptoLight } = require("./cryptoLight.js");
}

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
            saltStr: result.saltStr,
            ivStr: result.ivStr,
        }
    }, function () {
        console.log(`Password set, salt: ${result.saltStr}, iv: ${result.ivStr}`);
        console.log(`Password hash: ${result.hash}`);
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
        if (result.hashedPassword) {
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
        setVisibleForm('loginForm');
    }
    
    busy.splice(busy.indexOf('passwordCreationForm'), 1);
});

document.getElementById('loginForm').addEventListener('submit', function(e) {
    if (busy.includes('loginForm')) return;
    busy.push('loginForm');

    e.preventDefault();
    const password = document.getElementById('loginForm').getElementsByTagName('input')[0].value;

    chrome.storage.local.get(['hashedPassword'], async function(result) {
        const { hash, saltStr, ivStr } = result.hashedPassword;
        if (!hash || !saltStr || !ivStr) { alert('Password not set'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        //console.log(`Password-retrieved, salt: ${saltStr}, iv: ${ivStr}`)
        //console.log(`Password-retrieved hash: ${hash}`);

        const res = await cryptoLight.init(password, saltStr, ivStr);
        if (!res) { alert('Key derivation failed'); busy.splice(busy.indexOf('loginForm'), 1); return; }
        //console.log(`Password-derived hash: ${res.hash}`);

        if (res.hash === hash) {
            chrome.runtime.sendMessage({action: "openPage", data: {password}}); //, key: res.key});
        } else {
            alert('Wrong password');
        }
        busy.splice(busy.indexOf('loginForm'), 1);
    });
});

showFormDependingOnStoredPassword();
document.getElementById('loginForm').getElementsByTagName('input')[0].value = '123456';
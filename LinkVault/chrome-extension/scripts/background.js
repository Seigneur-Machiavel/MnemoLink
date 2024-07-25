import argon2 from './argon2-ES6.min.js';
import { Communication, Sanitizer, Pow } from './backgroundClasses.js';

const isProduction = false;
const serverUrl = isProduction ? "https://www.linkvault.app" : "http://localhost:4340";
const pow = new Pow(argon2, serverUrl);
const sanitizer = new Sanitizer();

(async () => { // Vault state checker
    console.log('Background script started!');
    await chrome.storage.local.set({miningState: 'disabled'}); // initialize mining state

    let vaultState = 'locked';
    const stateValidity = 2000;

    while(true) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const result = await chrome.storage.local.get(['vaultUnlocked', 'timestamp']);
        if (!result || !result.timestamp) {
            console.log('No vault state found! Setting default state...');
            chrome.storage.local.set({vaultUnlocked: false, timestamp: 1});
            continue;
        }

        const elapsed = Date.now() - result.timestamp;
        const expired = elapsed > stateValidity;
        if (result.vaultUnlocked && expired) {
            await chrome.storage.local.set({vaultUnlocked: false});
            if (vaultState === 'unlocked') { 
                vaultState = 'locked';
                console.log('Vault locked!');
            }
        } else if (result.vaultUnlocked && !expired) {
            if (vaultState === 'locked') {
                vaultState = 'unlocked';
                console.log('Vault unlocked!');
            }
        }
    }
})();

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (typeof request.action !== "string") { return; }
    if (!sanitizer.sanitize(request)) { console.info('data possibly corrupted!'); return; }
    
    switch (request.action) {
        case "openPage":
            let password = request.password;
            let passComplement = request.passComplement;
            chrome.tabs.create({'url': chrome.runtime.getURL('views/index.html')}, function(tab) {
                console.log('Tab opened');

                // Declaration of the listener as a named function to be able to remove it later
                const passwordListener = function(request, sender, sendResponse) {
                    if (typeof request.action !== "string") { return; }
                    if (request.action == "getPassword") {
                        sendResponse({password, passComplement});
                        password = null;
                        // Delete the listener after serving the password
                        chrome.runtime.onMessage.removeListener(passwordListener);
                    }
                };

                chrome.runtime.onMessage.addListener(passwordListener);
            });
            break;
        case "requestAuth":
            // open popup for authentication
            chrome.runtime.sendMessage({action: "openPage", data: {password: request.data.password}});
            break;
        case "startMining":
            //console.log('Starting mining 1...');
            pow.startMining();
            break;
        case "stopMining":
            //console.log('Stopping mining 1...');
            pow.stopMining();
            break;
        default:
            break;
    }
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (let key in changes) {
        if (key === 'miningIntensity') {
            console.log(`Mining intensity changed to ${changes[key].newValue}`);
            pow.intensity = changes[key].newValue;
        }
    }
});
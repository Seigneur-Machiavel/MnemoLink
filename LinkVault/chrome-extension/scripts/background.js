import argon2 from './argon2-ES6.min.js';
import { Communication, Sanitizer, Pow } from './backgroundClasses-ES6.js';

let pow = new Pow(argon2, "http://localhost:4340");
const sanitizer = new Sanitizer();

(async () => { // Vault state checker
    await pingServerAndSetMode();

    console.log('Background script started!');
    await chrome.storage.local.set({miningState: 'disabled'}); // initialize mining state

    let vaultState = 'locked';
    const stateValidity = 2000;

    while(true) {
        await new Promise(resolve => setTimeout(resolve, 400));

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
                //console.log('Vault locked!');
            }
        } else if (result.vaultUnlocked && !expired) {
            if (vaultState === 'locked') {
                vaultState = 'unlocked';
                //console.log('Vault unlocked!');
            }
        }
    }
})();
async function pingServerAndSetMode() {
    const communication = new Communication();
	const localServerIsRunning = await communication.pingServer("http://localhost:4340");
	const webServerIsRunning = await communication.pingServer("https://www.linkvault.app");
	if (!localServerIsRunning && webServerIsRunning) {
		console.info('Running as production mode...');
        pow = new Pow(argon2, "https://www.linkvault.app");
        return;
	} else if (localServerIsRunning) {
		console.info('Running as development mode...');
        return;
	}

    console.info('Cannot connect to any server!');
}
function openInternalPage(url = 'views/index.html') {
    const internalPageURL = chrome.runtime.getURL(url);
    chrome.tabs.create({url: internalPageURL}, function(tab) {
        chrome.storage.local.set({internalPageTabId: tab.id});
    });
}
async function openOrFocusInternalPage() {
    const internalPageURL = chrome.runtime.getURL('views/index.html');

    const internalPageTabId = await chrome.storage.local.get("internalPageTabId");
    if (!internalPageTabId || !internalPageTabId.internalPageTabId) {
        openInternalPage();
        return;
    }

    chrome.tabs.get(internalPageTabId.internalPageTabId, function(tab) {
        if (chrome.runtime.lastError) {
            openInternalPage();
            return;
        } else {
            chrome.tabs.update(tab.id, {active: true});
            chrome.windows.update(tab.windowId, {focused: true});
        }
    });
}

chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    if (typeof request.action !== "string") { return; }
    if (!sanitizer.sanitize(request)) { console.info('data possibly corrupted!'); return; }
    
    switch (request.action) {
        case "openPage":
            openOrFocusInternalPage();
            // DEPRECATED to avoid password transit
            /*let { password } = request;
            const vaultState = await chrome.storage.local.get(['vaultUnlocked']);
            if (!vaultState || !vaultState.vaultUnlocked) {
                await chrome.tabs.create({'url': chrome.runtime.getURL('views/index.html')}); // open internal page
                // Declaration of the listener as a named function to be able to remove it later
                const passwordListener = function(request, sender, sendResponse) {
                    if (typeof request.action !== "string") { return; }
                    if (request.action == "getPassword") {
                        sendResponse({password});
                        password = null;
                        // Delete the listener after serving the password
                        chrome.runtime.onMessage.removeListener(passwordListener);
                    }
                };

                chrome.runtime.onMessage.addListener(passwordListener);
            } else {
                chrome.runtime.sendMessage({action: "authPassword", password});
            }*/
            
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
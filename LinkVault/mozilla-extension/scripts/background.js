chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (typeof request.action !== "string") { return; }
    
    if (request.action === "openPage") {
        let password = request.password;
        chrome.tabs.create({'url': chrome.runtime.getURL('views/index.html')}, function(tab) {
            console.log('Tab opened');

            // Declaration of the listener as a named function to be able to remove it later
            const passwordListener = function(request, sender, sendResponse) {
                if (typeof request.action !== "string") { return; }
                if (request.action == "getPassword") {
                    sendResponse({password: password});
                    password = null;
                    // Delete the listener after serving the password
                    chrome.runtime.onMessage.removeListener(passwordListener);
                }
            };

            chrome.runtime.onMessage.addListener(passwordListener);
        });
    } else if (request.action === "requestAuth") {
        // open popup for authentication
        chrome.runtime.sendMessage({action: "openPage", data: {password: request.data.password}});
    }
});
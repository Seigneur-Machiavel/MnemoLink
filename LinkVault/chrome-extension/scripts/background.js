chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    //console.log(`Message received: ${JSON.stringify(request)}`);
    if (request.action === "openPage") {
        chrome.tabs.create({'url': chrome.runtime.getURL('views/index.html')}, function(tab) {
            console.log('Tab opened');

            chrome.runtime.onMessage.addListener(
                function(request, sender, sendResponse) {
                    if (request.action == "getPassword") {
                        sendResponse({password: "123456"});
                    }
                    return true; // indicates that the response will be asynchronous
                }
            );
        });
    }
});
(function(global) {
    function SecureMnemonicModule() {
        let _mnemonic = null;

        function setMnemonic(mnemonic) {
            _mnemonic = mnemonic;
        }

        function useMnemonicSafely(callback) {
            if (_mnemonic) {
                callback(_mnemonic);
                _mnemonic = null; // Clear the mnemonic immediately
            }
        }

        // Expose public methods
        return {
            setMnemonic,
            useMnemonicSafely
        };
    }

    // Attach the module to the window object for global access
    global.initSecureMnemonicModule = function() {
        global.secureMnemonicModule = SecureMnemonicModule();
    };
})(window);

function loadMnemonicFromSecureModule() {
	let mnemonicFromSecureModule = [];
	if (!window.secureMnemonicModule) { console.error("Secure mnemonic module not found"); return false; }

	window.secureMnemonicModule.useMnemonicSafely(function(mnemonicStr) {
		if (!mnemonicStr) { return; }
		mnemonicFromSecureModule = mnemonicStr.split(" ");
	});
	window.secureMnemonicModule = null; // should be already null, but just in case
	
	if (mnemonicFromSecureModule.length === 0) { console.info("Unable to load mnemonic"); return false; }
	return mnemonicFromSecureModule;
}
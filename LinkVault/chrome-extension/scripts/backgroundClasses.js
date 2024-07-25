class Sanitizer {
	constructor() {
		this.validTypeToReturn = ['number', 'boolean'];
	}

	sanitize(data) {
		if (!data || this.validTypeToReturn.includes(typeof data)) {return data};
		if (typeof data !== 'string' && typeof data !== 'object') {return 'Invalid data type'};
	
		if (typeof data === 'string') {
			return data.replace(/[^a-zA-Z0-9+/=$,]/g, '');
		} else if (typeof data === 'object') {
			const sanitized = {};
			for (const key in data) {
				const sanitazedValue = this.sanitize(data[key]);
				sanitized[this.sanitize(key)] = sanitazedValue;
			}
			return sanitized;
		}
		return data;
	}
}

class Communication {
    constructor(serverUrl) {
        this.url = serverUrl;
		this.sanitizer = new Sanitizer();
    }

    async getMiningInfo() {
		const serverUrl = `${this.url}/api/getMiningInfo`;

		try {
			const response = await fetch(serverUrl);
            const result = await response.json();
            if (!result || !result.success) { console.info('Invalid response from server !'); return false; }

            result.miningInfo = this.sanitizer.sanitize(result.miningInfo);
            if (!result.miningInfo) { console.info('No mining info found in response !'); return false; }

			return result.miningInfo;
		} catch (error) {
			console.info(`Error while getting hash from server: ${error}`);
			return false;
		}
	}
	async submitPowProposal(powProposal, userId = 'toto') {
		const data = { pow: powProposal, userId: userId };
		const stringifiedData = JSON.stringify(data);
		const serverUrl = `${this.url}/api/submitPowProposal`;

		const requestOptions = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: stringifiedData
		};

		try {
			const response = await fetch(serverUrl, requestOptions);
			const result = await response.json();

			if (typeof result.success !== 'boolean') { console.info('Invalid response from server !'); return false; }
			if (result.message) { result.message = this.sanitizer.sanitize(result.message); }
			return result;
		} catch (error) {
			console.info(`Error while submitting PoW Proposal to server: ${error}`);
			return false;
		}
	}
}

class Pow {
    constructor(argon2, serverUrl = 'http://localhost:4340') {
        this.argon2 = argon2;
        this.userId = 'toto';
        this.communication = new Communication(serverUrl);
        this.blockHash = null; // this.#generateRandomHash(16).hashHex;
        this.argon2Params = { time: 2, mem: 2**12, hashLen: 16, parallelism: 1, type: 2 };
        this.intensity = this.#getIntensity();
        this.difficulty = 7;
        this.state = { active: false, miningActive: false, updateHashActive: false };
    }

    async startMining() {
        const userId = await this.#getSyncUserId();
        if (!userId) { console.info('Error while getting userId from storage'); return false; }
        this.userId = userId;
        
        //console.log('Starting mining 2...');
        this.state.active = true;
        await chrome.storage.local.set({miningState: 'enabled'});
        await chrome.storage.local.set({miningIntensity: this.intensity});

        this.#updateMiningInfoLoop();
        this.#miningLoop();

        console.log(`Mining started, userId: ${this.userId} | diff: ${this.difficulty} | intensity: ${this.intensity}`);
    }
    async stopMining() {
        //console.log('Stopping mining 2...');
        this.state.active = false;

        while (this.state.miningActive || this.state.updateHashActive) {
            console.log('Waiting for mining to stop...');
            await new Promise(resolve => setTimeout(resolve, 400));
        }

        await chrome.storage.local.set({miningState: 'disabled'});

        console.log('Mining stopped');
        return true;
    }
    async #miningLoop() {
        //console.log('Mining loop started A');
        if (this.state.miningActive) { console.info('Mining already active !'); return; }
        this.state.miningActive = true;
        let hashRate = 0;
        const hashRateCalculInterval = 5000;
        const chrono = { start: Date.now(), iterations: 0 };
        //console.log('Mining loop started B');
        function updateHashRate() {
            const needUpdate = hashRateCalculInterval < (Date.now() - chrono.start)

            if (needUpdate) {
                hashRate = chrono.iterations / ((Date.now() - chrono.start) / 1000);
                chrome.storage.local.set({hashRate: hashRate});
    
                chrono.start = Date.now();
                chrono.iterations = 0;
                console.log(`Hash rate: ${hashRate.toFixed(2)} H/s`);
            }
        }

        while (this.state.active) {
            const pauseDuration = this.intensity === 10 ? 0 : 1000 / (2 ** this.intensity);
            if (pauseDuration > 0) {
                await new Promise(resolve => setTimeout(resolve, pauseDuration));
            }

            if (this.blockHash === null) { 
                console.info('Block hash not found, waiting for update...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue; 
            }

            const difficulty = this.difficulty;
            const argon2Params = this.argon2Params;
            const powProposal = await this.#minePow(argon2Params, difficulty);
            
            //console.log(`POW proposal: ${powProposal}`);
            if (powProposal) {
                //console.log(`Valid POW found: ${powProposal}`);
                const response = await this.communication.submitPowProposal(powProposal, this.userId);
                if (!response) { console.info('Error while submitting POW to server'); }
                
                if (response.success) { console.log('POW accepted by server'); }
                else { console.log('POW rejected by server'); }
            }

            chrono.iterations++;
            updateHashRate();
        }

        this.state.miningActive = false;
    }
    #generateRandomHash(length) {
        const hash = new Uint8Array(length);
        crypto.getRandomValues(hash);
    
        const hashHex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
    
        return { hash, hashHex };
    }
    #verify(powBits, difficulty) {
        const powBitsStr = powBits.join('');
        const target = '0'.repeat(difficulty);
        const isValid = powBitsStr.startsWith(target);
    
        return isValid;
    }
    #hexToBits(hex) {
        const bitsArray = [];
        for (let i = 0; i < hex.length; i++) {
            for (let j = 0; j < 8; j++) {
                bitsArray[i * 8 + j] = (hex[i] >> j) & 1;
            }
        }
    
        return bitsArray;
    }
    /** @return { Promise<string | false> } - powProposal if valid, false otherwise */
    async #minePow(argon2Params, difficulty) {
        const randomHash = this.#generateRandomHash(argon2Params.hashLen);
        const powProposal = randomHash.hashHex;
        const params = { ...argon2Params };
        params.pass = powProposal;
        params.salt = this.blockHash;
    
        if (!params.salt) { console.info('Error while getting block hash from server'); return false; }
        //console.log(`params: ${JSON.stringify(params)}`);
    
        const hash = await this.argon2.hash(params);
        const bitsArray = this.#hexToBits(hash.hashHex);
        const isValid = this.#verify(bitsArray, difficulty);
        //if (isValid) { console.log(`POW -> BitsArray: ${bitsArray.join('')}`); }
    
        return isValid ? powProposal : false;
    }
    async #updateMiningInfoLoop(tickDelay = 1000) {
        if (this.state.updateHashActive) { return; }
        this.state.updateHashActive = true;

        while (this.state.active) {
            await new Promise(resolve => setTimeout(resolve, tickDelay));

            const miningInfo = await this.communication.getMiningInfo();
            if (!miningInfo) { continue; }

            this.blockHash = miningInfo.hash;
            this.difficulty = miningInfo.difficulty;
            console.log(`miningInfo updated: ${JSON.stringify(miningInfo)}`);
        }

        this.state.updateHashActive = false;
    }
    async #getSyncUserId() {
        const result = await chrome.storage.local.get(['id']);
        if (!result || !result.id) { return false; }
        if (typeof result.id !== 'string') { return false; }

        const sanitizer = new Sanitizer();
        result.userId = sanitizer.sanitize(result.id);

        return result.userId;
    }
    async #getIntensity() {
        const result = await chrome.storage.local.get(['intensity']);
        if (!result || !result.intensity) { return 1; }
        if (typeof result.intensity !== 'number') { return 1; }

        return result.intensity;
    }
}

export { Communication, Sanitizer, Pow };
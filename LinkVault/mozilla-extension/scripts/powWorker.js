self.onmessage = function(e) { // NO IMPLEMENTED
    const randomHashHex = e.data.hashHex;
    const argon2Params = e.data.argon2Params;
    const blockHash = e.data.blockHash;

    async function minePow(argon2Params) {
        const powProposal = randomHashHex;
        const params = { ...argon2Params };
        params.pass = powProposal;
        params.salt = blockHash;
    
        const hash = await this.argon2.hash(params);

        const result = { pow: powProposal, hash };
    
        return result;
    }
};
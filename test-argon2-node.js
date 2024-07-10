const argon2 = require("argon2");

async function test() {
    const toto = await argon2.hash('password', { salt: Buffer.from("saltalittlebitlonger") });
    console.log(toto.hash);
}; test();
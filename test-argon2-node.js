const argon2 = require("argon2");
//const argon2 = require("./dist/argon2-bundled.min.js");
//const argon2 = require("./argon2");

async function test() {
    const toto = await argon2.hash('password', { salt: Buffer.from("saltalittlebitlonger") });
    //const toto = await argon2.hash({ pass: 'password', salt: 'somesalt' });
    console.log(toto.hash);
}; test();
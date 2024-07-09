# MnemoLinker: Secure Your Digital Keys with Masterful Encryption.

## Overview

Since the emergence of cryptographic assets like Bitcoin, Ethereum, Solana, NFTs, and other digital assets, we've found ourselves juggling an ever-growing collection of digital wallets. With this proliferation comes the daunting task of managing their secret keys, which can quickly become a cumbersome burden. It's not always straightforward to store these keys securely, safeguarding them from theft, alteration, loss, and other risks. Thus, I envisioned the simplest possible system that allows anyone to secure their mnemonic phrases optimally, while significantly easing their use and recovery. Allow me to introduce the technology at the heart of the mnemonic manager LinkVault, aptly named "MnemoLinker".

In crafting this solution, I aimed to address a fundamental challenge in the digital age: ensuring the safety and accessibility of our most critical digital assets. MnemoLinker is more than just a tool; it's a gateway to peace of mind for digital asset holders, offering a seamless blend of security and convenience. Whether you're a seasoned cryptocurrency enthusiast or a newcomer navigating the complexities of digital wallets, MnemoLinker is designed to streamline your experience, making the management of your mnemonic phrases as effortless as possible.

MnemoLinker isn't just a tool; it's a revolution in digital asset management, blending ease of use with uncompromising security. Join us in embracing this innovative approach to safeguarding your digital legacy.

## Key Features

**Customizable Master Mnemonic Creation:** Imagine crafting a master mnemonic phrase that's not only secure but also resonates with you personally. With MnemoLinker, you can create a master mnemonic in your preferred language and of your chosen length, making it easier to remember. It's about putting you in control, ensuring that your digital keys are both safe and meaningful to you.

**Simplicity at Its Core:** With just a simple function call, MnemoLinker allows you to create a cryptographic link that can store an unlimited number of mnemonics in the manager. Accessing any of these mnemonics requires the master mnemonic, streamlining the process while maintaining top-notch security. It's like having a master key to an impenetrable fortress that houses your digital treasures.

**Crystal Clear Connections:** The cryptographic link, known as "MnemoLink," is a marvel of clarity and precision. It includes a prefix that denotes the BIP table name and the language of the saved mnemonic, followed by the encrypted mnemonic itself, and ends with a suffix detailing the "IV" and the MnemoLinker version used for encryption. This structured approach ensures that every link is a clear, secure bridge to your digital assets.

**Fortified Security:** MnemoLinker takes security to the next level with encryption that guards against brute force attacks. Each encryption operation requires intense computational effort, making it prohibitively costly for attackers. They would need to commit to a full attack for each master mnemonic, rendering such attacks economically futile. It's like building a digital fortress around your assets, with walls so thick that attackers can't even dream of getting through.

**Scalable Security Testing:** Embrace the challenge with LinkVault's "simple" wallets available for brute force attempts, offering rewards for success. These sanctioned attacks are not just a test of strength; they're an opportunity to identify and fix potential vulnerabilities proactively. It's a way to stay several steps ahead of real threats, ensuring that users' funds remain safe long before any danger looms on the horizon.

-  **BIPs lists source**: https://github.com/bitcoin/bips.git

## How It Works

1.  **Input**: Provide your original mnemonic and your desired master mnemonic to MnemoLinker.

2.  **Encryption**: The function encryptMnemonic(), using "Scrypt" (expensive in memory) to generate the salt, then using AES-GCM to generates the MnemoLink.

3.  **Encoding**: The program encode the MnemoLink in a custom base64 format, lightweight, adapted to Blockchain storage.

4.  **Output**: You receive a MnemoLink (string) that can be stored publicly. This string can contains a prefix with language and BIP version information and WILL contain the version of MnemoLinker to make easy the recovering process along versioning.

## Use Cases

-  **Memory Friendly**: Simplify the memorization process by merging lengthy mnemonics into shorter, more manageable "master mnemonic".

-  **Public Storage**: Safely store your MnemoLink string on the blockchain or any public ledger without revealing your original mnemonic.

-  **Easy Recovery**: Use your "master mnemonic" to recover your original mnemonic phrase whenever necessary by using the function decryptMnemoLink().

## Getting Started

To begin using MnemoLinker, follow these steps:

- Clone the repository to your local machine.
```
git clone https://github.com/Seigneur-Machiavel/MnemoLink.git
```

- **MnemoLinker.js** builds can be used directly - without dependency.
*(copy-past code in your project or import it as file)*
```HTML
<script src="MnemoLinker_v1.0.js"></script>
```

-  **builder.js** - Can be used to generate a new/custom "MnemoLinker.js" file. ( NodeJS )

```javascript
// { mnemonic, masterMnemonic } = string || string[]
// "abandon able industry [...] spy"
// or
// ["abandon", "able", industry", [...], "spy"]

// Instantiate MnemoLinker and ENCRYPT the mnemonic as a new MnemoLink
const MnemoLinkerA = new MnemoLinker({mnemonic, masterMnemonic});
const mnemoLink = await MnemoLinkerA.encryptMnemonic();

// Instantiate MnemoLinker and RETREIVE the original Mnemonic from a MnemoLink
const MnemoLinkerB = new MnemoLinker({masterMnemonic});
const decryptedMnemonic = await  MnemoLinkerB.decryptMnemoLink(mnemoLink);
```

Simple as that!

## Contributing

We welcome contributions from the community! If you have suggestions, bug reports, or contributions, please submit them through the issue tracker or create a pull request.

## License

MnemoLinker is released under the MIT License. (openSource)

## Special thanks

- Exorcist for their reviews on security issues
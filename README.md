# MnemoShift: A Pseudo Mnemonic Generator


## Overview

MnemoLink is an innovative tool designed to enhance the usability and security of cryptographic mnemonic phrases. By transforming an original mnemonic phrase into a simpler, user-chosen* pseudo mnemonic, MnemoLink offers a unique approach to secure key management.

This transformation generates a **MnemoLink** string base64 formatted, which can be safely stored publicly, including on the blockchain, without compromising security.

*user-chosen**: Implies rules and an impact on security.

-  *BIPs lists source*: https://github.com/bitcoin/bips.git

## Key Features

-  **Mnemonic Transformation**: Convert your cumbersome mnemonic into a more memorable pseudo mnemonic without sacrificing security.

-  **Output Size**:  Any MnemoLink encrypted part should have the same length.

-  **Language and Version Prefix**: The output includes a prefix indicating the language and BIP version of the original mnemonic, tailoring it to your preferences.

-  **Salt and Version Suffix**: The output includes a suffix indicating the salt used in derivation and the version of MnemoLinker used to generate the MnemoLink.

-  **Enhanced Memorability**: Shift from a 24-word mnemonic to a more manageable version in the language of your choice, making it easier to remember.

-  **Security**: By not directly revealing your original mnemonic, the program adds an extra layer of security to your cryptographic assets. 

-  **BruteForce protection**: Drastically increase attack's cost using a large derivation iterations ( > 100 000 ). A random Salt involve the bruteforce operation to be realized for each MnemoLink.

## How It Works

1.  **Input**: Provide your original mnemonic and your desired pseudo mnemonic to MnemoLinker.

2.  **Transformation**: The function encryptMnemonic() generates a random MnemoLink.

3.  **Encoding**: The program encode the MnemoLink in base64 format, adapted to Blockchain storage.

4.  **Output**: You receive a MnemoLink (string) that can be stored publicly. This string can contains a prefix with language and BIP version information and WILL contain the version of MnemoLinker to make easy the recovering process along versionning.

## Use Cases

-  **Public Storage**: Safely store your MnemoLink string on the blockchain or any public ledger without revealing your original mnemonic.

-  **Easy Recovery**: Use your pseudo mnemonic to recover your original mnemonic phrase whenever necessary by using the function decryptMnemoLink(mnemoLink  =  '').

-  **Memory Friendly**: Simplify the memorization process by converting lengthy mnemonics into shorter, more manageable versions.

## Getting Started

To begin using MnemoLinker, follow these steps:

- Clone the repository to your local machine.
```
git clone https://github.com/Seigneur-Machiavel/MnemoLinker.git
```

- **MnemoLinker.js** - Can be used directly - without dependency.
*(copy-past code in your project or import it as file)*
```HTML
<script src="MnemoLinker_v0.1.js"></script>
```

-  **builder.js** - Can be used to generate a new/custom "MnemoLinker.js" file. ( NodeJS )

```javascript
// { mnemonic, pseudoMnemonic } = string || string[]
// "abandon able industry [...] spy"
// or
// ["abandon", "able", industry", [...], "spy"]

// GENERATE pseudoBIP and encode it
const MnemoLinkerA= new MnemoLinker( {mnemonic, pseudoMnemonic} );
const mnemoLink = await MnemoLinkerA.encryptMnemonic();

// RETREIVE Mnemonic
const MnemoLinkerB = new MnemoLinker( {mnemoLink, pseudoMnemonic} );
const decryptedMnemonic = await  MnemoLinkerB.decryptMnemoLink(mnemoLink);
```

Simple as that!

## Contributing

We welcome contributions from the community! If you have suggestions, bug reports, or contributions, please submit them through the issue tracker or create a pull request.

## What remains to improve

- ~~Generate custom tables containing more words than BIPs, offering a greater choice of pseudo mnemonics.~~

- Better clarity in the code base.

- ~~Use cryptography for best security.~~

## License

MnemoLinker is released under the MIT License. (openSource)

## Special thanks

- Exorcist for their reviews on security issues
# MnemoShift: A Pseudo Mnemonic Generator

## Overview

MnemoShift is an innovative tool designed to enhance the usability and security of cryptographic mnemonic phrases. By transforming an original mnemonic phrase into a simpler, user-chosen* pseudo mnemonic, MnemoShift offers a unique approach to secure key management.

This transformation generates a **pBIP** (pseudo Binary Improvement Proposal) string in base64 format, which can be safely stored publicly, including on the blockchain, without compromising security.

*user-chosen**: Implies an impact on security.

-  *BIPs lists source*: https://github.com/bitcoin/bips.git

## Key Features

-  **Mnemonic Transformation**: Convert your cumbersome mnemonic into a more memorable pseudo mnemonic without sacrificing security.

-  **Flexible Output Size**: Depending on the number of words in your pseudo mnemonic, receive a pBIP string of either 2048 *(12 words)* or 4096 *(24 words)* characters.

-  **Language and Version Prefix**: Customize the output with a prefix indicating the language and BIP version of the original mnemonic, tailoring it to your preferences.

-  **Enhanced Memorability**: Shift from a 24-word mnemonic to a more manageable 12-word version in the language of your choice, making it easier to remember.

-  **Security**: By not directly revealing your original mnemonic, the program adds an extra layer of security to your cryptographic assets.

## How It Works

1.  **Input**: Provide your original mnemonic and your desired pseudo mnemonic to MnemoShift.

2.  **Transformation**: The program generates a random pseudo BIP - string[] formated.

3.  **Encoding**: The program encode the pBIP string in base64 format, reflecting your pseudoBIP while ensuring security.

4.  **Output**: You receive a pBIP string that can be stored publicly. This string can contains a prefix with language and BIP version information.

## Use Cases

-  **Public Storage**: Safely store your pBIP string on the blockchain or any public ledger without revealing your original mnemonic.

-  **Easy Recovery**: Use your pseudo mnemonic to recover your original mnemonic phrase whenever necessary.

-  **Memory Friendly**: Simplify the memorization process by converting lengthy mnemonics into shorter, more manageable versions.

## Getting Started

To begin using MnemoShift, follow these steps:

- Clone the repository to your local machine.

```
git clone https://github.com/Seigneur-Machiavel/MnemoShift.git
```

- **translator.js** - Can be used directly - without dependency.
*(copy-past code in your project or import it as file)*
<script src="translator.js"></script>

-  **translator builder.js** - Can be used to generate a custom "translator.js" file. ( NodeJS )

```javascript
// { mnemonic, pseudoMnemonic } = string || string[]
// "abandon able industry [...] spy"
// or
// ["abandon", "able", industry", [...], "spy"]

// GENERATE pseudoBIP and encode it
const translatorA = new Translator( {mnemonic, pseudoMnemonic} );
const apply_Language_BIP_prefix = true // (default = true)
const encodedTable = translatorA.getEncodedPseudoBIP(apply_Language_BIP_prefix);

// RETREIVE Mnemonic
const translatorB = new Translator( {pBIP, pseudoMnemonic} );
const decodedMnemonic = translatorB.translateMnemonic('string'); // output: 'array' or 'string'
```

## Contributing

We welcome contributions from the community! If you have suggestions, bug reports, or contributions, please submit them through the issue tracker or create a pull request.

## What remains to improve

- Generate custom tables containing more words than BIPs, offering a greater choice of pseudo mnemonics.

- Better clarity in the code base.

- A pseudoMnemonic & pBIP entropy scoring system.

## License

MnemoShift is released under the MIT License. (openSource)

## Special thanks

- Exorcist for their reviews on security issues
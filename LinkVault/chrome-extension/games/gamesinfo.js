class GameInfoClass {
    constructor(title, description, folderName = 'give_me_ya_seed') {
        /** @type {string} */
        this.title = title;
        /** @type {string} */
        this.description = description;
        /** @type {string} */
        this.folderName = folderName;
    }
}

class CategoryInfoClass {
    constructor(categoryTitle, categoryDescription, sheetBackground) {
        /** @type {string} */
        this.categoryTitle = categoryTitle;
        /** @type {string} */
        this.categoryDescription = categoryDescription;
        /** @type {string} */
        this.sheetBackground = sheetBackground;
        /** @type {Object<string, GameInfoClass>} */
        this.games = {};
    }
}

const gamesInfoByCategory = {
    ScribeQuest: new CategoryInfoClass(
        "<<<--- Mnemonic as WORDS --->>>",
        "Ideal for word wizards and literary adventurers ready to spell their way to victory!",
        "The traditional banking model achieves a level of privacy by limiting access to information to the parties involved and the trusted third party. The necessity to announce all transactions publicly precludes this method, but privacy can still be maintained by breaking the flow of information in another place: by keeping public keys anonymous. The public can see that someone is sending an amount to someone else, but without information linking the transaction to anyone. This is similar to the level of information released by stock exchanges, where the time and size of individual trades, the 'tape', is made public, but without telling who the parties were. As an additional firewall, a new key pair should be used for each transaction to keep them from being linked to a common owner. Some linking is still unavoidable with multi-input transactions, which necessarily reveal that their inputs were owned by the same owner. The risk is that if the owner of a key is revealed, linking could reveal other transactions that belonged to the same owner."
    ),
    CipherCircuit: new CategoryInfoClass(
        "<<<--- Mnemonic as NUMBERS --->>>",
        "Perfect for numerical ninjas and arithmetic adventurers",
        "q=0.1 z=0 P=1.0000000 z=1 P=0.2045873 z=2 P=0.0509779 z=3 P=0.0131722 z=4 P=0.0034552 z=5 P=0.0009137 z=6 P=0.0002428 z=7 P=0.0000647 z=8 P=0.0000173 z=9 P=0.0000046 z=10 P=0.0000012 q=0.3 z=0 P=1.0000000 z=5 P=0.1773523 z=10 P=0.0416605 z=15 P=0.0101008 z=20 P=0.0024804 z=25 P=0.0006132 z=30 P=0.0001522 z=35 P=0.0000379 z=40 P=0.0000095 z=45 P=0.0000024 z=50 P=0.0000006 q=3.14 z=0 P=1.0000000 z=0.6185039 q=0.10 z=5 q=0.15 z=8 q=0.20 z=11 q=0.25 z=15 q=0.30 z=24 q=0.35 z=41 q=0.40 z=89 q=0.45 z=340 q=0.1 z=0 P=1.0000000 z=1 P=0.2045873 z=2 P=0.0509779 z=3 P=0.0131722 z=4 P=0.0034552 z=5 P=0.0009137 z=6 P=0.0002428 z=7 P=0.0000647 z=8 P=0.0000173 z=9 P=0.0000046 z=10 P=0.0000012 q=0.3 z=0 P=1.0000000 z=5 P=0.1773523 z=10 P=0.0416605 z=15 P=0.0101008 z=20 P=0.0024804 z=25 P=0.0006132 z=30 P=0.0001522 z=35 P=0.0000379 z=40 P=0.0000095 z=45 P=0.0000024 z=50 P=0.0000006 q=3.14 z=0 P=1.0000000 z=0.6185039 q=0.10 z=5 q=0.15 z=8 q=0.20 z=11 q=0.25 z=15 q=0.30 z=24 q=0.35 z=41 q=0.40 z=89 q=0.45 z=340"
    ),
    ByteBard: new CategoryInfoClass(
        "<<<--- Mnemonic as BASE64 --->>>",
        "A haven for code crafters and digital dreamers ready to debug their destiny!",
        `{double p = 1.0 - q; double lambda = z * (q / p); double sum = 1.0; int i, k; for (k = 0; k <= z; k++) { double poisson = exp(-lambda); for (i = 1; i <= k; i++) poisson *= lambda / i; sum -= poisson * (1 - pow(q / p, z - k)); } return sum; }; {double p = 1.0 - q; double lambda = z * (q / p); double sum = 1.0; int i, k; for (k = 0; k <= z; k++) { double poisson = exp(-lambda); for (i = 1; i <= k; i++) poisson *= lambda / i; sum -= poisson * (1 - pow(q / p, z - k)); } return sum; }; {double p = 1.0 - q; double lambda = z * (q / p); double sum = 1.0; int i, k; for (k = 0; k <= z; k++) { double poisson = exp(-lambda); for (i = 1; i <= k; i++) poisson *= lambda / i; sum -= poisson * (1 - pow(q / p, z - k)); } return sum; }; {double p = 1.0 - q; double lambda = z * (q / p); double sum = 1.0; int i, k; for (k = 0; k <= z; k++) { double poisson = exp(-lambda); for (i = 1; i <= k; i++) poisson *= lambda / i; sum -= poisson * (1 - pow(q / p, z - k)); } return sum; }`
    )
}

// SCRIBE QUEST
gamesInfoByCategory.ScribeQuest.games.give_me_ya_seed = new GameInfoClass(
    "Give Me Ya Seed!",
    "A game of words and wits.",
    "give_me_ya_seed"
);

// CIPHER CIRCUIT
gamesInfoByCategory.CipherCircuit.games.give_me_ya_seed = new GameInfoClass(
    "Give Me Ya Seed!",
    "A game of indexes and wits.",
    "give_me_ya_seed"
);

// BYTE BARD
gamesInfoByCategory.ByteBard.games.give_me_ya_seed = new GameInfoClass(
    "Give Me Ya Seed!",
    "A game of b64 and wits.",
    "give_me_ya_seed"
);

if (false) {
    module.exports = { gamesInfoByCategory, GameInfoClass, CategoryInfoClass };
}
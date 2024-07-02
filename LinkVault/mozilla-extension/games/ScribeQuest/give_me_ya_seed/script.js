if (false) { // THIS IS FOR DEV ONLY ( to get better code completion )
    const { gameControllerClass } = require("../../scripts/classes.js");
    const gameController = new gameControllerClass();
}

(async function() {
    class quizWordClass {
        constructor(word = 'toto', index = 0) {
            this.element = this.#createCarouselItem(word, index);
            this.input = this.element.getElementsByTagName("input")[0];
            this.word = word;
            this.index = index;
            this.hint = 0;
            /** @type {HTMLDivElement} */
            this.circleTimer = null;
        }
        /** @returns {boolean} - true if there is still dash in the input value, false otherwise */
        setValueForGuess() {
            let newValue = "";
            switch (this.hint) {
                case 0: newValue = "-".repeat(this.word.length); break;
                case 1: newValue = this.word[0] + "-".repeat(this.word.length - 1); break;
                case 2: newValue = this.word[0] + this.word[1] + "-".repeat(this.word.length - 2); break;
                case 3: newValue = this.word[0] + this.word[1] + this.word[2] + "-".repeat(this.word.length - 3); break;
                case 4: newValue = this.word; break;
            }

            this.input.value = newValue;

            const isRemainingDash = this.setInputSelectionToFirstCharOcurrence('-');
            return isRemainingDash;
        }
        resetCorrectWrongClasses() {
            this.input.classList.remove("correct", "wrong");
        }
        setCorrect() {
            this.input.value = "✓";
            this.input.classList.add("correct");
            this.removeExistingHintTimer();
        }
        setWrong() {
            this.input.classList.add("wrong");
        }
        isCorrect() {
            if (this.input.value.includes("✓")) { return true; }
            if (this.input.value === this.word) { return true; }

            return false;
        }
        setInputSelectionToFirstCharOcurrence(char = '-') {
            const index = this.input.value.indexOf(char);
            if (index === -1) { return false; }

            this.input.selectionStart = index;
            this.input.selectionEnd = index;
            return true;
        }
        replaceFirstCharOfInput(char = '-', newChar = 'a') {
            const str = this.input.value;
            for (let i = 0; i < str.length; i++) {
                if (str[i] === char) { this.input.value = str.substring(0, i) + newChar + str.substring(i + 1); break; }
            }
        }
        #createQuizWordCircleTimer(duration = 5000) {
            const circleTimer = document.createElement("div");
            circleTimer.className = "circleTimer";

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 100 100");
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

            const circleBackground = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circleBackground.setAttribute("class", "circle-background");
            circleBackground.setAttribute("cx", "50");
            circleBackground.setAttribute("cy", "50");
            circleBackground.setAttribute("r", "45");

            const circleProgress = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circleProgress.setAttribute("class", "circle-progress");
            circleProgress.setAttribute("cx", "50");
            circleProgress.setAttribute("cy", "50");
            circleProgress.setAttribute("r", "45");
            circleProgress.style.animation = `countdown ${duration}ms linear forwards`;

            svg.appendChild(circleBackground);
            svg.appendChild(circleProgress);
            circleTimer.appendChild(svg);

            return circleTimer;
        }
        removeExistingHintTimer() {
            if (this.circleTimer !== null) { this.circleTimer.remove(); }
        }
        initHintTimer(duration = 5000) {
            this.removeExistingHintTimer();
            this.circleTimer = this.#createQuizWordCircleTimer(duration);
            this.element.insertBefore(this.circleTimer, this.input);
        }
        #createCarouselItem(text = 'toto', index = 0) {
            const div = document.createElement("div");
            div.className = "quizWord";
        
            const title = document.createElement("h1");
            title.innerText = (index + 1).toString() + ".";

            const input = document.createElement("input");
            input.type = "text";
            input.value = text;
            input.readOnly = true;

        
            div.appendChild(title);
            div.appendChild(input);
        
            return div;
        }
        setReadOnly() { this.input.readOnly = true; }
        removeReadOnly() { this.input.readOnly = false; }
        isLengthEqualToWordLength() { return this.input.value.length === this.word.length; }
    };
    class carouselControllerClass {
        constructor(mnemonic, carouselElement = document.getElementById("quizCarousel")) {
            /** @type {Array<string>} */
            this.mnemonic = mnemonic;
            /** @type {HTMLElement} */
            this.carouselElement = carouselElement;
            /** @type {Array<quizWordClass>} */
            this.quizWords = [];
            this.hintTimerDuration = 5000;
            this.wrongRevealPauseDuration = 1200;
        }
        init() {
            this.#fillCarousel(this.mnemonic);
            this.setupEventListener(this.carouselElement, "click", this.quizCarouselClickHandler);
            this.setupEventListener(this.carouselElement, "keydown", this.quizCarouselKeydownHandler);
            this.setupEventListener(this.carouselElement, "input", this.quizCarouselInputHandler);
        }
        #fillCarousel(mnemonic) {
            this.carouselElement.innerHTML = "";
            this.quizWords = [];
        
            for (let i = 0; i < mnemonic.length; i++) {
                const newQuizWord = new quizWordClass(mnemonic[i], i);
                const element = newQuizWord.element;
                if (i === 0) { element.classList.add("center"); }
                if (i === 1) { element.classList.add("bottom"); }
                if (i === 2) { element.classList.add("extremeBottom"); }
                if (i > 2) { element.classList.add("outBottom"); }
                this.carouselElement.appendChild(element);
                this.quizWords.push(newQuizWord);
            }
        }
        async focusWord(index, readyToType = false) {
            const quizWords = this.quizWords;
            if (index >= quizWords.length) { return false; }
            
            for (let i = 0; i < quizWords.length; i++) {
                let newPosition = 'center';
                if (i < index - 2) { newPosition = 'outTop'; }
                if (i === index - 2) { newPosition = 'extremeTop'; }
                if (i === index - 1) { newPosition = 'top'; }
                if (i === index + 1) { newPosition = 'bottom'; }
                if (i === index + 2) { newPosition = 'extremeBottom'; }
                if (i > index + 2) { newPosition = 'outBottom'; }

                if (newPosition !== 'center') { quizWords[i].removeExistingHintTimer(); }
        
                const element = quizWords[i].element;
                element.classList.remove("outTop", "extremeTop", "top", "center", "bottom", "extremeBottom", "outBottom");
                element.classList.add(newPosition);
            }
        
            if (readyToType) {
                quizWords[index].removeReadOnly();
                quizWords[index].input.focus();
                quizWords[index].setInputSelectionToFirstCharOcurrence('-');

                let { promise } = gameController.pause(400);
                if (!await promise) { return; }

                this.#initWordHintTimer(index);
            }
        }
        async #initWordHintTimer(index) {
            const quizWord = this.quizWords[index];
            quizWord.removeExistingHintTimer();
            quizWord.initHintTimer(this.hintTimerDuration);

            const { promise } = gameController.pause(this.hintTimerDuration);
            if (!await promise) { return; }
            if (quizWord.input.readOnly) { return; } // if user already typed the correct word (during the pause), we do nothing

            quizWord.hint++;
            const isRemainingDash = quizWord.setValueForGuess();

            if (!isRemainingDash) { 
                quizWord.setReadOnly();
                const { promise } = gameController.pause(this.wrongRevealPauseDuration);
                if (!await promise) { return; }

                this.focusWord(quizWord.index + 1, true); // focus next word, ready to type
                return; 
            }

            this.#initWordHintTimer(index);
        }
        async showAllThenHideAndComeBackToFirst(showDelay = 800, hideDelay = 100) {
            const quizWords = this.quizWords;
            const nbOfWords = quizWords.length;

            for (let i = 0; i < nbOfWords; i++) {
                this.focusWord(i);
                const { promise } = gameController.pause(showDelay);
                if (!await promise) { return; }
            }
        
            for (let i = 0; i < nbOfWords; i++) {
                const quizWord = quizWords[i];
                const length = quizWord.word.length;
                if (i + 3 < nbOfWords) { quizWord.setValueForGuess(); continue; }
                
                // same but appear slowly for the last 3 words (visible by user at this point of animation)
                quizWord.input.value = "";
                for (let j = 0; j < length; j++) {
                    quizWord.input.value += "-"; 
                    const { promise, abort } = gameController.pause(20);
                    if (!await promise) { abort(); return; }
                }
            }
        
            for (let i = nbOfWords - 1; i >= 0; i--) {
                this.focusWord(i);
                const { promise } = gameController.pause(hideDelay);
                if (!await promise) { return; }
            }
        
            this.focusWord(0, true);
            return true;
        }
        #findQuizWordByInputElement(target) {
            if (target.tagName !== "INPUT") { return null; }

            for (let i = 0; i < this.quizWords.length; i++) {
                if (this.quizWords[i].input === target) { return this.quizWords[i]; }
            }
            return null;
        }
    
        // Event Handlers
        setupEventListener(element, eventType, handler) {
            element.addEventListener(eventType, handler.bind(this));
            gameController.gameEventListeners.push({element: element, eventType: eventType, handler: handler});
        }
        async quizCarouselInputHandler(event) {
            const quizWord = this.#findQuizWordByInputElement(event.target);
            if (quizWord === null) { return; }

            // if already correct, do nothing -> wait for next word
            if (quizWord.isCorrect()) { event.preventDefault(); return; }

            quizWord.resetCorrectWrongClasses();
            quizWord.replaceFirstCharOfInput('-', '');
    
            // if input length is not the same as mnemonic word length, we reset input value to dashes
            if (!quizWord.isLengthEqualToWordLength()) { quizWord.setValueForGuess(); return; }
    
            // user typed the correct word, set value as check symbol, and focus next word
            if (quizWord.isCorrect()) {
                quizWord.setCorrect();
                quizWord.setReadOnly();
                quizWord.removeExistingHintTimer();
                const { promise } = gameController.pause(200);
                if (!await promise) { return; }

                this.focusWord(quizWord.index + 1, true); // focus next word, ready to type
                return;
            }
        
            let isRemainingDash = quizWord.setInputSelectionToFirstCharOcurrence('-');
            if (isRemainingDash) { return; }
            
            // if no dash remaining, user input a wrong word, we help him by showing the first letter
            quizWord.hint++;
            quizWord.setWrong();
            isRemainingDash = quizWord.setValueForGuess();
            if (isRemainingDash) { return; }

            // if no dash remaining, actual hint is the last one, we show the full word
            quizWord.setReadOnly();
            quizWord.removeExistingHintTimer();
            const { promise } = gameController.pause(this.wrongRevealPauseDuration);
            if (!await promise) { return; }

            this.focusWord(quizWord.index + 1, true); // focus next word, ready to type
        };
        quizCarouselClickHandler(event) {
            const quizWord = this.#findQuizWordByInputElement(event.target);
            if (quizWord === null) { return; }
            
            // set user typing at the first dash occurrence
            quizWord.setInputSelectionToFirstCharOcurrence('-');

            event.preventDefault();
        }
        quizCarouselKeydownHandler(event) {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); }
            if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); }
            if (event.key === " ") { event.preventDefault(); }
        }
    };

    gameController.init(true);

    /** @type {Array<string>} */
    const mnemonic = loadMnemonicFromSecureModule();
    if (mnemonic.length === 0) { return; }

    const carouselElement = document.getElementById("quizCarousel");
    const carouselController = new carouselControllerClass(mnemonic, carouselElement);
    carouselController.init();
    //await carouselController.showAllThenHideAndComeBackToFirst(100); // fast mode for dev purpose
    await carouselController.showAllThenHideAndComeBackToFirst(1000);
    if (!gameController.isGameActive) { return; }
})();
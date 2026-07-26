/* ── wisdom.js ──────────────────────────────────────────────
 * Daily Wisdom — weighted-random idiom engine
 * Data source: /static/data/idioms.json (100 entries)
 * Audio source: /static/audio/idioms/{idiom}.mp3
 *               /static/audio/examples/{idiom}_ex{1,2}.mp3
 * Persistence: localStorage (yueli_wisdom)
 * ─────────────────────────────────────────────────────────── */

const Wisdom = (() => {
    let idioms = [];
    let state = null;
    let currentIdiom = null;

    const STORAGE_KEY = 'yueli_wisdom';

    // Audio elements
    let idiomAudio = null;
    let example1Audio = null;
    let example2Audio = null;

    /**
     * Initialize: load idioms + state, pick today's idiom
     */
    async function init() {
        try {
            const response = await fetch('/static/data/idioms.json');
            idioms = await response.json();
        } catch (err) {
            console.warn('Wisdom: idioms.json not loaded — Phase 2');
            return;
        }

        state = loadState();
        const today = Utils.todayISO();

        if (state.lastShownDate !== today) {
            // New day
            if (state.shownList.length >= idioms.length) {
                state.shownList = []; // reset cycle
            }
            const idiom = pickIdiom(state.shownList, idioms);
            if (idiom) {
                state.shownList.push(idiom.id);
                state.currentId = idiom.id;
                state.lastShownDate = today;
                saveState(state);
                renderIdiom(idiom);
            }
        } else {
            // Same day
            const idiom = idioms.find(i => i.id === state.currentId);
            if (idiom) renderIdiom(idiom);
        }

        bindActions();
    }

    /**
     * Weighted-random: pick uniformly from unseen idioms
     */
    function pickIdiom(shownList, allIdioms) {
        const shownSet = new Set(shownList);
        const candidates = allIdioms.filter(i => !shownSet.has(i.id));
        if (candidates.length === 0) {
            return allIdioms[Math.floor(Math.random() * allIdioms.length)];
        }
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    /**
     * Manual swap
     */
    function swapIdiom() {
        if (!state || idioms.length === 0) return;
        const newIdiom = pickIdiom(state.shownList, idioms);
        if (newIdiom) {
            state.shownList.push(newIdiom.id);
            state.currentId = newIdiom.id;
            saveState(state);
            renderIdiom(newIdiom);
        }
    }

    /**
     * Render idiom to the DOM
     */
    function renderIdiom(idiom) {
        currentIdiom = idiom;

        const el = {
            idiom: Utils.$('#wisdom-idiom'),
            pinyin: Utils.$('#wisdom-pinyin'),
            meaning: Utils.$('#wisdom-meaning'),
            example: Utils.$('#wisdom-example'),
            explanation: Utils.$('#wisdom-explanation'),
            similar: Utils.$('#wisdom-similar')
        };

        if (el.idiom) el.idiom.textContent = idiom.idiom;
        if (el.pinyin) el.pinyin.textContent = idiom.pinyin;
        if (el.meaning) el.meaning.textContent = idiom.meaning;

        if (el.example && idiom.examples) {
            let exampleHtml = '';
            idiom.examples.forEach((ex, i) => {
                exampleHtml += `
                    <div class="wisdom__example-item">
                        <span class="wisdom__example-num">${i + 1}.</span>
                        <div>
                            <p>${ex.zh}</p>
                            <p><em>${ex.pinyin}</em></p>
                            <p>${ex.en}</p>
                        </div>
                    </div>
                `;
            });
            el.example.innerHTML = exampleHtml;
        }

        if (el.explanation) el.explanation.textContent = idiom.explanation || '';
        if (el.similar && idiom.english_similar) {
            el.similar.innerHTML = '<strong>Similar:</strong> ' +
                idiom.english_similar.map(s => `${s.idiom} (${s.source})`).join(', ');
        }

        // Set up audio
        setupAudio(idiom);
    }

    /**
     * Set up audio elements for the current idiom
     */
    function setupAudio(idiom) {
        // Clean up previous audio
        if (idiomAudio) { idiomAudio.pause(); idiomAudio = null; }
        if (example1Audio) { example1Audio.pause(); example1Audio = null; }
        if (example2Audio) { example2Audio.pause(); example2Audio = null; }

        // Create audio elements
        idiomAudio = new Audio(`/static/audio/idioms/${idiom.idiom}.mp3`);
        example1Audio = new Audio(`/static/audio/examples/${idiom.idiom}_ex1.mp3`);
        example2Audio = new Audio(`/static/audio/examples/${idiom.idiom}_ex2.mp3`);

        // Update button states
        updateAudioButtons();
    }

    /**
     * Play idiom audio
     */
    function playIdiom() {
        if (!idiomAudio) return;
        idiomAudio.currentTime = 0;
        idiomAudio.play().catch(err => console.warn('Audio play failed:', err));
    }

    /**
     * Play example audio (1 or 2)
     */
    function playExample(num) {
        const audio = num === 1 ? example1Audio : example2Audio;
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().catch(err => console.warn('Audio play failed:', err));
    }

    /**
     * Update audio button states
     */
    function updateAudioButtons() {
        const idiomBtn = Utils.$('#btn-play-idiom');
        const ex1Btn = Utils.$('#btn-play-ex1');
        const ex2Btn = Utils.$('#btn-play-ex2');

        // Check if audio files exist (they might 404)
        if (idiomBtn) idiomBtn.disabled = !idiomAudio;
        if (ex1Btn) ex1Btn.disabled = !example1Audio;
        if (ex2Btn) ex2Btn.disabled = !example2Audio;
    }

    /**
     * Bind UI actions
     */
    function bindActions() {
        const swapBtn = Utils.$('#btn-wisdom-swap');
        const expandBtn = Utils.$('#btn-wisdom-expand');
        const extras = Utils.$('#wisdom-extras');
        const idiomBtn = Utils.$('#btn-play-idiom');
        const ex1Btn = Utils.$('#btn-play-ex1');
        const ex2Btn = Utils.$('#btn-play-ex2');

        if (swapBtn) swapBtn.addEventListener('click', swapIdiom);
        if (expandBtn && extras) {
            expandBtn.addEventListener('click', () => {
                const isHidden = extras.hidden;
                extras.hidden = !isHidden;
                const textEl = expandBtn.querySelector('.expand-text');
                if (textEl) textEl.textContent = isHidden ? 'Less' : 'More';
                const chevron = expandBtn.querySelector('img');
                if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        }

        // Audio buttons
        if (idiomBtn) idiomBtn.addEventListener('click', playIdiom);
        if (ex1Btn) ex1Btn.addEventListener('click', () => playExample(1));
        if (ex2Btn) ex2Btn.addEventListener('click', () => playExample(2));
    }

    /**
     * Load state from localStorage
     */
    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch {}
        return { shownList: [], lastShownDate: '', currentId: null };
    }

    /**
     * Save state to localStorage
     */
    function saveState(s) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        } catch {}
    }

    return {
        init,
        swapIdiom,
        renderIdiom,
        playIdiom,
        playExample
    };
})();

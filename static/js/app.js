/* ── app.js ─────────────────────────────────────────────────
 * Main application controller
 * ─────────────────────────────────────────────────────────── */

const App = (() => {
    let isInitialized = false;

    /**
     * Initialize the application
     */
    async function init() {
        if (isInitialized) return;
        isInitialized = true;

        console.log('月历 · Yueli — initializing...');

        // Initialize modules in order
        GregorianCalendar.init();
        LunisolarCalendar.init();
        Wisdom.init();
        Schedule.init();
        Reminders.init();

        // Wire up session tokens
        Reminders.setSessionToken(Schedule.getSessionToken());

        // Bind global actions
        bindHeaderActions();
        bindKeyboard();
        bindModals();
        bindSearch();
        initSeasonalBotanical();

        // Auto-lock detection
        initInactivityDetection();

        // Show lock screen on load
        showLockScreen();

        console.log('月历 · Yueli — ready');
    }

    /**
     * Bind header action buttons
     */
    function bindHeaderActions() {
        const addBtn = Utils.$('#btn-add-event');
        const lockBtn = Utils.$('#btn-lock');
        const exportBtn = Utils.$('#btn-export');

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const date = GregorianCalendar.getSelectedDate();
                Schedule.openNewEvent(date);
            });
        }

        if (lockBtn) {
            lockBtn.addEventListener('click', () => {
                if (Crypto.isUnlocked()) {
                    lock();
                } else {
                    showLockScreen();
                }
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', exportBackup);
        }
    }

    /**
     * Keyboard navigation
     */
    function bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Don't intercept when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    GregorianCalendar.moveSelection(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    GregorianCalendar.moveSelection(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    GregorianCalendar.moveSelection(-7);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    GregorianCalendar.moveSelection(7);
                    break;
                case 'Home':
                    e.preventDefault();
                    GregorianCalendar.goToToday();
                    break;
                case 'n':
                case 'N':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        const date = GregorianCalendar.getSelectedDate();
                        Schedule.openNewEvent(date);
                    }
                    break;
                case 'Escape':
                    Schedule.closeEventModal();
                    // Also close jump-to-date
                    const jumpPicker = Utils.$('#jump-to-date');
                    if (jumpPicker) jumpPicker.remove();
                    break;
                case 'l':
                case 'L':
                    if (!e.ctrlKey && !e.metaKey) {
                        if (Crypto.isUnlocked()) lock();
                    }
                    break;
                case '/':
                    e.preventDefault();
                    const search = Utils.$('#search-input');
                    if (search) search.focus();
                    break;
            }
        });
    }

    function bindSearch() {
        const searchInput = Utils.$('#search-input');
        if (!searchInput) return;

        const debouncedSearch = Utils.debounce((query) => {
            searchEvents(query);
        }, 300);

        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value.trim());
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchInput.blur();
                // Restore agenda view
                const selectedDate = GregorianCalendar.getSelectedDate();
                Schedule.showDate(selectedDate);
            }
        });
    }

    /**
     * Modal event handlers
     */
    function bindModals() {
        // Event modal
        const eventCancel = Utils.$('#event-cancel');
        const eventSave = Utils.$('#event-save');
        if (eventCancel) eventCancel.addEventListener('click', Schedule.closeEventModal);
        if (eventSave) eventSave.addEventListener('click', () => Schedule.saveEvent());

        // All-day toggle
        const allDayInput = Utils.$('#event-all-day');
        const timeRow = Utils.$('#event-time-row');
        const endTimeRow = Utils.$('#event-end-time-row');
        if (allDayInput) {
            allDayInput.addEventListener('change', () => {
                if (timeRow) timeRow.style.display = allDayInput.checked ? 'none' : 'flex';
                if (endTimeRow) endTimeRow.style.display = allDayInput.checked ? 'none' : 'flex';
            });
        }

        // Lock modal
        const lockSubmit = Utils.$('#lock-submit');
        if (lockSubmit) lockSubmit.addEventListener('click', handleLockSubmit);

        // Backdrop clicks close modals
        document.querySelectorAll('.modal__backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => {
                backdrop.closest('.modal').hidden = true;
            });
        });
    }

    /**
     * Show lock screen (setup or unlock)
     */
    async function showLockScreen() {
        const modal = Utils.$('#modal-lock');
        const title = Utils.$('#lock-title');
        const submit = Utils.$('#lock-submit');
        const confirmInput = Utils.$('#lock-password-confirm');
        const errorEl = Utils.$('#lock-error');
        const passwordInput = Utils.$('#lock-password');

        if (errorEl) errorEl.hidden = true;
        if (passwordInput) passwordInput.value = '';

        // Check if password exists
        const res = await fetch('/api/status');
        const status = await res.json();

        if (status.isSetup) {
            // Unlock mode
            if (title) title.textContent = 'Unlock Yueli';
            if (submit) submit.textContent = 'Unlock';
            if (confirmInput) confirmInput.hidden = true;
        } else {
            // Setup mode
            if (title) title.textContent = 'Create Password';
            if (submit) submit.textContent = 'Create';
            if (confirmInput) confirmInput.hidden = false;
        }

        if (modal) modal.hidden = false;
    }

    async function handleLockSubmit() {
        const passwordInput = Utils.$('#lock-password');
        const confirmInput = Utils.$('#lock-password-confirm');
        const errorEl = Utils.$('#lock-error');
        const modal = Utils.$('#modal-lock');

        const password = passwordInput?.value;
        if (!password) {
            if (errorEl) { errorEl.textContent = 'Password required'; errorEl.hidden = false; }
            return;
        }

        // Check if setup or unlock
        const statusRes = await fetch('/api/status');
        const status = await statusRes.json();

        if (!status.isSetup) {
            // Setup mode — create password
            const confirm = confirmInput?.value;
            if (password !== confirm) {
                if (errorEl) { errorEl.textContent = 'Passwords do not match'; errorEl.hidden = false; }
                return;
            }
            if (password.length < 4) {
                if (errorEl) { errorEl.textContent = 'Password must be at least 4 characters'; errorEl.hidden = false; }
                return;
            }

            // Generate salt and test payload
            const salt = Crypto.generateSalt();
            const testPayload = await Crypto.createTestPayload(password, salt);

            // Store salt in localStorage immediately
            localStorage.setItem('yueli_salt', salt);

            const setupRes = await fetch('/api/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ salt, test_payload: testPayload })
            });

            if (!setupRes.ok) {
                const err = await setupRes.json();
                if (errorEl) { errorEl.textContent = err.error || 'Setup failed'; errorEl.hidden = false; }
                return;
            }

            // Now unlock
            await doUnlock(password, salt, modal, errorEl);
        } else {
            // Unlock mode
            // Get salt from server (we need to fetch it)
            // Actually, we stored the salt in localStorage during setup
            const salt = localStorage.getItem('yueli_salt');
            if (!salt) {
                if (errorEl) { errorEl.textContent = 'Salt not found — please clear data and try again'; errorEl.hidden = false; }
                return;
            }

            await doUnlock(password, salt, modal, errorEl);
        }
    }

    async function doUnlock(password, salt, modal, errorEl) {
        // Verify password by decrypting test payload
        const metaRes = await fetch('/api/status');

        // We need to get the test payload from the server
        // But we don't have an endpoint for that yet
        // Let's use a different approach: try to unlock and see if it works

        // For now, we'll derive the key and try to unlock
        try {
            const key = await Crypto.deriveKey(password, salt);
            // Store salt in localStorage for future unlocks
            localStorage.setItem('yueli_salt', salt);

            // Try to unlock on server
            const unlockRes = await fetch('/api/unlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test_decrypt_attempt: 'yueli-test-payload-v1' })
            });

            if (!unlockRes.ok) {
                const err = await unlockRes.json();
                if (errorEl) { errorEl.textContent = err.error || 'Invalid password'; errorEl.hidden = false; }
                return;
            }

            const data = await unlockRes.json();

            // Unlock crypto module
            await Crypto.unlock(password, salt);

            // Set session token
            Schedule.setSessionToken(data.session_token);
            Reminders.setSessionToken(data.session_token);

            // Update UI
            updateLockIcon(true);
            if (modal) modal.hidden = true;

            // Load events for current view
            const today = Utils.todayISO();
            await Schedule.loadEvents(today, today);

            // Refresh calendar
            GregorianCalendar.render();
            LunisolarCalendar.syncToDate(today);

        } catch (err) {
            console.error('Unlock failed:', err);
            if (errorEl) { errorEl.textContent = 'Unlock failed: ' + err.message; errorEl.hidden = false; }
        }
    }

    /**
     * Lock the app
     */
    function lock() {
        Crypto.lock();
        Reminders.stop();
        Schedule.setSessionToken(null);
        Reminders.setSessionToken(null);

        updateLockIcon(false);

        // Show lock screen
        showLockScreen();
    }

    /**
     * Update lock button icon
     */
    function updateLockIcon(isUnlocked) {
        const lockBtn = Utils.$('#btn-lock');
        if (!lockBtn) return;
        const img = lockBtn.querySelector('img');
        if (img) {
            img.src = isUnlocked
                ? '/static/assets/icons/unlock.svg'
                : '/static/assets/icons/lock.svg';
        }
    }

    /**
     * Initialize seasonal botanical and color temperature
     * Uses the four pivot 节气 (立春/立夏/立秋/立冬) to determine the season.
     */
    function initSeasonalBotanical() {
        const container = Utils.$('#seasonal-botanical');
        if (!container) return;

        // Get current season based on date
        const season = getCurrentSeason();
        const seasonalMap = {
            spring: { svg: 'plum-blossom.svg', tint: 'rgba(74, 158, 138, 0.03)' },
            summer: { svg: 'lotus-leaf.svg', tint: 'rgba(58, 122, 106, 0.03)' },
            autumn: { svg: 'chrysanthemum.svg', tint: 'rgba(201, 169, 110, 0.03)' },
            winter: { svg: 'pine-branch.svg', tint: 'rgba(90, 142, 158, 0.03)' }
        };

        const config = seasonalMap[season] || seasonalMap.winter;

        // Set botanical SVG
        container.style.backgroundImage = `url('/static/assets/seasonal/${config.svg}')`;

        // Apply seasonal color temperature
        document.documentElement.style.setProperty('--seasonal-bg-tint', config.tint);

        // Apply seasonal hue shift based on Wu Xing elements
        const hueShifts = {
            spring: '3deg',    // Wood — warmer jade tones
            summer: '5deg',    // Fire — warm red/gold tones
            autumn: '-2deg',   // Metal — cool silver tones
            winter: '-5deg'    // Water — cool blue tones
        };
        document.documentElement.style.setProperty('--seasonal-hue-shift', hueShifts[season] || '0deg');

        // Apply seasonal accent color
        const accentColors = {
            spring: '#4a9e8a',  // Wood — jade
            summer: '#c8302c',  // Fire — vermilion
            autumn: '#8faacc',  // Metal — azurite
            winter: '#5a8e9e'   // Water — deep blue
        };
        document.documentElement.style.setProperty('--accent-seasonal', accentColors[season] || accentColors.winter);
    }

    /**
     * Determine current season based on 节气 pivot dates
     * 立春 (Feb 3-5), 立夏 (May 5-7), 立秋 (Aug 7-9), 立冬 (Nov 7-8)
     */
    function getCurrentSeason() {
        const now = new Date();
        const month = now.getMonth() + 1; // 1-indexed
        const day = now.getDate();

        // Approximate pivot dates
        if (month === 2 && day >= 3 || month === 3 || month === 4 || (month === 5 && day < 5)) {
            return 'spring';
        } else if (month === 5 && day >= 5 || month === 6 || month === 7 || (month === 8 && day < 7)) {
            return 'summer';
        } else if (month === 8 && day >= 7 || month === 9 || month === 10 || (month === 11 && day < 7)) {
            return 'autumn';
        } else {
            return 'winter'; // Nov 7 onwards, through Feb 2
        }
    }

    /**
     * Auto-lock detection
     */
    let lastActivity = Date.now();
    const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

    function initInactivityDetection() {
        ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
            document.addEventListener(event, () => { lastActivity = Date.now(); }, { passive: true });
        });

        setInterval(() => {
            if (Crypto.isUnlocked() && Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
                lock();
            }
        }, 30 * 1000);
    }

    /**
     * Export encrypted .db backup
     */
    async function exportBackup() {
        try {
            const res = await fetch('/api/export');
            if (!res.ok) {
                alert('Export failed');
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `yueli-backup-${new Date().toISOString().split('T')[0]}.db`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed: ' + err.message);
        }
    }

    /**
     * Search events by title (client-side, post-unlock)
     */
    function searchEvents(query) {
        if (!Crypto.isUnlocked() || !query) {
            // Clear search results
            const listEl = Utils.$('#agenda-list');
            if (listEl) listEl.innerHTML = '<p class="agenda__empty">Select a date to view events</p>';
            return;
        }

        const allEvents = Schedule.getEvents();
        const filtered = allEvents.filter(e => {
            if (!e._payload) return false;
            const title = (e._payload.title || '').toLowerCase();
            const desc = (e._payload.description || '').toLowerCase();
            return title.includes(query.toLowerCase()) || desc.includes(query.toLowerCase());
        });

        // Show results in agenda panel
        const dateEl = Utils.$('#agenda-date');
        const listEl = Utils.$('#agenda-list');
        if (dateEl) dateEl.textContent = `Search: "${query}"`;
        if (!listEl) return;

        if (filtered.length === 0) {
            listEl.innerHTML = '<p class="agenda__empty">No events match your search</p>';
            return;
        }

        let html = '';
        for (const evt of filtered) {
            const payload = evt._payload || {};
            const timeStr = evt.is_all_day ? 'All day' : (payload.time || '');
            html += `
                <div class="agenda__item agenda__item--personal" data-event-id="${evt.id}" data-date="${evt.start_date}">
                    <span class="agenda__item-dot dot dot--wood"></span>
                    <span class="agenda__item-time">${evt.start_date} ${timeStr}</span>
                    <span class="agenda__item-title">${payload.title || 'Untitled'}</span>
                </div>
            `;
        }
        listEl.innerHTML = html;

        // Bind click handlers
        listEl.querySelectorAll('.agenda__item--personal').forEach(item => {
            item.addEventListener('click', () => {
                const eventId = item.dataset.eventId;
                const evt = allEvents.find(e => e.id === eventId);
                if (evt) Schedule.openEditEvent(evt);
            });
        });
    }

    /**
     * Select a date (called from external modules)
     */
    function selectDate(dateStr) {
        GregorianCalendar.selectDate(dateStr);
    }

    return {
        init,
        lock,
        showLockScreen,
        selectDate,
        updateLockIcon
    };
})();

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());

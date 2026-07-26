/* ── gregorian.js ───────────────────────────────────────────
 * Gregorian calendar rendering + navigation
 * ─────────────────────────────────────────────────────────── */

const GregorianCalendar = (() => {
    let currentYear;
    let currentMonth; // 0-indexed
    let selectedDate; // 'YYYY-MM-DD'

    const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    function init() {
        const now = new Date();
        currentYear = now.getFullYear();
        currentMonth = now.getMonth();
        selectedDate = Utils.todayISO();

        renderWeekdays();
        render();
        bindNavigation();
    }

    function renderWeekdays() {
        const container = Utils.$('#greg-weekdays');
        if (!container) return;
        container.innerHTML = WEEKDAYS.map(d =>
            `<span class="calendar__weekday">${d}</span>`
        ).join('');
    }

    function render() {
        const title = Utils.$('#greg-title');
        const grid = Utils.$('#greg-grid');
        if (!title || !grid) return;

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        title.textContent = `${monthNames[currentMonth]} ${currentYear}`;

        const daysCount = Utils.daysInMonth(currentYear, currentMonth);
        const startDay = Utils.firstDayOfWeek(currentYear, currentMonth);
        const today = Utils.todayISO();

        let html = '';

        // Previous month trailing days
        const prevMonthDays = Utils.daysInMonth(
            currentMonth === 0 ? currentYear - 1 : currentYear,
            currentMonth === 0 ? 11 : currentMonth - 1
        );
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            html += `<div class="calendar__cell calendar__cell--other-month">
                <span class="calendar__cell-day">${day}</span>
            </div>`;
        }

        // Current month days
        for (let d = 1; d <= daysCount; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const classes = ['calendar__cell'];
            if (dateStr === today) classes.push('calendar__cell--today');
            if (dateStr === selectedDate) classes.push('calendar__cell--selected');

            // Dots for holidays, solar terms, and personal events
            let dotsHtml = '';
            const dots = [];
            if (typeof Holidays !== 'undefined') {
                const holidays = Holidays.getForDate(dateStr);
                if (holidays.chinese.length > 0) dots.push('<span class="dot dot--fire"></span>');
                if (holidays.us.length > 0) dots.push('<span class="dot dot--metal"></span>');
            }
            if (typeof SolarTerms !== 'undefined') {
                const term = SolarTerms.getForDate(dateStr);
                if (term) dots.push('<span class="dot dot--earth"></span>');
            }
            if (typeof Schedule !== 'undefined' && typeof Schedule.getEvents === 'function') {
                const hasPersonal = Schedule.getEvents().some(e => dateStr >= e.start_date && dateStr <= e.end_date);
                if (hasPersonal) dots.push('<span class="dot dot--wood"></span>');
            }
            if (dots.length > 0) {
                dotsHtml = `<div class="calendar__cell-dots">${dots.join('')}</div>`;
            }

            html += `<div class="${classes.join(' ')}" data-date="${dateStr}" title="${getTooltipText(dateStr)}">
                <span class="calendar__cell-day">${d}</span>
                ${dotsHtml}
            </div>`;
        }

        // Next month leading days
        const totalCells = startDay + daysCount;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let d = 1; d <= remaining; d++) {
            html += `<div class="calendar__cell calendar__cell--other-month">
                <span class="calendar__cell-day">${d}</span>
            </div>`;
        }

        grid.innerHTML = html;

        // Click handlers on cells
        grid.querySelectorAll('.calendar__cell:not(.calendar__cell--other-month)').forEach(cell => {
            cell.addEventListener('click', () => {
                selectDate(cell.dataset.date);
            });
        });
    }

    /**
     * Select a date — syncs lunisolar + agenda
     */
    function selectDate(dateStr) {
        selectedDate = dateStr;
        render();

        // Sync lunisolar calendar
        if (typeof LunisolarCalendar !== 'undefined' && LunisolarCalendar.syncToDate) {
            LunisolarCalendar.syncToDate(dateStr);
        }

        // Update agenda panel
        if (typeof Schedule !== 'undefined' && Schedule.showDate) {
            Schedule.showDate(dateStr);
        }
    }

    function bindNavigation() {
        const prevBtn = Utils.$('#greg-prev');
        const nextBtn = Utils.$('#greg-next');
        const todayBtn = Utils.$('#greg-today');
        const titleBtn = Utils.$('#greg-title');

        if (prevBtn) prevBtn.addEventListener('click', () => navigate(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => navigate(1));
        if (todayBtn) todayBtn.addEventListener('click', goToToday);

        // Jump-to-date picker: click title to show month/year selector
        if (titleBtn) titleBtn.addEventListener('click', showJumpToDate);
    }

    /**
     * Navigate prev/next month
     */
    function navigate(delta) {
        currentMonth += delta;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        render();

        // Sync lunisolar to the 15th of the new month (Option C midpoint)
        const syncDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-15`;
        if (typeof LunisolarCalendar !== 'undefined' && LunisolarCalendar.syncToDate) {
            LunisolarCalendar.syncToDate(syncDate);
        }
    }

    /**
     * Go to today
     */
    function goToToday() {
        const now = new Date();
        currentYear = now.getFullYear();
        currentMonth = now.getMonth();
        selectDate(Utils.todayISO());
    }

    /**
     * Show jump-to-date picker (month/year dropdown)
     */
    function showJumpToDate() {
        // Remove existing picker if present
        const existing = Utils.$('#jump-to-date');
        if (existing) existing.remove();

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Create dropdown
        const picker = document.createElement('div');
        picker.id = 'jump-to-date';
        picker.className = 'jump-to-date';
        picker.innerHTML = `
            <div class="jump-to-date__backdrop"></div>
            <div class="jump-to-date__popup">
                <div class="jump-to-date__row">
                    <label>Year</label>
                    <select class="jump-to-date__select" id="jump-year"></select>
                </div>
                <div class="jump-to-date__row">
                    <label>Month</label>
                    <select class="jump-to-date__select" id="jump-month"></select>
                </div>
                <div class="jump-to-date__actions">
                    <button class="jump-to-date__btn jump-to-date__btn--cancel">Cancel</button>
                    <button class="jump-to-date__btn jump-to-date__btn--go">Go</button>
                </div>
            </div>
        `;

        document.body.appendChild(picker);

        // Populate year selector (current ± 10 years)
        const yearSelect = Utils.$('#jump-year');
        for (let y = currentYear - 10; y <= currentYear + 10; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === currentYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }

        // Populate month selector
        const monthSelect = Utils.$('#jump-month');
        monthNames.forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = name;
            if (i === currentMonth) opt.selected = true;
            monthSelect.appendChild(opt);
        });

        // Event handlers
        const backdrop = picker.querySelector('.jump-to-date__backdrop');
        const cancelBtn = picker.querySelector('.jump-to-date__btn--cancel');
        const goBtn = picker.querySelector('.jump-to-date__btn--go');

        const close = () => picker.remove();
        if (backdrop) backdrop.addEventListener('click', close);
        if (cancelBtn) cancelBtn.addEventListener('click', close);
        if (goBtn) goBtn.addEventListener('click', () => {
            currentYear = parseInt(yearSelect.value);
            currentMonth = parseInt(monthSelect.value);
            render();
            const syncDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-15`;
            if (typeof LunisolarCalendar !== 'undefined' && LunisolarCalendar.syncToDate) {
                LunisolarCalendar.syncToDate(syncDate);
            }
            close();
        });
    }

    function getSelectedDate() {
        return selectedDate;
    }

    /**
     * Build tooltip text for a date (holiday names + solar term)
     */
    function getTooltipText(dateStr) {
        const parts = [];
        if (typeof Holidays !== 'undefined') {
            const h = Holidays.getForDate(dateStr);
            h.chinese.forEach(x => parts.push(x.name));
            h.us.forEach(x => parts.push(x.name));
        }
        if (typeof SolarTerms !== 'undefined') {
            const t = SolarTerms.getForDate(dateStr);
            if (t) parts.push(t.name);
        }
        return parts.join(', ');
    }

    function getCurrentYearMonth() {
        return { year: currentYear, month: currentMonth };
    }

    /**
     * Move selected date by delta days (for keyboard nav)
     */
    function moveSelection(delta) {
        const date = Utils.parseDate(selectedDate);
        date.setDate(date.getDate() + delta);
        const newDateStr = Utils.formatDateISO(date);

        // If moved to a different month, navigate there
        if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) {
            currentYear = date.getFullYear();
            currentMonth = date.getMonth();
            render();
            const syncDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-15`;
            if (typeof LunisolarCalendar !== 'undefined' && LunisolarCalendar.syncToDate) {
                LunisolarCalendar.syncToDate(syncDate);
            }
        }

        selectDate(newDateStr);
    }

    return {
        init,
        render,
        selectDate,
        navigate,
        goToToday,
        getSelectedDate,
        getCurrentYearMonth,
        moveSelection
    };
})();

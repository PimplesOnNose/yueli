/* ── lunisolar.js ───────────────────────────────────────────
 * 农历 (Lunisolar) calendar rendering + navigation
 * Uses LunarData module for conversion and lookup.
 * ─────────────────────────────────────────────────────────── */

const LunisolarCalendar = (() => {
    let selectedDate; // synced with Gregorian: 'YYYY-MM-DD'
    let viewYear;     // Gregorian year currently displayed
    let viewMonth;    // Gregorian month (0-indexed) currently displayed

    const LUNAR_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

    // Lunar day name abbreviations for compact display
    const LUNAR_DAY_SHORT = [
        '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
        '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
        '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
    ];

    // Month names for title display
    const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

    function init() {
        selectedDate = Utils.todayISO();
        const now = new Date();
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        renderWeekdays();
        syncToDate(selectedDate);
        bindNavigation();
    }

    function renderWeekdays() {
        const container = Utils.$('#lunar-weekdays');
        if (!container) return;
        container.innerHTML = LUNAR_WEEKDAYS.map(d =>
            `<span class="calendar__weekday">${d}</span>`
        ).join('');
    }

    /**
     * Sync to show the lunar month containing the given Gregorian date.
     * Option C: The lunar month containing the 15th of the displayed Gregorian month.
     */
    function syncToDate(dateStr) {
        selectedDate = dateStr;

        // Determine which Gregorian month we're viewing
        const parts = dateStr.split('-');
        viewYear = parseInt(parts[0]);
        viewMonth = parseInt(parts[1]) - 1;

        // Get the lunar data for the Gregorian date
        const lunarInfo = getLunarForDate(dateStr);

        // Update title with lunar year/month info
        renderTitle(lunarInfo);

        // Render the lunar calendar grid
        renderGrid(lunarInfo);
    }

    /**
     * Get lunar info for a Gregorian date
     */
    function getLunarForDate(dateStr) {
        if (typeof LunarData === 'undefined') return null;
        const parts = dateStr.split('-');
        return LunarData.gregorianToLunar(
            parseInt(parts[0]),
            parseInt(parts[1]),
            parseInt(parts[2])
        );
    }

    /**
     * Render the title with lunar year/month/animal info
     */
    function renderTitle(lunarInfo) {
        const title = Utils.$('#lunar-title');
        if (!title) return;

        if (lunarInfo) {
            title.textContent = `${lunarInfo.stemBranch} ${lunarInfo.animal}年`;
        } else {
            title.textContent = '农历';
        }
    }

    /**
     * Render the lunar calendar grid
     */
    function renderGrid(lunarInfo) {
        const grid = Utils.$('#lunar-grid');
        if (!grid) return;

        if (!lunarInfo) {
            grid.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Loading lunar data...</p>';
            return;
        }

        // We need to render a grid that aligns with the Gregorian grid
        // The grid shows 农历 day numbers for each day in the Gregorian month

        const daysInMonth = Utils.daysInMonth(viewYear, viewMonth);
        const startDay = Utils.firstDayOfWeek(viewYear, viewMonth);
        const today = Utils.todayISO();

        let html = '';

        // Previous month trailing days
        const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
        const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
        const prevDays = Utils.daysInMonth(prevYear, prevMonth);
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevDays - i;
            const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const lunar = getLunarForDate(dateStr);
            const lunarDay = lunar ? formatLunarDay(lunar.lunarDay) : '';
            const isStart = lunar && lunar.lunarDay === 1;

            html += `<div class="calendar__cell calendar__cell--other-month">
                <span class="calendar__cell-day">${day}</span>
                ${isStart ? '<span class="calendar__cell-lunar calendar__cell-lunar--start">' + lunar.monthName + '</span>' : '<span class="calendar__cell-lunar">' + lunarDay + '</span>'}
            </div>`;
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const lunar = getLunarForDate(dateStr);
            const lunarDay = lunar ? formatLunarDay(lunar.lunarDay) : '';
            const isStart = lunar && lunar.lunarDay === 1;

            const classes = ['calendar__cell'];
            if (dateStr === today) classes.push('calendar__cell--today');
            if (dateStr === selectedDate) classes.push('calendar__cell--selected');

            // Lunar phase for 初一 (new moon)
            let phaseHtml = '';
            if (lunar && lunar.lunarDay === 1) {
                phaseHtml = '<span class="calendar__cell-phase">🌑</span>';
            } else if (lunar && lunar.lunarDay === 15) {
                phaseHtml = '<span class="calendar__cell-phase">🌕</span>';
            }

            // Show month name on 初一
            let lunarLabel = lunarDay;
            if (isStart && lunar) {
                lunarLabel = `<span class="calendar__cell-lunar--start">${lunar.isLeap ? '闰' : ''}${lunar.monthName}</span>`;
            }

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
                <span class="calendar__cell-lunar">${lunarLabel}</span>
                ${phaseHtml}
                ${dotsHtml}
            </div>`;
        }

        // Next month leading days
        const totalCells = startDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let d = 1; d <= remaining; d++) {
            const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
            const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
            const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const lunar = getLunarForDate(dateStr);
            const lunarDay = lunar ? formatLunarDay(lunar.lunarDay) : '';
            const isStart = lunar && lunar.lunarDay === 1;

            html += `<div class="calendar__cell calendar__cell--other-month">
                <span class="calendar__cell-day">${d}</span>
                ${isStart ? '<span class="calendar__cell-lunar calendar__cell-lunar--start">' + lunar.monthName + '</span>' : '<span class="calendar__cell-lunar">' + lunarDay + '</span>'}
            </div>`;
        }

        grid.innerHTML = html;

        // Click handlers on cells
        grid.querySelectorAll('.calendar__cell:not(.calendar__cell--other-month)').forEach(cell => {
            cell.addEventListener('click', () => {
                const date = cell.dataset.date;
                if (date) selectDate(date);
            });
        });
    }

    /**
     * Format lunar day for display (compact: use 廿 for 20+, etc.)
     */
    function formatLunarDay(day) {
        return LUNAR_DAY_SHORT[Math.min(Math.max(day - 1, 0), 29)];
    }

    /**
     * Select a date and sync with Gregorian calendar
     */
    function selectDate(dateStr) {
        selectedDate = dateStr;
        syncToDate(dateStr);

        // Sync Gregorian calendar
        if (typeof GregorianCalendar !== 'undefined') {
            GregorianCalendar.selectDate(dateStr);
        }

        // Update agenda
        if (typeof Schedule !== 'undefined') {
            Schedule.showDate(dateStr);
        }
    }

    /**
     * Navigate the Gregorian view (synced navigation)
     */
    function bindNavigation() {
        const prevBtn = Utils.$('#lunar-prev');
        const nextBtn = Utils.$('#lunar-next');

        if (prevBtn) prevBtn.addEventListener('click', () => navigateLunar(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => navigateLunar(1));
    }

    /**
     * Navigate to prev/next Gregorian month (synced with Gregorian calendar)
     */
    function navigateLunar(delta) {
        // Sync with Gregorian navigation
        if (typeof GregorianCalendar !== 'undefined') {
            GregorianCalendar.navigate(delta);
        }
    }

    /**
     * Get lunar display info for a specific date (used by agenda panel)
     */
    function getLunarDisplayForDate(dateStr) {
        const lunar = getLunarForDate(dateStr);
        if (!lunar) return { lunarMonth: '', lunarDay: '', stemBranch: '', animal: '', monthName: '' };
        return {
            lunarMonth: lunar.lunarMonth,
            lunarDay: lunar.lunarDay,
            stemBranch: lunar.stemBranch,
            animal: lunar.animal,
            monthName: lunar.monthName,
            dayName: lunar.dayName
        };
    }

    /**
     * Get tooltip text for a date (holiday names + solar term)
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

    return {
        init,
        syncToDate,
        render: renderGrid,
        selectDate,
        navigateLunar,
        getLunarDisplayForDate,
        getTooltipText
    };
})();

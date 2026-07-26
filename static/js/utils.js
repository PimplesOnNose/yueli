/* ── utils.js ───────────────────────────────────────────────
 * Date helpers, formatters, DOM utilities
 * ─────────────────────────────────────────────────────────── */

const Utils = (() => {

    /**
     * Format a date as 'YYYY-MM-DD'
     */
    function formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Parse 'YYYY-MM-DD' into a Date (local time, no timezone shift)
     */
    function parseDate(str) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    /**
     * Get today as 'YYYY-MM-DD'
     */
    function todayISO() {
        return formatDateISO(new Date());
    }

    /**
     * Format date for display: "June 14, 2025"
     */
    function formatDateDisplay(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Get the number of days in a given month
     */
    function daysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    /**
     * Get the weekday of the first day of a month (0 = Sunday)
     */
    function firstDayOfWeek(year, month) {
        return new Date(year, month, 1).getDay();
    }

    /**
     * Nth weekday of a month (e.g. 3rd Monday of January)
     * weekday: 0=Sun, 1=Mon, ..., 6=Sat
     * n: 1-based (1st, 2nd, 3rd, etc.)
     */
    function nthWeekdayOfMonth(year, month, weekday, n) {
        const first = new Date(year, month, 1);
        const firstWeekday = first.getDay();
        let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
        if (day > daysInMonth(year, month)) return null;
        return new Date(year, month, day);
    }

    /**
     * Last weekday of a month
     */
    function lastWeekdayOfMonth(year, month, weekday) {
        const last = new Date(year, month + 1, 0); // last day of month
        const lastWeekday = last.getDay();
        let day = last.getDate() - ((lastWeekday - weekday + 7) % 7);
        return new Date(year, month, day);
    }

    /**
     * Simple DOM helper
     */
    function $(selector) {
        return document.querySelector(selector);
    }

    function $$(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * Debounce
     */
    function debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    return {
        formatDateISO,
        parseDate,
        todayISO,
        formatDateDisplay,
        daysInMonth,
        firstDayOfWeek,
        nthWeekdayOfMonth,
        lastWeekdayOfMonth,
        $,
        $$,
        debounce
    };
})();

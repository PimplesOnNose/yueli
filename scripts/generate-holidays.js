/**
 * generate-holidays.js
 *
 * Generates Chinese + US holiday data for 1960–2060.
 * Chinese holidays are computed from lunar dates using LunarData.
 * US holidays use fixed dates and rule-based computation.
 *
 * Usage: node scripts/generate-holidays.js
 * Output: static/js/holidays.js
 */

const fs = require('fs');
const path = require('path');

// ── Load Lunar Data ──────────────────────────────────────────
const lunarCode = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'lunar-data.js'), 'utf8');
const modifiedLunar = lunarCode.replace('const LunarData', 'var LunarData');
eval(modifiedLunar);

// ── Date Helpers ─────────────────────────────────────────────
function toJD(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
           Math.floor(yy / 4) - Math.floor(yy / 100) +
           Math.floor(yy / 400) - 32045;
}

function fromJD(jd) {
    const a = jd + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor(146097 * b / 4);
    const d = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor(1461 * d / 4);
    const m = Math.floor((5 * e + 2) / 153);
    const day = e - Math.floor((153 * m + 2) / 5) + 1;
    const month = m + 3 - 12 * Math.floor(m / 10);
    const year = 100 * b + d - 4800 + Math.floor(m / 10);
    return { year, month, day };
}

function formatDate(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ── Nth Weekday of Month ─────────────────────────────────────
function nthWeekdayOfMonth(year, month, weekday, n) {
    const first = new Date(year, month - 1, 1);
    const firstWeekday = first.getDay();
    let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return null;
    return day;
}

function lastWeekdayOfMonth(year, month, weekday) {
    const last = new Date(year, month, 0);
    const lastWeekday = last.getDay();
    return last.getDate() - ((lastWeekday - weekday + 7) % 7);
}

// ── Chinese Holidays (computed from lunar dates) ─────────────
function getChineseHolidays(year) {
    const holidays = [];

    // Spring Festival (正月初一)
    const sf = LunarData.getYear(year);
    if (sf && sf.springFestival) {
        holidays.push({
            id: 'spring_festival',
            name: '春节',
            nameEn: 'Spring Festival',
            date: sf.springFestival,
            lunar: '正月初一'
        });
    }

    // Lantern Festival (正月十五)
    const lantern = getLunarDateForDay(year, 1, 15);
    if (lantern) {
        holidays.push({
            id: 'lantern_festival',
            name: '元宵节',
            nameEn: 'Lantern Festival',
            date: lantern,
            lunar: '正月十五'
        });
    }

    // Qingming (清明节) — solar term, fixed around April 4-6
    holidays.push({
        id: 'qingming',
        name: '清明节',
        nameEn: 'Qingming Festival',
        date: `${year}-04-05`, // Approximate, ±1 day
        solar_term: true
    });

    // Dragon Boat (五月初五)
    const dragon = getLunarDateForDay(year, 5, 5);
    if (dragon) {
        holidays.push({
            id: 'dragon_boat',
            name: '端午节',
            nameEn: 'Dragon Boat Festival',
            date: dragon,
            lunar: '五月初五'
        });
    }

    // Mid-Autumn (八月十五)
    const midAutumn = getLunarDateForDay(year, 8, 15);
    if (midAutumn) {
        holidays.push({
            id: 'mid_autumn',
            name: '中秋节',
            nameEn: 'Mid-Autumn Festival',
            date: midAutumn,
            lunar: '八月十五'
        });
    }

    // Double Ninth (九月初九)
    const doubleNinth = getLunarDateForDay(year, 9, 9);
    if (doubleNinth) {
        holidays.push({
            id: 'double_ninth',
            name: '重阳节',
            nameEn: 'Double Ninth Festival',
            date: doubleNinth,
            lunar: '九月初九'
        });
    }

    // Winter Solstice (冬至) — solar term, fixed around Dec 21-23
    holidays.push({
        id: 'winter_solstice',
        name: '冬至',
        nameEn: 'Winter Solstice',
        date: `${year}-12-22`, // Approximate, ±1 day
        solar_term: true
    });

    return holidays;
}

/**
 * Find the Gregorian date of a specific lunar day in a lunar month.
 * e.g., getLunarDateForDay(2025, 5, 5) = 端午节
 */
function getLunarDateForDay(year, lunarMonth, lunarDay) {
    const yearData = LunarData.getYear(year);
    if (!yearData || !yearData.springFestival) return null;

    const sfParts = yearData.springFestival.split('-');
    const sfJD = toJD(parseInt(sfParts[0]), parseInt(sfParts[1]), parseInt(sfParts[2]));

    // Count days to the target lunar day
    let targetDayOffset = 0;
    for (let i = 0; i < yearData.months.length; i++) {
        if (i + 1 === lunarMonth) {
            targetDayOffset += (lunarDay - 1);
            break;
        }
        targetDayOffset += yearData.months[i];

        // Handle leap month
        if (yearData.leapMonth > 0 && i + 1 === yearData.leapMonth) {
            targetDayOffset += yearData.months[i]; // Skip leap month
        }
    }

    const targetJD = sfJD + targetDayOffset;
    const date = fromJD(targetJD);
    return formatDate(date.year, date.month, date.day);
}

// ── US Holidays ──────────────────────────────────────────────
function getUSHolidays(year) {
    const holidays = [];

    // Fixed-date holidays
    holidays.push({ id: 'new_years_day', name: "New Year's Day", date: formatDate(year, 1, 1), type: 'federal' });
    holidays.push({ id: 'juneteenth', name: 'Juneteenth', date: formatDate(year, 6, 19), type: 'federal' });
    holidays.push({ id: 'independence_day', name: 'Independence Day', date: formatDate(year, 7, 4), type: 'federal' });
    holidays.push({ id: 'veterans_day', name: 'Veterans Day', date: formatDate(year, 11, 11), type: 'federal' });
    holidays.push({ id: 'christmas', name: 'Christmas', date: formatDate(year, 12, 25), type: 'federal' });

    // Rule-based holidays
    const mlkDay = nthWeekdayOfMonth(year, 1, 1, 3); // 3rd Monday of January
    if (mlkDay) holidays.push({ id: 'mlk_day', name: 'MLK Jr. Day', date: formatDate(year, 1, mlkDay), type: 'federal' });

    const presidentsDay = nthWeekdayOfMonth(year, 2, 1, 3); // 3rd Monday of February
    if (presidentsDay) holidays.push({ id: 'presidents_day', name: "Presidents' Day", date: formatDate(year, 2, presidentsDay), type: 'federal' });

    const memorialDay = lastWeekdayOfMonth(year, 5, 1); // Last Monday of May
    holidays.push({ id: 'memorial_day', name: 'Memorial Day', date: formatDate(year, 5, memorialDay), type: 'federal' });

    const laborDay = nthWeekdayOfMonth(year, 9, 1, 1); // 1st Monday of September
    if (laborDay) holidays.push({ id: 'labor_day', name: 'Labor Day', date: formatDate(year, 9, laborDay), type: 'federal' });

    const columbusDay = nthWeekdayOfMonth(year, 10, 1, 2); // 2nd Monday of October
    if (columbusDay) holidays.push({ id: 'columbus_day', name: 'Columbus Day', date: formatDate(year, 10, columbusDay), type: 'federal' });

    const thanksgiving = nthWeekdayOfMonth(year, 11, 4, 4); // 4th Thursday of November
    if (thanksgiving) {
        holidays.push({ id: 'thanksgiving', name: 'Thanksgiving', date: formatDate(year, 11, thanksgiving), type: 'federal' });
        // Black Friday — day after Thanksgiving
        holidays.push({ id: 'black_friday', name: 'Black Friday', date: formatDate(year, 11, thanksgiving + 1), type: 'observance' });
    }

    // Common observances
    holidays.push({ id: 'valentines_day', name: "Valentine's Day", date: formatDate(year, 2, 14), type: 'observance' });
    holidays.push({ id: 'st_patricks_day', name: "St. Patrick's Day", date: formatDate(year, 3, 17), type: 'observance' });
    holidays.push({ id: 'april_fools', name: "April Fools' Day", date: formatDate(year, 4, 1), type: 'observance' });

    const mothersDay = nthWeekdayOfMonth(year, 5, 0, 2); // 2nd Sunday of May
    if (mothersDay) holidays.push({ id: 'mothers_day', name: "Mother's Day", date: formatDate(year, 5, mothersDay), type: 'observance' });

    const fathersDay = nthWeekdayOfMonth(year, 6, 0, 3); // 3rd Sunday of June
    if (fathersDay) holidays.push({ id: 'fathers_day', name: "Father's Day", date: formatDate(year, 6, fathersDay), type: 'observance' });

    holidays.push({ id: 'halloween', name: 'Halloween', date: formatDate(year, 10, 31), type: 'observance' });
    holidays.push({ id: 'new_years_eve', name: "New Year's Eve", date: formatDate(year, 12, 31), type: 'observance' });

    return holidays;
}

// ── Main ─────────────────────────────────────────────────────
function main() {
    const START_YEAR = 1960;
    const END_YEAR = 2060;

    console.log(`Generating holiday data for ${START_YEAR}–${END_YEAR}...`);

    const data = {};

    for (let year = START_YEAR; year <= END_YEAR; year++) {
        const sf = LunarData.getYear(year);
        const springFestival = sf ? sf.springFestival : null;

        data[year] = {
            springFestival,
            chinese: getChineseHolidays(year),
            us: getUSHolidays(year)
        };

        if ((year - START_YEAR) % 10 === 0) {
            console.log(`  ${year}: ${data[year].chinese.length} Chinese, ${data[year].us.length} US holidays`);
        }
    }

    // Generate JS output
    const jsContent = `/* ── holidays.js ────────────────────────────────────────────
 * Chinese + US holiday data for ${START_YEAR}–${END_YEAR}
 * Generated by scripts/generate-holidays.js
 * Chinese holidays computed from lunar dates using LunarData.
 * US holidays use fixed dates and rule-based computation.
 * ─────────────────────────────────────────────────────────── */

const Holidays = (() => {
    const DATA = ${JSON.stringify(data, null, 2)};

    function getYear(year) {
        return DATA[year] || { springFestival: null, chinese: [], us: [] };
    }

    function getForDate(dateStr) {
        const year = parseInt(dateStr.split('-')[0], 10);
        const yearData = getYear(year);
        return {
            chinese: yearData.chinese.filter(h => h.date === dateStr),
            us: yearData.us.filter(h => h.date === dateStr)
        };
    }

    function getSpringFestival(year) {
        const yearData = getYear(year);
        return yearData.springFestival;
    }

    return { DATA, getYear, getForDate, getSpringFestival };
})();
`;

    const outputPath = path.join(__dirname, '..', 'static', 'js', 'holidays.js');
    fs.writeFileSync(outputPath, jsContent);
    console.log(`\nWrote ${Object.keys(data).length} years to ${outputPath}`);
    console.log('File size:', (fs.statSync(outputPath).size / 1024).toFixed(1), 'KB');

    // Verify a few dates
    console.log('\nVerifying:');
    const verifyDates = [
        '2025-01-29', // Spring Festival 2025
        '2025-05-31', // Dragon Boat 2025
        '2025-10-06', // Mid-Autumn 2025
        '2025-07-04', // Independence Day
        '2025-11-27', // Thanksgiving 2025
    ];
    for (const d of verifyDates) {
        const year = parseInt(d.split('-')[0], 10);
        const yearData = data[year];
        if (!yearData) { console.log(`  ${d}: no data`); continue; }
        const chinese = yearData.chinese.filter(h => h.date === d);
        const us = yearData.us.filter(h => h.date === d);
        const names = [...chinese.map(h => h.name), ...us.map(h => h.name)];
        console.log(`  ${d}: ${names.join(', ') || 'none'}`);
    }
}

let data = {};

main();

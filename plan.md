# 月历 · Yueli — Dual Calendar Application

> *Heavenly Harmony (天和)* — A personal calendar that unites the Gregorian and Chinese Lunisolar calendars, wrapped in traditional Chinese design philosophy.

---

## 1. Vision

**Yueli** (月历, "moon calendar") is a personal, encrypted web calendar that displays both the Roman (Gregorian) calendar and the Chinese Lunisolar calendar (农历) side by side with equal prominence. Holidays and special dates are color-coded according to the Wu Xing (五行) Five Elements system — each category of event mapped to an element with its corresponding color. Personal events are encrypted client-side, with optional browser-based reminders for appointments.

The aesthetic draws on the Qinglu (青绿) design tradition — atmospheric, dark-themed, with jade and azure accents — prioritizing readability while honoring traditional Chinese color philosophy.

---

## 2. Design Philosophy

### Core Principles

| Principle | Application |
|-----------|-------------|
| **Wu Xing (五行)** | Color system maps to Five Elements — each data type gets an element |
| **Yin-Yang (阴阳)** | Dark theme base (Yin) with luminous accents (Yang) — Qinglu aesthetic |
| **Feng Shui (风水)** | Symmetrical dual-calendar layout, clear energy flow, uncluttered |
| **Readability First** | Calendar grids stay clean; atmosphere lives in header, panel, transitions |

### Color System — Wu Xing Mapping

| Category | Element | Color(s) | Rationale |
|----------|---------|----------|-----------|
| **Chinese Holidays** | Fire (火) | Red `#d4380d` / Gold `#d4a017` | Celebration, fortune — culturally authentic |
| **US Holidays** | Metal (金) | Silver-Blue `#8faacc` / White `#e8e8e8` | Clarity, precision — distinct from red |
| **Personal Events** | Wood (木) | Jade Green `#4a9e8a` | Growth, vitality — your life unfolding |
| **Reminders / Alerts** | Water (水) | Azure `#5a8e9e` | Depth, attention — draws the eye inward |
| **Lunar Phase Markers** | Earth (土) | Muted Gold `#c9a96e` | Stability, celestial grounding |

### Cultural Sensitivities

- **Red is reserved for Chinese celebratory dates only** — never for personal names or mundane items (respecting the imperial taboo on red ink).
- **No green headwear imagery** in any context.
- **White** used only as background / negative space, never as a dominant celebration color.
- **Gold** used as accent, muted and sparing — not large blocks of bright yellow.

### Typography

- **Headers / Display:** `Noto Serif SC` — classical feel
- **Body / UI / Dates:** `Noto Sans SC` — clean readability
- **Day numbers:** Tabular figures for grid alignment
- **Bilingual labels:** Chinese characters paired with English where natural

### Visual Atmosphere — Path B (Atmospheric + Seasonal Botanical Whisper)

> **North star:** When the user looks at the calendar, they should feel the season — not see a picture of it.

The app achieves visual beauty through color, type, spacing, and motion — not through illustration. One subtle seasonal botanical marker in the header provides the seasonal connection without competing with content. This is atmosphere, not decoration.

#### Yueli Wordmark

The header wordmark provides brand identity:

- 月历 in `Noto Serif SC`, weight 600, jade or muted gold
- Small jade dot (·) as the moon accent, ~6px
- *yueli* below or beside in `Noto Sans SC`, weight 300, secondary color

The wordmark lives in the header, persistent across all views. It's refined type, not illustration.

#### Seasonal Botanical Markers (四时花信 — Four Seasonal Whispers)

Four SVG botanical illustrations, each paired with a seasonal *pivot 节气*. Each lives in the top-right of the calendar header at ~30% opacity — a whisper, not a shout. Changes only four times per year; each shift is a seasonal event the user feels without being told.

| Season | Pivot 节气 | Botanical | Tone | Transition Window |
|--------|-----------|-----------|------|-------------------|
| **Spring** | 立春 (early Feb) | Plum blossom (梅花) — single branch, 2-3 blossoms | Warm jade | Feb 3–10 |
| **Summer** | 立夏 (early May) | Lotus leaf (荷叶) — silhouette, no flower | Cool green | May 5–12 |
| **Autumn** | 立秋 (early Aug) | Chrysanthemum (菊花) — single bloom, abstracted | Muted gold | Aug 7–14 |
| **Winter** | 立冬 (early Nov) | Pine branch (松枝) — bare, with needles | Cool blue | Nov 7–14 |

**Why these four:**
- **Plum blossom** — first flower of spring, resilience (岁寒三友), culturally significant
- **Lotus leaf** — purity (出淤泥而不染), the defining image of summer
- **Chrysanthemum** — autumn's flower, longevity (九九重阳), paired with Mid-Autumn
- **Pine branch** — winter endurance, steadfastness (岁寒三友), the tree that stays green

**What they are NOT:** They are not stock motifs. They are botanical, not symbolic. No dragons, no phoenixes, no clouds. One branch, one bloom, one silhouette. Sparse. Contemplative.

#### Seasonal Color Temperature Shift

When a seasonal pivot 节气 arrives, three things change in concert:

1. **Botanical swap** — the header SVG cross-fades from one to the next over ~1 week
2. **Background temperature shift** — `--bg-deep` warms or cools subtly:
   - Spring/Summer: slightly warmer undertone (hint of green-blue)
   - Autumn/Winter: slightly cooler undertone (hint of blue-grey)
3. **Accent hue micro-shift** — the jade accent nudges warmer or cooler (±2° hue)

The shift is so subtle the user notices the *season* before they notice the *change*. That's the goal.

#### What Is NOT Illustrated

These elements stay as pure typography / color / glyph — no illustration:
- Calendar cells — numbers + dots only, zero decoration
- Holiday markers — colored dots/badges, not festive imagery
- Lunar phase markers — unicode glyphs (🌑🌒), not illustrations
- Daily Wisdom card — the characters themselves are the art; no watercolor wash, no backdrop illustration
- Agenda panel — clean list, no imagery
- Section dividers — whitespace, not cloud patterns (云纹)
- Festive imagery — no Santa, no lanterns, no red envelopes. Abstract dots only.

---

## 3. Technical Stack

Matching the `journal-app` pattern (proven in your environment):

| Layer | Technology |
|-------|-----------|
| **Server** | Node.js + Express |
| **Database** | sql.js (SQLite compiled to WebAssembly) |
| **Encryption** | Web Crypto API (client-side, AES-256-GCM) |
| **Encryption scope** | Each event stored as a single encrypted blob |
| **Frontend** | Vanilla HTML / CSS / JavaScript (no framework) |
| **Styling** | Qinglu design system as foundation, Wu Xing tokens layered |
| **Notifications** | Browser Notification API |
| **Backup format** | Encrypted `.db` file (password-protected) |

---

## 4. Layout & Structure

### Main Layout

```
┌──────────────────────────────────────────────────────────┐
│  [☰]  月历 · yueli                         [🔔] [🔒] [⚙] │
│                      🌸 ← seasonal botanical (30% opacity) │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────┐  ┌────────────────────┐          │
│  │   GREGORIAN        │  │   农历 LUNISOLAR   │          │
│  │   June 2025        │  │   乙巳年 五月      │          │
│  │                    │  │                    │          │
│  │  Su Mo Tu We Th Fr Sa │ 初一 初二 初三 ... │          │
│  │   1  2  3  4  5  6  7 │  🌑   🌒           │          │
│  │   8  9 10 11 12 13 14 │  ...               │          │
│  │  ...                  │                    │          │
│  │  [🔴端午] [🔵父亲节]  │  [节气: 芒种]      │          │
│  └────────────────────┘  └────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  📅 June 14, 2025 — 五月十九               │          │
│  │  ┌────────────────────────────────────┐    │          │
│  │  │ 🟢 10:00  Dentist appointment      │    │          │
│  │  │ 🔵 --     Flag Day                 │    │          │
│  │  │ 🔴 --     端午节 (Dragon Boat)     │    │          │
│  │  └────────────────────────────────────┘    │          │
│  │  [+ Add Event]                             │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  📜 每日格言 · Daily Wisdom   [⟳] [More →] │          │
│  │              白驹过隙                        │          │
│  │            bái jū guò xì                    │          │
│  │       White colt passes crack.              │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  LEGEND:  🔴 Chinese  🔵 US  🟢 Personal  🟡 Lunar      │
└──────────────────────────────────────────────────────────┘
```

**Key visual notes:**
- The **wordmark** (月历 · yueli) is left-aligned in the header — refined type, not illustration
- The **seasonal botanical** (🌸/🍃/🌼/🌲) appears top-right of the header at 30% opacity — a whisper, not a shout
- **Calendar cells** are clean — numbers + colored dots only, zero decoration
- The **Daily Wisdom card** sits below the agenda panel — the characters are the art
- The overall feel is **atmospheric**: dark deep-night background, jade accents, generous whitespace

### Layout Principles

- **Dual prominence** — Both calendars are equal-sized, side-by-side on desktop, stacked on mobile. Neither is "primary" — Yin-Yang balance.
- **Readability first** — Calendar grids stay clean. Atmosphere lives in header (wordmark + botanical), agenda panel, transitions, and seasonal color shifts.
- **Color dots, not floods** — Holidays and events shown as small colored dots/badges on cells, not background fills. The grid stays legible.
- **Atmospheric calm** — "When the user looks at the calendar, they should feel the season — not see a picture of it." Seasonal shifts are felt through color temperature, botanical whisper, and motion, not through illustration.
- **Content is the art** — Four characters (成语) on a calm background are more beautiful than any illustration. The idiom, the lunar date, the holiday names — these are the aesthetic content. Illustration serves them, not the reverse.

### Responsive Strategy

- **Desktop (>1024px):** Side-by-side calendars, agenda below
- **Tablet (768–1024px):** Side-by-side calendars, condensed agenda
- **Mobile (<768px):** Stacked calendars, agenda collapses to tab

---

## 5. Navigation Sync

The two calendars don't line up month-to-month (Gregorian months have fixed boundaries; lunar months start mid-Gregorian-month). We use **Hybrid navigation (Option C)**:

- **Primary navigation** is Gregorian (familiar to all users). Clicking prev/next shifts the Gregorian month.
- **Lunisolar view** shows the lunar month that *contains the 15th of the displayed Gregorian month* — a stable midpoint that ensures one dominant lunar month is shown.
- **Clicking any date in either calendar** selects that specific day and syncs both calendars to show it.
- **Edge case:** If the selected Gregorian month spans two lunar months, the lunisolar grid shows the dominant month, with a small "see also" indicator if the cell falls in the adjacent lunar month.

This is the standard approach for dual-calendar apps — predictable and intuitive.

---

## 6. Feature Scope

### Core Features

1. **Dual calendar display** — Gregorian and 农历, both prominent
2. **Lunar phase glyphs** — On the lunisolar calendar (🌑🌒🌓🌔🌕🌖🌗🌘)
3. **24 Solar Terms (节气)** — Calculated and marked on the lunisolar calendar
4. **Holidays** — Chinese (7 major) + US (11 federal + 8 common observances)
5. **Personal events** — Encrypted, add/edit/delete. Supports **timed**, **all-day**, and **multi-day** events.
6. **Daily agenda panel** — Selected date's events + holidays, with timed/all-day/multi-day sections rendered distinctly
7. **Reminders** — Browser notifications, client-side only (fires while app is open)
8. **Encryption** — Master password, AES-256-GCM, single encrypted blob per event
10. **Auto-lock** — 15-minute inactivity timeout. While locked, calendar shows **presence dots** (count only) — encrypted content remains hidden until unlocked.
11. **Export / Import** — Encrypted `.db` file backup and restore
12. **Responsive** — Mobile-friendly stacked layout
13. **Seasonal atmosphere** — Four-season color temperature shifts (background warms/cools subtly on pivot 节气: 立春/立夏/立秋/立冬) + seasonal botanical whisper in header (plum blossom/lotus leaf/chrysanthemum/pine branch, 30% opacity, cross-fade transition over ~1 week). North star: "When the user looks at the calendar, they should feel the season — not see a picture of it."
14. **Daily Wisdom (每日格言)** — Weighted-random Chinese idiom of the day with pinyin, English meaning, and one example sentence; auto-cycles through all 100 before repeating
15. **Navigation aids** — "Today" button, jump-to-month / year picker, prev/next month arrows
16. **Search & filter**** — Search encrypted event titles client-side (post-decrypt); filter by category (v1 ships with personal-only category, free-text blob supports more)
17. **Keyboard navigation** — Arrow keys to move selected date, Home = today, N = new event

### Reminders Configuration

- **Default reminder:** 1 hour before **AND** at time of event (two notifications)
- **Customizable per event** — Options: none, 5 min, 15 min, 30 min, 1 hr, 1 day, at time, or custom combination
- **Client-side only** — Reminder engine runs in the browser; notifications only fire while the app is open
- **Snooze** — 5 min / 10 min / 1 hr options when a notification fires
- **Visual indicator** — Pulsing azure dot on upcoming events with reminders

---

## 7. Holiday Data

### Chinese Holidays (7 major, computed from lunar dates)

| Holiday | Chinese | 农历 Date | Gregorian (approx) |
|---------|---------|-----------|-------------------|
| Spring Festival | 春节 | 正月初一 | Jan / Feb |
| Lantern Festival | 元宵节 | 正月十五 | Feb |
| Qingming Festival | 清明节 | Solar term | Apr 4–6 |
| Dragon Boat Festival | 端午节 | 五月初五 | Jun |
| Mid-Autumn Festival | 中秋节 | 八月十五 | Sep / Oct |
| Double Ninth Festival | 重阳节 | 九月初九 | Oct |
| Winter Solstice | 冬至 | Solar term | Dec 21–23 |

### US Holidays (11 federal + 8 common observances)

**Federal (11):**

| Holiday | Date |
|---------|------|
| New Year's Day | Jan 1 |
| MLK Jr. Day | 3rd Monday of January |
| Presidents' Day | 3rd Monday of February |
| Memorial Day | Last Monday of May |
| Juneteenth | Jun 19 |
| Independence Day | Jul 4 |
| Labor Day | 1st Monday of September |
| Columbus Day | 2nd Monday of October |
| Veterans Day | Nov 11 |
| Thanksgiving | 4th Thursday of November |
| Christmas | Dec 25 |

**Common Observances (8):**

| Holiday | Date |
|---------|------|
| Valentine's Day | Feb 14 |
| St. Patrick's Day | Mar 17 |
| April Fools' Day | Apr 1 |
| Mother's Day | 2nd Sunday of May |
| Father's Day | 3rd Sunday of June |
| Halloween | Oct 31 |
| Black Friday | Day after Thanksgiving |
| New Year's Eve | Dec 31 |

### Color Encoding

- 🔴 **Red / Gold** — Chinese holidays (Fire element)
- 🔵 **Silver-Blue** — US holidays (Metal element)
- 🟡 **Muted gold** — 24 Solar Terms (Earth element)
- 🟢 **Jade green** — Personal events (Wood element)
- 🌌 **Azure pulse** — Reminders (Water element)

---

## 8. Daily Wisdom (每日格言)

A daily displayed Chinese idiom (成语) with weighted random selection. The feature cycles through all 100 idioms before any repeat, weighting unseen idioms more heavily until the pool is exhausted, then resets and restarts. Stored in `localStorage` (not the encrypted database — the data is not sensitive and is sourced from a public file).

### Data Source

- **File:** `static/data/idioms.json` (copied into the yueli project from `/home/ai/Projects/zishuo/public/data/idioms_enriched.json`)
- **Count:** 100 entries
- **Self-contained:** The yueli project does not depend on the zishuo directory at runtime

Each idiom record contains:

```json
{
  "id": 0,
  "idiom": "白驹过隙",
  "pinyin": "bái jū guò xì",
  "meaning": "White colt passes crack.",
  "explanation": "Life's brevity - time flashes like a horse glimpsed through a wall crack.",
  "examples": [
    { "zh": "...", "pinyin": "...", "en": "..." }
  ],
  "english_similar": [ { "idiom": "...", "source": "..." } ]
}
```

### Display Fields (visible by default)

| Field | Source | Treatment |
|-------|---------|------------|
| **Idiom** | `idiom` | Large, centered, Noto Serif SC — the focal point |
| **Pinyin** | `pinyin` | Italic, secondary color, below the idiom |
| **English meaning** | `meaning` | The short concise translation |
| **Example sentence** | `examples[0]` (zh, pinyin, en) | One example — Chinese, pinyin, English |

### Expandable Fields (revealed on click)

- **Explanation** (`explanation`) — longer-form gloss of the idiom's metaphor
- **English similar** (`english_similar`) — Western proverbs/idioms with similar sentiment

These extras are hidden under a "More →" toggle to keep the daily card calm and focused by default.

### Weighted Random Algorithm

```
weights[id] = (id in shownList) ? 0 : 1

if all weights == 0:           # every idiom has been shown
    clear shownList            # reset weights
    weights[id] = 1 for all id

pick = random choice weighted by weights[]
shownList.push(pick)
currentId = pick
lastShownDate = today
```

- **One new idiom per calendar day** — chosen when the app detects a date change
- **Stable within a day** — re-opening the app on the same day shows the same idiom
- **Pool exhaustion** — when all 100 have been shown, the shown list clears and the cycle restarts
- **Manual swap button** — a small "shuffle" action lets the user pull a different idiom that day; the displaced idiom counts as shown, the new pick also joins `shownList`

### Audio Playback

Each idiom has pre-recorded MP3 audio files:
- **Idiom pronunciation:** `/static/audio/idioms/{idiom}.mp3`
- **Example sentence 1:** `/static/audio/examples/{idiom}_ex1.mp3`
- **Example sentence 2:** `/static/audio/examples/{idiom}_ex2.mp3`

**Playback UI:** Three buttons below the example text:
- 「Idiom」 — plays the idiom pronunciation
- 「Example 1」 — plays the first example sentence
- 「Example 2」 — plays the second example sentence

**Audio elements:** Created dynamically on idiom render, cleaned up on swap. Each button calls `Audio.play()` from the start. Buttons are disabled if the audio file 404s.

**File counts:** 100 idiom MP3s + 200 example MP3s (2 per idiom), copied from `/home/ai/Projects/zishuo/public/audio/` and `example_audio/`.

### Persistence

Stored in `localStorage` (not the encrypted database — wisdom data is not personal/sensitive):

```javascript
{
  shownList: [0, 12, 47, "..."],  // array of idiom ids already shown this cycle
  lastShownDate: "2025-06-14",    // ISO date — used to detect day rollover
  currentId: 12                  // today's displayed idiom id
}
```

### Selection Flow (on app open or midnight rollover)

1. Read `wisdom` object from `localStorage`
2. If `lastShownDate === today` → render `currentId` again (no new pick)
3. If `lastShownDate !== today` (new day):
   - If `shownList.length >= 100` → clear `shownList` (new cycle)
   - Compute weights: `1` for unseen, `0` for seen
   - Weighted-random pick → new `currentId`
   - Append to `shownList`, update `lastShownDate`, save
4. Render the selected idiom

### Visual Design

- **Earth element colors** (🟡 Earth / 土) — muted gold `#c9a96e` — wisdom, stability, grounding
- **Parchment-card feel** — subtle jade border, gold title, atmospheric background
- **Placement** — below the daily agenda panel (reads as a daily reflection, natural reading flow)
- **Animation** — gentle fade-in on render (`ql-reveal`)
- **Typography:**
  - Idiom: `Noto Serif SC`, bold, large
  - Pinyin: `Noto Sans SC`, italic, muted
  - English: `Noto Sans SC`, regular

### Layout Integration

```
┌──────────────────────────────────────────────┐
│  📅 Daily Agenda (events + holidays)          │
│  ┌────────────────────────────────────────┐  │
│  │ 🟢 10:00  Dentist appointment         │  │
│  │ 🔵 --     Flag Day                    │  │
│  │ 🔴 --     端午节 (Dragon Boat)         │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  📜 每日格言 · Daily Wisdom   [⟳] [More →]   │
│                                               │
│              白驹过隙                          │
│            bái jū guò xì                      │
│       White colt passes crack.                │
│                                               │
│  人生百年如白驹过隙，青春时光尤其珍贵， 	  │
│  不可虚度。                                    │
│  Rénshēng bǎi nián rú bái jū guò xì...        │
│  A hundred years of life flash by like a      │
│  white colt through a crack — youth is        │
│  especially precious.                         │
└──────────────────────────────────────────────┘
```

---

## 9. Lunar Engine

The 农历 calculation is pre-computed as a lookup table for **1960–2060** (100 years). Runtime calculation of lunar months is notoriously complex (leap months, varying month lengths, stems/branches cycles), so a lookup table is more reliable and accurate.

### Data Structure

For each year (1960–2060):
- Lunar month lengths (29 or 30 days each)
- Leap month position (if any)
- Year stem / branch (天干地支 — 60-year cycle)
- Animal year (生肖 — 12-year cycle)

### 24 Solar Terms

Solar terms are astronomical events — moments when the sun reaches specific ecliptic longitudes. For 1960–2060, these can be pre-computed to second precision and stored as timestamps, or calculated using a formula with sufficient accuracy (most fall within minutes of the "official" times).

---

## 10. Encryption Design

### Approach

Each personal event is stored as a **single encrypted blob** (not field-by-field). This is cleaner and has a smaller attack surface than journal-app's field-level encryption.

### Schema

```sql
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    start_date TEXT NOT NULL,           -- 'YYYY-MM-DD' (Gregorian, unencrypted for range query)
    end_date TEXT NOT NULL,            -- 'YYYY-MM-DD' (Gregorian; equals start_date for single-day events)
    is_all_day INTEGER DEFAULT 0,      -- 1 = all-day event, 0 = timed (unencrypted — affects rendering, not personal content)
    has_reminder INTEGER DEFAULT 0,    -- presence flag only (unencrypted — needed to render reminder dot when locked)
    reminder_at TEXT,                   -- ISO 8601 timestamp (unencrypted for reminder timing; null if no reminder)
    encrypted_blob TEXT NOT NULL,       -- AES-256-GCM: title + description + time + category + reminder configuration
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_date_range ON events(start_date, end_date);

CREATE TABLE crypto_meta (
    id INTEGER PRIMARY KEY,
    salt TEXT NOT NULL,                 -- base64 PBKDF2 salt
    test_payload TEXT NOT NULL          -- encrypted test string to verify password
);
```

### What's Encrypted vs. Not

| Field | Encrypted? | Why |
|-------|------------|-----|
| Event title | ✅ Encrypted | Sensitive |
| Event description | ✅ Encrypted | Sensitive |
| Event time (HH:MM) | ✅ Encrypted | Sensitive (for timed events) |
| Category | ✅ Encrypted | Sensitive |
| Reminder configuration (offset, mode) | ✅ Encrypted | Sensitive |
| Start date (YYYY-MM-DD) | ❌ Unencrypted | Needed for calendar range queries |
| End date (YYYY-MM-DD) | ❌ Unencrypted | Needed for multi-day range queries |
| `is_all_day` flag | ❌ Unencrypted | Affects rendering only, not personal content |
| Whether event has a reminder | ❌ Unencrypted (`has_reminder` flag) | Needed to render reminder dot when locked |
| Reminder fire timestamp | ❌ Unencrypted (`reminder_at`) | Client-side engine checks this |

### Tradeoff

This leaks the *date* and *reminder timing* (number of reminders, when they fire) but not the content. Since reminders fire client-side only (the browser tab must be open), the `reminder_at` field is needed by the client-side engine to know when to fire — and encrypting it would prevent the check loop from running.

This is an acceptable tradeoff for a personal calendar: an attacker with the `.db` file would see *when* you have appointments, but not *what* they are.

### Encryption Flow

```
┌─────────────────────────────────────────────────────────┐
│  CLIENT (Browser)                                        │
│                                                          │
│  1. User enters master password                          │
│  2. PBKDF2(password + salt, 100k iterations) → 256-bit key │
│  3. Generate random IV for each encryption               │
│  4. Encrypt event payload (title, desc, time, etc.)      │
│  5. Send { date, reminder_at, encrypted_blob, iv } to server │
│                                                          │
│  On unlock:                                              │
│  6. Verify password by decrypting test_payload          │
│  7. Decrypt all event blobs in memory                    │
│  8. Clear key on lock / auto-lock timeout               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  SERVER (Node.js)                                        │
│                                                          │
│  - Stores encrypted blobs as-is (never sees plaintext)   │
│  - Serves encrypted data back                            │
│  - Saves .db file to disk (sql.js export)               │
│  - Provides export / import endpoints                    │
└─────────────────────────────────────────────────────────┘
```

### Auto-Lock

- 15 minutes of inactivity → clear encryption key from memory → require unlock to view events
- Holidays and lunar calendar data remain visible (not encrypted)
- "Lock" button in header for manual lock

---

## 11. API Endpoints

```
POST   /api/setup              - Create master password (first visit)
POST   /api/unlock             - Verify password, return session token
POST   /api/lock               - Lock the app (clear server-side session)

GET    /api/events             - List events for a date range (?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD)
                                Returns: id, start_date, end_date, is_all_day, has_reminder, reminder_at, encrypted_blob
                                While LOCKED: returns presence-only projection 
                                            { id, start_date, end_date, is_all_day, has_reminder: true }
                                (encrypted_blob omitted; client shows dots, no titles)
POST   /api/events             - Create new event
PUT    /api/events/:id         - Update event
DELETE /api/events/:id         - Delete event

GET    /api/events/reminders   - Get upcoming events with reminder_at in window
                                (?) Query params: range_minutes (default 60)

GET    /api/holidays/:year     - Get Chinese + US holidays for a year
GET    /api/calendar/:year/:month
                              - Get calendar data (holidays + lunar dates + solar terms)

GET    /api/export             - Download encrypted .db file (backup)
POST   /api/import             - Restore from uploaded .db file (requires password)
```

---

## 12. File Structure

```
yueli/
├── plan.md                       # This document
├── package.json
├── server.js                     # Express server
├── yueli.db                      # sql.js database file (gitignored)
├── start.sh                      # Lifecycle script
├── stop.sh
├── restart.sh
├── static/
│   ├── css/
│   │   ├── variables.css         # Wu Xing color tokens + Qinglu base
│   │   ├── base.css              # Reset, typography (Noto Serif/Sans SC)
│   │   ├── calendar.css          # Dual calendar grid styles
│   │   ├── schedule.css          # Events, reminders, modals
│   │   ├── animations.css        # Transitions, scroll reveals
│   │   ├── wisdom.css             # Daily Wisdom panel styles
│   │   └── main.css              # Imports all
│   ├── js/
│   │   ├── app.js                # Main controller, routing
│   │   ├── crypto.js             # Encryption utilities (PBKDF2, AES-GCM)
│   │   ├── gregorian.js          # Gregorian calendar rendering + nav
│   │   ├── lunisolar.js          # 农历 lookup + rendering
│   │   ├── lunar-data.js         # 1960–2060 pre-computed lunar table
│   │   ├── holidays.js           # Chinese + US holiday data + lookup
│   │   ├── solar-terms.js        # 24节气 calculation
│   │   ├── wisdom.js             # Daily Wisdom weighted-random engine
│   │   ├── schedule.js           # Personal event CRUD
│   │   ├── reminders.js          # Client-side notification engine
│   │   └── utils.js              # Date helpers, formatters
│   ├── data/
│   │   └── idioms.json           # 100 idioms (copied from zishuo, self-contained)
│   ├── audio/
│   │   ├── idioms/               # 100 idiom pronunciation MP3s
│   │   └── examples/             # 200 example sentence MP3s (2 per idiom)
│   └── assets/
│       ├── seasonal/              # Four seasonal botanical SVGs (Path B)
│       │   ├── plum-blossom.svg   # Spring — 梅花
│       │   ├── lotus-leaf.svg     # Summer — 荷叶
│       │   ├── chrysanthemum.svg  # Autumn — 菊花
│       │   └── pine-branch.svg    # Winter — 松枝
│       └── icons/                # Lunar phase SVGs, holiday icons
└── templates/
    └── index.html                # Single page app shell
```

---

## 13. Phased Build Plan

### Phase 1 — Foundation & Calendar Display

**Goal:** A working dual-calendar view with atmospheric seasonal presence, no data, no encryption.

- [ ] Express server scaffolding (port, static serving, sql.js init)
- [ ] Empty SQLite database setup
- [ ] Gregorian calendar rendering (month grid, navigation, today highlight)
- [ ] Lunar lookup engine (1960–2060: month lengths, leap months, stems/branches, animal years)
- [ ] Lunisolar calendar rendering (parallel grid, 农历 dates)
- [ ] Navigation sync (Hybrid / Option C)
- [ ] "Today" button in header (jump to current month, select today)
- [ ] Jump-to-date picker (click month/year label → month/year dropdown)
- [ ] Keyboard navigation (arrows move selected date, Home = today)
- [ ] Qinglu base styling (dark theme, typography, layout shell)
- [ ] Lunar phase glyphs on lunisolar calendar
- [ ] Yueli wordmark in header (月历 · yueli — refined type, not illustration)
- [ ] Four seasonal botanical SVGs (plum blossom, lotus leaf, chrysanthemum, pine branch)
- [ ] Seasonal botanical in header — auto-rotates on pivot 节气, 30% opacity cross-fade
- [ ] Seasonal color temperature shift (background warms/cools subtly on 节气 pivots)

**Deliverable:** A beautiful, navigable dual-calendar with atmospheric seasonal presence. The calendar feels calm and seasonal. No data, no encryption — pure visual and functional foundation.

### Phase 2 — Holidays, Solar Terms & Daily Wisdom

**Goal:** Holidays, solar terms, and the daily idiom show up with the right colors.

- [ ] US holiday data (11 federal + 8 common observances)
- [ ] Chinese holiday data (7 major, computed from lunar dates)
- [ ] 24 Solar Terms (节气) calculator
- [ ] Holiday color dots/badges on calendar cells
  - 🔴 Red / Gold for Chinese holidays
  - 🔵 Silver-Blue for US holidays
  - 🟡 Muted gold for solar terms
- [ ] Holiday detail panel (name + brief description on selection)
- [ ] Legend bar
- [ ] Copy `idioms_enriched.json` from zishuo → `static/data/idioms.json`
- [ ] Daily Wisdom weighted-random engine (`wisdom.js`)
- [ ] Daily Wisdom panel (`wisdom.css`) — idiom, pinyin, meaning, one example
- [ ] Daily Wisdom audio playback — idiom pronunciation + example sentences (MP3 from zishuo)
- [ ] Expandable extras (explanation, english_similar)
- [ ] Manual swap action and weighted-pool persistence in `localStorage`
- [ ] Midnight-rollover detection (new day → new idiom)

**Deliverable:** Both calendars show holidays in distinguished colors, and the Daily Wisdom panel displays a weighted-random idiom that cycles through all 100 before repeating. Readability-first — dots are subtle, not noisy.

### Phase 3 — Encryption & Storage

**Goal:** Add the encryption layer and event storage with timed/all-day/multi-day support.

- [ ] Master password setup / unlock flow
- [ ] Client-side crypto utilities (PBKDF2 key derivation, AES-256-GCM)
- [ ] `crypto_meta` table (salt, test payload)
- [ ] `events` table with `start_date`, `end_date`, `is_all_day`, `has_reminder`, `reminder_at`, `encrypted_blob`
- [ ] Session management (unlock, lock, 15-min auto-lock timeout)
- [ ] **Locked-app preview** — calendar dots render from unencrypted projection (id + dates + has_reminder), content hidden until unlock
- [ ] Add / edit / delete personal events UI
  - Timed events (HH:MM)
  - All-day events (no time)
  - Multi-day events (start_date → end_date)
- [ ] Events show on calendar as jade green dots (timed/all-day/multi-day share one indicator)
- [ ] Daily agenda panel with separate sections: all-day (top), timed (chronological), multi-day (spans at bottom)
- [ ] Client-side search box (post-unlock, searches decrypted event titles)

**Deliverable:** Encrypted personal events stored and displayed with timed/all-day/multi-day support. App locked / unlocked with password; locked state shows presence dots only.

### Phase 4 — Reminders & Export

**Goal:** Finishing touches.

- [ ] Reminder field on events (default: 1 hr before + at time of event)
- [ ] Client-side reminder engine (checks while app open, fires browser notifications)
- [ ] Reminder indicator (pulsing azure dot on upcoming events)
- [ ] Snooze functionality (5 min / 10 min / 1 hr)
- [ ] Export endpoint (download encrypted `.db` file)
- [ ] Import endpoint (restore from `.db` file with password verification)
- [ ] Responsive layout (mobile stacking)
- [ ] Polish pass (transitions, seasonal accents, edge cases)

**Deliverable:** Complete app — reminders fire, backups work, looks good on mobile.

### Dependency Graph

```
Phase 1 (calendars) ──► Phase 2 (holidays + wisdom) ──► Phase 3 (encryption) ──► Phase 4 (reminders + export)
   │                       │
   └── lunar engine        └── holiday data + idiom data
       (heavy lifting)         (lookup-driven)
```

---

## 14. Out of Scope (v1)

- Multi-user / sharing
- Calendar import (iCal / Google Calendar)
- Mobile native app — web only, accessed via HTTP
- Server-side reminders (reminders fire client-side only)
- Time zone auto-config (uses local time on the browser)
- Lunar-date input (v1 inputs Gregorian dates only; lunar dates are display-only)
- Recurring event UI (the `recurring` field is reserved in the schema, but no UI in v1)

---

## 15. v2 Backlog

Nice-to-have features deliberately deferred from v1. The v1 schema and architecture are designed to accommodate these without major refactoring — they slot in cleanly when prioritized.

### Views & Navigation

- **Week view** — A 7-day horizontal view as a toggle alongside month view; useful for appointment-heavy weeks (currently month + agenda only)
- **Year view** — Optional 12-month overview at a glance (likely overkill for personal use, but trivial to add)

### Recurring Events

- **Recurring event UI** — The `recurring` field is reserved in the schema; v2 adds the UI to set rules: none, daily, weekly, monthly, yearly, lunar-yearly (for Chinese birthdays/anniversaries)
- **Birthdays & anniversaries** — Specifically, lunar-yearly recurring events — the most common recurring personal-calendar use case (e.g. "农历 八月十五 — Mom's birthday")
- **Conflict / double-booking detection** — Warn when adding an event that overlaps an existing one

### Categories & Taxonomy

- **Expanded event categories** — The encrypted `category` field is free-text in v1; v2 adds structured categories with distinct Wu Xing colors:
  - Work → Metal (silver-blue)
  - Family → Wood (lighter sage green)
  - Health → Wood (jade green)
  - Travel → Water (azure)
- **Category filter chips** — Filter calendar/agenda by one or more categories

### Interactions

- **Drag-to-reschedule** — Click and drag an event from one calendar date to another; the encrypted blob is re-saved with new dates
- **Right-click context menu** — Edit / delete / snooze from agenda panel

### Statistics & Insights

- Events this month, week
- Upcoming reminders count
- Busiest day of the week
- Streak tracking (days with at least one personal event)
- Year-in-review card

### Lunar Input

- **Lunar-date input** — When creating an event, optionally enter "农历 八月十五" and have it resolve to the Gregorian date for storage (the reverse computation is already in the lunar engine)

---

## 16. Reference Notes

### Cultural Taboos Respected

- Red is reserved for Chinese celebratory dates only — never used for personal names or mundane items
- No green headwear imagery in any context
- White only as background / negative space — never as dominant celebration color
- Gold as accent, muted and sparing — no large blocks of bright yellow

### Consistency with Existing Projects

- **journal-app** (Node.js + Express + sql.js): Same backend pattern, same client-side encryption approach, same field naming conventions
- **coolRSS** (Python + FastAPI): Not used here — sticking with Node.js for consistency with journal-app (per user preference)

### Lunisolar Range

- **1960 → 2060** (100 years of pre-computed data)
- Covers the practical lifespan of a personal calendar user

---

## 17. Decisions Log

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Tech stack | Node.js + Express + sql.js | Matches journal-app, proven in environment |
| 2 | Encryption approach | Client-side Web Crypto API | Matches journal-app, proven pattern |
| 3 | Encryption scope | Single encrypted blob per event | Cleaner than field-level, smaller attack surface |
| 4 | Reminder timing | Client-side only | Tradeoff: leaks `reminder_at`, but allows reminder checks |
| 5 | US holiday scope | Federal (11) + common observances (8) | Per user confirmation |
| 6 | Export format | Encrypted `.db` file | Password-protected, portable |
| 7 | Navigation sync | Hybrid (Option C) | Most intuitive for dual-calendar use |
| 8 | Auto-lock timeout | 15 minutes | Matches journal-app default |
| 9 | Reminder default | 1 hour before + at time of event | Per user preference |
| 10 | Design philosophy | Readability first, atmosphere second | Calendar grids stay clean; atmosphere in shell |
| 11 | Lunisolar range | 1960–2060 | 100-year practical range |
| 12 | Color system | Wu Xing (Five Elements) mapping | Culturally authentic, distinct color-coded categories |
| 13 | Daily Wisdom | Weighted random, `localStorage` persistence, 100-idiom cycle | Non-sensitive data, no encryption needed; enriched file as source |
| 14 | Wisdom placement | Below the daily agenda panel | Natural reading flow — daily reflection |
| 15 | Wisdom display | Idiom + pinyin + meaning + one example (expandable extras) | Calm, focused daily card |
| 16 | Wisdom scope | Not encrypted, stored in `localStorage` | Wisdom data is public, not personal/sensitive |
| 17 | All-day vs. timed events | `is_all_day` flag in schema; agenda renders separately | Reminder semantics differ for all-day (morning-of) vs. timed |
| 18 | Multi-day events | `start_date` + `end_date` in schema; single encrypted blob per event | Cleaner than per-day rows; one edit propagates across span |
| 19 | Event category in v1 | Free-text string inside encrypted blob, UI ships with `personal` preset only | Schema-level support enables v2 category expansion without refactor |
| 20 | Locked-app preview | Show presence dots (count/boolean only); hide encrypted content until unlocked | Balance of privacy + utility — user sees schedule shape without typing password |
| 21 | v1 navigation aids | "Today" button + jump-to-month/year picker + prev/next arrows | Quick wins for daily use; low complexity |
| 22 | v1 search | Client-side search over decrypted event titles (post-unlock only) | All content is encrypted client-side; server can't search meaningfully |
| 23 | v2 backlog | Explicit list of deferred features (week view, recurring UI, drag, stats, etc.) | Avoids scope creep in v1; makes future roadmap visible |
| 24 | Visual approach | Path B — Atmospheric + Seasonal Botanical Whisper | "When the user looks at the calendar, they should feel the season — not see a picture of it" |

---

*Plan finalized. Awaiting approval to begin Phase 1 implementation.*

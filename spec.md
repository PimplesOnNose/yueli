# 月历 · Yueli — Implementation Specification

> The precise, unambiguous implementation contract for the Yueli dual-calendar application.
> See `plan.md` for rationale, design philosophy, and decisions log.

---

## 1. Data Schemas

### 1.1 SQLite DDL

```sql
CREATE TABLE events (
    id TEXT PRIMARY KEY,                -- UUID v4
    start_date TEXT NOT NULL,           -- 'YYYY-MM-DD' (Gregorian, unencrypted)
    end_date TEXT NOT NULL,             -- 'YYYY-MM-DD' (Gregorian; = start_date for single-day)
    is_all_day INTEGER DEFAULT 0,      -- 1 = all-day, 0 = timed (unencrypted)
    has_reminder INTEGER DEFAULT 0,    -- 1 = has at least one reminder, 0 = none (unencrypted)
    reminder_at TEXT,                   -- ISO 8601 timestamp or null (unencrypted)
    encrypted_blob TEXT NOT NULL,       -- AES-256-GCM ciphertext (base64)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_date_range ON events(start_date, end_date);

CREATE TABLE crypto_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
    salt TEXT NOT NULL,                      -- base64-encoded PBKDF2 salt (16 bytes)
    test_payload TEXT NOT NULL               -- base64-encoded encrypted test string
);
```

### 1.2 Encrypted Blob Envelope

Each event's `encrypted_blob` is a single JSON string, AES-256-GCM encrypted, base64-encoded:

**Plaintext JSON (before encryption):**
```json
{
  "title": "Dentist appointment",
  "description": "Dr. Smith, Suite 200",
  "time": "10:00",
  "category": "personal",
  "reminders": [
    { "offset_minutes": 60, "mode": "before" },
    { "offset_minutes": 0, "mode": "at_time" }
  ]
}
```

**Field definitions:**
- `title` (string, required) — Event title, max 200 chars
- `description` (string, optional) — Event description, max 2000 chars
- `time` (string, optional) — `HH:MM` 24-hour format. Null for all-day events.
- `category` (string, required) — v1 ships `"personal"` only. Free-text to support v2 expansion.
- `reminders` (array, optional) — Reminder configurations. Empty array = no reminders.
  - `offset_minutes` (integer) — Minutes before the event to fire. `0` = at time of event.
  - `mode` (string) — `"before"` or `"at_time"`. For all-day events, `"at_time"` fires at `08:00` local.

**Envelope format (after encryption, before base64):**
```
[12-byte IV] + [ciphertext] + [16-byte auth tag]
```

Stored as: `base64(IV + ciphertext + authTag)`

### 1.3 localStorage Contracts

**Session state** (`yueli_session`):
```json
{
  "isUnlocked": true,
  "lastActivity": 1718304000000
}
```
- `isUnlocked` (boolean) — Whether the app is currently unlocked. Key is held in memory only (never persisted).
- `lastActivity` (number) — Unix timestamp (ms) of last user interaction. Used for auto-lock.

**Theme preference** (`yueli_theme`):
```
"dark" | "light"
```

**Wisdom state** (`yueli_wisdom`):
```json
{
  "shownList": [0, 12, 47],
  "lastShownDate": "2025-06-14",
  "currentId": 12
}
```
- `shownList` (number[]) — Array of idiom `id` values already shown this cycle.
- `lastShownDate` (string) — ISO date `YYYY-MM-DD` of last display. Used to detect day rollover.
- `currentId` (number) — `id` of today's displayed idiom.

**First-run detection:** If `yueli_wisdom` key does not exist in localStorage, create it with defaults and pick the first idiom.

---

## 2. Lunar Engine Specification

### 2.1 Lookup Table Format

The file `static/js/lunar-data.js` exports a 101-element array (indices 0–100, mapping to years 1960–2060).

Each element:
```javascript
{
  year: 1960,                          // Gregorian year
  stem: 0,                             // 天干 index (0–9): 甲乙丙丁戊己庚辛壬癸
  branch: 0,                           // 地支 index (0–11): 子丑寅卯辰巳午未申酉戌亥
  animal: 0,                           // 生肖 index (0–11): 鼠牛虎兔龙蛇马羊猴鸡狗猪
  leapMonth: 0,                        // 0 = no leap month; 1–12 = which month has a leap after it
  months: [30, 29, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30]  // 12 or 13 elements if leap
}
```

**Stem-Branch cycle:** Year stem-branch = `(year - 1960) % 60`. The lookup table pre-computes this so no runtime math is needed.

**Animal year:** `(year - 1960) % 12`. Pre-computed in the table.

**Leap month encoding:** If `leapMonth = 4`, the 4th lunar month is followed by a leap 4th month (闰四月). The `months` array then has 13 elements: `[m1, m2, m3, m4, leap4, m5, m6, ...]`.

### 2.2 Converting Gregorian → 农历

Algorithm:
1. For the target Gregorian date, find which year's lookup entry applies.
2. Count days from the first day of that lunar year (which is the Gregorian date of 春节 for that year — stored in `holidays.js` as the anchor).
3. Walk through `months[]`, subtracting month lengths, until the remainder < next month length.
4. The remainder + 1 is the 农历 day; the month index is the 农历 month.

**Critical:** The anchor date (Gregorian date of 正月初一) must be stored per year. This lives in `holidays.js` as the `springFestival` entry for each year.

### 2.3 24 Solar Terms (节气)

Pre-computed as an array of 24 objects per year in `static/js/solar-terms.js`:

```javascript
{
  year: 2025,
  terms: [
    { name: "小寒", nameEn: "Minor Cold",      pinyin: "xiǎo hán",  timestamp: 1736150400000 },
    { name: "大寒", nameEn: "Major Cold",      pinyin: "dà hán",    timestamp: 1736755200000 },
    // ... 22 more
    { name: "冬至", nameEn: "Winter Solstice", pinyin: "dōng zhì",  timestamp: 1734739200000 }
  ]
}
```

**Accuracy:** Timestamps are computed using Jean Meeus' *Astronomical Algorithms* (2nd ed.), accurate to ±1 minute for 1960–2060. Pre-computed in a generation script at build time, not at runtime.

**Generation:** A Node.js script (`scripts/generate-solar-terms.js`) computes all 101 years × 24 terms and writes `solar-terms.js`. Run once, commit the output.

### 2.4 Lunar Phase Calculation

Lunar phases (new moon, first quarter, full moon, last quarter) are computed using a simplified astronomical formula for 1960–2060:

**Method:** Synodic month approximation. The mean synodic month is 29.53059 days. A known new moon epoch (e.g., Jan 6, 2000 18:14 UTC) plus multiples of the synodic month gives new moon dates accurate to ±6 hours. Refinement with Jean Meeus' corrections brings this to ±2 minutes.

**Glyph mapping:**
- Day 0 (new moon): 🌑
- Days 1–6 (waxing crescent): 🌒
- Day 7 (first quarter): 🌓
- Days 8–13 (waxing gibbous): 🌔
- Day 14 (full moon): 🌕
- Days 15–20 (waning gibbous): 🌖
- Day 21 (last quarter): 🌗
- Days 22–28 (waning crescent): 🌘

A `getLunarPhase(year, month, day)` function returns the appropriate emoji.

---

## 3. Holiday Data Specification

### 3.1 Data Structure

`static/js/holidays.js` exports an object keyed by year (1960–2060):

```javascript
{
  2025: {
    springFestival: "2025-01-29",       // anchor date for lunar engine
    chinese: [
      { id: "spring_festival",    name: "春节",     nameEn: "Spring Festival",   date: "2025-01-29", lunar: "正月初一" },
      { id: "lantern_festival",   name: "元宵节",   nameEn: "Lantern Festival",  date: "2025-02-12", lunar: "正月十五" },
      { id: "qingming",           name: "清明节",   nameEn: "Qingming Festival", date: "2025-04-04", solar_term: true },
      { id: "dragon_boat",        name: "端午节",   nameEn: "Dragon Boat Festival", date: "2025-05-31", lunar: "五月初五" },
      { id: "mid_autumn",         name: "中秋节",   nameEn: "Mid-Autumn Festival", date: "2025-10-06", lunar: "八月十五" },
      { id: "double_ninth",       name: "重阳节",   nameEn: "Double Ninth Festival", date: "2025-10-29", lunar: "九月初九" },
      { id: "winter_solstice",    name: "冬至",     nameEn: "Winter Solstice",   date: "2025-12-21", solar_term: true }
    ],
    us: [
      { id: "new_years_day",      name: "New Year's Day",    date: "2025-01-01", type: "federal" },
      { id: "mlk_day",            name: "MLK Jr. Day",       date: "2025-01-20", type: "federal", rule: "3rd_monday_january" },
      { id: "valentines_day",     name: "Valentine's Day",   date: "2025-02-14", type: "observance" },
      { id: "presidents_day",     name: "Presidents' Day",   date: "2025-02-17", type: "federal", rule: "3rd_monday_february" },
      { id: "st_patricks_day",    name: "St. Patrick's Day", date: "2025-03-17", type: "observance" },
      { id: "april_fools",        name: "April Fools' Day",  date: "2025-04-01", type: "observance" },
      { id: "mothers_day",        name: "Mother's Day",      date: "2025-05-11", type: "observance", rule: "2nd_sunday_may" },
      { id: "memorial_day",       name: "Memorial Day",      date: "2025-05-26", type: "federal", rule: "last_monday_may" },
      { id: "juneteenth",         name: "Juneteenth",        date: "2025-06-19", type: "federal" },
      { id: "fathers_day",        name: "Father's Day",      date: "2025-06-15", type: "observance", rule: "3rd_sunday_june" },
      { id: "independence_day",   name: "Independence Day",  date: "2025-07-04", type: "federal" },
      { id: "labor_day",          name: "Labor Day",         date: "2025-09-01", type: "federal", rule: "1st_monday_september" },
      { id: "columbus_day",       name: "Columbus Day",      date: "2025-10-13", type: "federal", rule: "2nd_monday_october" },
      { id: "halloween",          name: "Halloween",         date: "2025-10-31", type: "observance" },
      { id: "veterans_day",       name: "Veterans Day",      date: "2025-11-11", type: "federal" },
      { id: "thanksgiving",       name: "Thanksgiving",      date: "2025-11-27", type: "federal", rule: "4th_thursday_november" },
      { id: "black_friday",       name: "Black Friday",      date: "2025-11-28", type: "observance", rule: "day_after_thanksgiving" },
      { id: "christmas",          name: "Christmas",         date: "2025-12-25", type: "federal" },
      { id: "new_years_eve",      name: "New Year's Eve",    date: "2025-12-31", type: "observance" }
    ]
  }
}
```

### 3.2 Nth Weekday Date Computation

For holidays defined by rule (e.g., "3rd Monday of January"), a utility function computes the actual Gregorian date:

```javascript
function nthWeekdayOfMonth(year, month, weekday, n) { ... }
// nthWeekdayOfMonth(2025, 1, 1, 3) → 3rd Monday of January 2025
```

For "last Monday of May": compute `nthWeekdayOfMonth(year, 5, 1, 5)`. If that date falls in June, subtract 7 days.

For "day after Thanksgiving": compute Thanksgiving date, add 1 day.

### 3.3 Generation Script

A Node.js script (`scripts/generate-holidays.js`) pre-computes all 101 years (1960–2060) of holiday dates and writes `holidays.js`. Chinese holidays require the lunar engine; US holidays use the rule-based computation. Run once, commit output.

### 3.4 Color Encoding

| Holiday type | Element | CSS class | Color |
|-------------|---------|-----------|-------|
| Chinese holiday | Fire | `.dot--chinese` | `var(--color-fire)` (`#d4380d`) |
| US federal | Metal | `.dot--us-federal` | `var(--color-metal)` (`#8faacc`) |
| US observance | Metal (lighter) | `.dot--us-observance` | `var(--color-metal-light)` (`#8faacc` at 70% opacity) |
| Solar term | Earth | `.dot--solar-term` | `var(--color-earth)` (`#c9a96e`) |

---

## 4. API Specification

### 4.1 Authentication

**Session model:** Server-side, in-memory. A boolean `isUnlocked` flag on the server. No JWT, no cookies — the client sends a session header on every request.

**Header:** `X-Yueli-Session: <session_token>` (a UUID generated on unlock, stored in server memory).

**Auto-lock:** Server checks `lastActivity` timestamp. If `Date.now() - lastActivity > 900000` (15 min), server sets `isUnlocked = false` and clears the session.

### 4.2 Endpoint Specifications

#### POST /api/setup

Create master password (first visit only).

**Request:**
```json
{
  "salt": "base64-encoded-salt",
  "test_payload": "base64-encoded-encrypted-test-string"
}
```

**Response (201):**
```json
{ "status": "ok", "message": "Password created" }
```

**Error (409):** `{ "error": "Password already set" }`

#### POST /api/unlock

Verify password by sending a test decryption.

**Request:**
```json
{
  "test_decrypt_attempt": "base64-of-decrypted-test-payload"
}
```

**Response (200):**
```json
{ "session_token": "uuid-v4", "expires_in": 900 }
```

**Error (401):** `{ "error": "Invalid password" }`

**Note:** The server stores the `test_payload` and `salt` from setup. The client derives the key from the password + salt, decrypts the test payload client-side, and sends the decrypted result. The server compares it to the known plaintext. If it matches, unlock succeeds. This means the server never sees the password or the key.

#### POST /api/lock

**Headers:** `X-Yueli-Session: <token>`

**Response (200):** `{ "status": "locked" }`

#### GET /api/events

List events for a date range.

**Query params:**
- `start_date` (required) — `YYYY-MM-DD`
- `end_date` (required) — `YYYY-MM-DD`

**While UNLOCKED (200):**
```json
{
  "events": [
    {
      "id": "uuid",
      "start_date": "2025-06-14",
      "end_date": "2025-06-14",
      "is_all_day": 0,
      "has_reminder": 1,
      "reminder_at": "2025-06-14T09:00:00",
      "encrypted_blob": "base64..."
    }
  ]
}
```

**While LOCKED (200) — presence-only projection:**
```json
{
  "events": [
    {
      "id": "uuid",
      "start_date": "2025-06-14",
      "end_date": "2025-06-14",
      "is_all_day": 0,
      "has_reminder": 1,
      "encrypted_blob": null
    }
  ]
}
```

`encrypted_blob` is omitted when locked. Client renders dots only.

**Error (401):** `{ "error": "Not authenticated" }` (no valid session)

#### POST /api/events

Create a new event.

**Headers:** `X-Yueli-Session: <token>`

**Request:**
```json
{
  "start_date": "2025-06-14",
  "end_date": "2025-06-14",
  "is_all_day": 0,
  "has_reminder": 1,
  "reminder_at": "2025-06-14T09:00:00",
  "encrypted_blob": "base64..."
}
```

**Response (201):**
```json
{ "id": "uuid", "created_at": "2025-06-14T12:00:00" }
```

#### PUT /api/events/:id

Update an existing event. Same request body as POST. Server updates `updated_at`.

**Response (200):** `{ "status": "ok" }`

**Error (404):** `{ "error": "Event not found" }`

#### DELETE /api/events/:id

**Response (200):** `{ "status": "ok" }`

#### GET /api/events/reminders

Get events with `reminder_at` within a time window.

**Query params:**
- `range_minutes` (optional, default 60) — Look-ahead window in minutes from now.

**Response (200):**
```json
{
  "reminders": [
    {
      "id": "uuid",
      "reminder_at": "2025-06-14T09:00:00",
      "encrypted_blob": "base64..."
    }
  ]
}
```

#### GET /api/holidays/:year

**Response (200):** The holidays object for that year (as defined in Section 3.1).

#### GET /api/calendar/:year/:month

Returns combined calendar data for rendering a single month view.

**Response (200):**
```json
{
  "year": 2025,
  "month": 6,
  "gregorian": {
    "first_day": "2025-06-01",
    "last_day": "2025-06-30",
    "days_in_month": 30,
    "first_day_weekday": 0
  },
  "lunar": {
    "primary_month": { "name": "五月", "stem_branch": "乙巳年", "animal": "蛇" },
    "secondary_month": null,
    "phases": [
      { "date": "2025-06-01", "phase": "🌓" },
      { "date": "2025-06-02", "phase": "🌓" }
    ]
  },
  "solar_terms": [
    { "date": "2025-06-05", "name": "芒种", "nameEn": "Grain in Ear", "pinyin": "máng zhòng" }
  ],
  "holidays": {
    "chinese": [
      { "date": "2025-05-31", "name": "端午节", "nameEn": "Dragon Boat Festival" }
    ],
    "us": [
      { "date": "2025-06-15", "name": "Father's Day", "type": "observance" },
      { "date": "2025-06-19", "name": "Juneteenth", "type": "federal" }
    ]
  }
}
```

#### GET /api/export

**Response (200):** Binary download of `yueli.db` file with `Content-Type: application/octet-stream` and `Content-Disposition: attachment; filename="yueli-backup-YYYY-MM-DD.db"`.

#### POST /api/import

**Request:** Multipart form upload with `.db` file.

**Response (200):** `{ "status": "ok", "events_imported": 42 }`

**Error (400):** `{ "error": "Invalid database file" }`

---

## 5. Encryption Specification

### 5.1 PBKDF2 Parameters

| Parameter | Value |
|-----------|-------|
| Algorithm | PBKDF2 |
| Hash | SHA-256 |
| Iterations | 100,000 |
| Salt length | 16 bytes (128 bits), random |
| Key length | 256 bits (32 bytes) |

### 5.2 AES-256-GCM Parameters

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| IV length | 12 bytes (96 bits), random per encryption |
| Auth tag length | 16 bytes (128 bits) |
| Key | Derived from PBKDF2 (5.1) |

### 5.3 Test Payload

On setup:
1. Generate a known plaintext: `"yueli-test-payload-v1"` (fixed string).
2. Encrypt it with the derived key + random IV.
3. Store `base64(IV + ciphertext + authTag)` in `crypto_meta.test_payload`.
4. Store `base64(salt)` in `crypto_meta.salt`.

On unlock:
1. Client reads `salt` and `test_payload` from server.
2. Client derives key from user's password + salt.
3. Client decrypts `test_payload`.
4. If plaintext === `"yueli-test-payload-v1"`, unlock succeeds.
5. Client sends the decrypted plaintext to server for verification.
6. Server compares against the known string.

### 5.4 Key Lifecycle

1. **Setup:** Key derived in memory. Test payload encrypted and sent to server. Key held in a `CryptoKey` object in a JS closure.
2. **Unlock:** Key re-derived from password. Held in the same closure. All subsequent encrypt/decrypt uses this key.
3. **Auto-lock (15 min inactivity):** The closure variable is set to `null`. Key is garbage-collected. No persistence.
4. **Manual lock:** Same as auto-lock.
5. **Page refresh:** Key is lost (not persisted anywhere). User must unlock again.

### 5.5 Inactivity Detection

Client-side:
```javascript
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in ms
let lastActivity = Date.now();

document.addEventListener('mousemove', () => { lastActivity = Date.now(); });
document.addEventListener('keydown', () => { lastActivity = Date.now(); });
document.addEventListener('click', () => { lastActivity = Date.now(); });

setInterval(() => {
  if (Date.now() - lastActivity > INACTIVITY_TIMEOUT && crypto.isUnlocked()) {
    crypto.lock();
    app.showLockScreen();
  }
}, 30000); // check every 30 seconds
```

---

## 6. Wisdom Specification

### 6.1 State Machine

```
                    ┌──────────────────────────────┐
                    │         NO STATE              │
                    │   (first visit, no key)       │
                    └──────────────┬───────────────┘
                                   │ initWisdom()
                                   ▼
                    ┌──────────────────────────────┐
                    │      TODAY_NOT_SHOWN          │
                    │  (new day or first visit)     │
                    │  → pick weighted-random idiom │
                    │  → render                     │
                    └──────────────┬───────────────┘
                                   │ rendered
                                   ▼
                    ┌──────────────────────────────┐
                    │        TODAY_SHOWN            │
                    │  (same day, already picked)   │
                    │  → render currentId           │
                    └──────────────┬───────────────┘
                                   │ user clicks ⟳
                                   ▼
                    ┌──────────────────────────────┐
                    │        SWAPPED                │
                    │  → old idiom stays in shownList│
                    │  → pick new weighted-random   │
                    │  → new idiom added to shownList│
                    │  → render new idiom           │
                    └──────────────┬───────────────┘
                                   │ day changes (midnight rollover detected on next open)
                                   ▼
                    ┌──────────────────────────────┐
                    │       POOL_EXHAUSTED?         │
                    │  if shownList.length >= 100:  │
                    │    → clear shownList (reset)  │
                    │  → back to TODAY_NOT_SHOWN    │
                    └──────────────────────────────┘
```

### 6.2 Weighted-Random Algorithm (Exact Implementation)

```javascript
function pickIdiom(shownList, idioms) {
  const shownSet = new Set(shownList);
  const candidates = idioms.filter(i => !shownSet.has(i.id));

  // If all idioms have been shown, reset (this shouldn't happen if
  // the pool-exhaustion check runs before pickIdiom, but guard anyway)
  if (candidates.length === 0) {
    return idioms[Math.floor(Math.random() * idioms.length)];
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
```

Since all unseen idioms have equal weight (1) and all seen have weight (0), this reduces to: pick uniformly at random from the unseen set.

### 6.3 Manual Swap Logic

```javascript
function swapIdiom(wisdomState, idioms) {
  // The current idiom was already added to shownList when first picked
  // Just pick a new one (it won't be in shownList, so it's eligible)
  const newIdiom = pickIdiom(wisdomState.shownList, idioms);
  wisdomState.shownList.push(newIdiom.id);
  wisdomState.currentId = newIdiom.id;
  saveWisdom(wisdomState);
  return newIdiom;
}
```

**Edge case:** If `shownList.length >= 99` and user swaps, the new pick exhausts the pool. On next day-open, the pool resets.

### 6.4 Midnight Rollover Detection

On every app open:
```javascript
const today = new Date().toISOString().split('T')[0]; // "2025-06-14"
const wisdom = loadWisdom();

if (wisdom.lastShownDate !== today) {
  // New day
  if (wisdom.shownList.length >= 100) {
    wisdom.shownList = []; // reset cycle
  }
  const idiom = pickIdiom(wisdom.shownList, idioms);
  wisdom.shownList.push(idiom.id);
  wisdom.currentId = idiom.id;
  wisdom.lastShownDate = today;
  saveWisdom(wisdom);
  renderIdiom(idiom);
} else {
  // Same day — render existing
  const idiom = idioms.find(i => i.id === wisdom.currentId);
  renderIdiom(idiom);
}
```

**Note:** Midnight rollover is detected on next app open, not in real-time. If the user has the app open at midnight, the wisdom panel does not auto-refresh. This is acceptable for v1.

---

## 7. Reminder Engine Specification

### 7.1 Check Loop

```javascript
const REMINDER_CHECK_INTERVAL = 30000; // 30 seconds
let firedReminders = new Set(); // track already-fired reminder IDs to avoid duplicates

setInterval(async () => {
  if (!crypto.isUnlocked()) return;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000); // look 1 hour ahead

  const response = await fetch(`/api/events/reminders?range_minutes=60`);
  const { reminders } = await response.json();

  for (const reminder of reminders) {
    const reminderTime = new Date(reminder.reminder_at);
    const reminderKey = `${reminder.id}_${reminder.reminder_at}`;

    if (firedReminders.has(reminderKey)) continue;
    if (reminderTime <= now) {
      // Fire the reminder
      fireNotification(reminder);
      firedReminders.add(reminderKey);
    }
  }
}, REMINDER_CHECK_INTERVAL);
```

### 7.2 Browser Notification

```javascript
function fireNotification(reminder) {
  if (Notification.permission !== 'granted') return;

  const event = crypto.decrypt(reminder.encrypted_blob);
  const notification = new Notification(`📅 ${event.title}`, {
    body: event.time ? `At ${event.time}` : 'All-day event',
    icon: '/static/assets/icons/calendar-icon.png',
    tag: reminder.id, // prevents duplicate notifications
    requireInteraction: true
  });

  notification.onclick = () => {
    window.focus();
    app.selectDate(reminder.start_date);
  };
}
```

### 7.3 Permission Flow

On first visit (before setup/unlock), the app requests notification permission:
```javascript
if (Notification.permission === 'default') {
  Notification.requestPermission();
}
```

If denied, reminders still work visually (pulsing azure dot) but no popup notification.

### 7.4 Snooze

When a notification fires, the reminder is added to a snooze UI panel in the agenda area. Snooze options:
- 5 minutes
- 10 minutes
- 1 hour

Snoozing re-adds the reminder to the check loop with a new `reminder_at` = now + snooze duration. The snoozed reminder is stored in `localStorage` (not the server) to avoid mutating the event:

```javascript
{
  "snoozedReminders": [
    { "eventId": "uuid", "snoozeUntil": "2025-06-14T10:05:00" }
  ]
}
```

### 7.5 Firing Behavior

- **Multiple reminders:** If multiple events have the same `reminder_at`, all fire simultaneously. Notifications stack in the browser notification tray.
- **Tab backgrounded:** Notifications still fire (browser handles this). The `tag` field prevents duplicates if the tab regains focus.
- **Tab closed:** Reminders do not fire (client-side only). This is the accepted tradeoff (Decision #4).
- **App locked:** Reminders do not fire (encrypted data not available). The `has_reminder` flag is visible while locked, but the notification itself requires unlock.

---

## 8. Color & Typography Contract

### 8.1 CSS Variables (variables.css)

```css
:root {
  /* === Wu Xing — Five Elements === */
  --color-wood:          #4a9e8a;   /* Personal events */
  --color-fire:          #d4380d;   /* Chinese holidays */
  --color-fire-gold:     #d4a017;   /* Chinese holiday accent */
  --color-earth:         #c9a96e;   /* Solar terms, lunar markers */
  --color-metal:         #8faacc;   /* US holidays */
  --color-metal-light:   rgba(143, 170, 204, 0.7);  /* US observances */
  --color-water:         #5a8e9e;   /* Reminders */

  /* === Qinglu Base — Dark Theme === */
  --bg-deep:             #080a10;   /* Main background */
  --bg-card:             #0d1018;   /* Card backgrounds */
  --bg-elevated:         #11141d;   /* Elevated surfaces */
  --bg-surface:          #161a24;   /* Input backgrounds */
  --bg-wisdom:           #1a1510;   /* Wisdom card — warm parchment tint */

  --text-primary:        #e8e4df;   /* Primary text (warm white) */
  --text-secondary:      #9a958f;   /* Secondary text (muted warm gray) */
  --text-muted:          #6b6560;   /* Muted text */

  --border-subtle:       #1e2230;   /* Subtle borders */
  --border-jade:         rgba(74, 158, 138, 0.3);  /* Jade border accent */

  /* === Seasonal Temperature Offsets (applied via JS) === */
  --seasonal-hue-shift:  0deg;      /* ±2deg micro-shift on 节气 pivot */
  --seasonal-bg-tint:    transparent; /* Warm or cool tint overlay */

  /* === Typography === */
  --font-display:        'Noto Serif SC', serif;
  --font-body:           'Noto Sans SC', sans-serif;
  --font-mono:           'JetBrains Mono', monospace;

  /* === Spacing === */
  --space-unit:          8px;
  --radius-sm:           4px;
  --radius-md:           8px;
  --radius-lg:           12px;

  /* === Transitions === */
  --transition-fast:     150ms ease;
  --transition-normal:   250ms ease;
  --transition-slow:     500ms ease;
  --transition-seasonal: 7d ease;    /* 7-day cross-fade for seasonal changes */
}
```

### 8.2 Light Theme Overrides

```css
[data-theme="light"] {
  --bg-deep:             #FAF8F5;
  --bg-card:             #FFFFFF;
  --bg-elevated:         #F5F3EF;
  --bg-surface:          #EDEBE7;
  --bg-wisdom:           #F5F0E8;

  --text-primary:        #2D2A26;
  --text-secondary:      #6B6560;
  --text-muted:          #9A958F;

  --border-subtle:       #E8E4DF;
  --border-jade:         rgba(74, 158, 138, 0.4);
}
```

### 8.3 Typography Scale

| Element | Font | Weight | Size | Line Height | Letter Spacing |
|---------|------|--------|------|-------------|----------------|
| Wordmark (月历) | Noto Serif SC | 600 | 24px | 1.2 | 0.05em |
| Wordmark (yueli) | Noto Sans SC | 300 | 14px | 1.2 | 0.1em |
| Calendar month title | Noto Serif SC | 400 | 18px | 1.3 | 0.02em |
| Day number | Noto Sans SC | 400 | 14px | 1.0 | 0 (tabular) |
| 农历 day | Noto Sans SC | 400 | 11px | 1.0 | 0 |
| Agenda event title | Noto Sans SC | 500 | 15px | 1.4 | 0.01em |
| Wisdom idiom | Noto Serif SC | 700 | 28px | 1.3 | 0.05em |
| Wisdom pinyin | Noto Sans SC | 400 | 14px | 1.5 | 0.02em |
| Wisdom English | Noto Sans SC | 400 | 14px | 1.6 | 0 |
| Holiday badge label | Noto Sans SC | 500 | 11px | 1.0 | 0.02em |

---

## 9. Component Inventory

### 9.1 Header

**Elements:**
- Hamburger menu `[☰]` — mobile only, toggles sidebar/overlay
- Wordmark: `月历 · yueli` — left-aligned, persistent
- Seasonal botanical — top-right, 30% opacity, cross-fades on 节气 pivot
- Notification bell `[🔔]` — shows count of pending reminders
- Lock button `[🔒]` — manual lock
- Settings `[⚙]` — theme toggle, export/import

**States:**
- Default (unlocked): all controls visible
- Locked: lock button changes to unlock icon `[🔓]`; notification bell hidden

### 9.2 Gregorian Calendar Grid

**Elements:**
- Month/year title with jump-to-date picker
- Prev/Next month arrows
- "Today" button
- 7-column weekday header (Su Mo Tu We Th Fr Sa)
- Day cells: number + colored dots

**Cell states:**
- Default: `--text-primary` number
- Today: jade border, slightly elevated background
- Selected: jade background at 20% opacity, bold number
- Has Chinese holiday: red dot (6px)
- Has US holiday: silver-blue dot (6px)
- Has solar term: gold dot (4px)
- Has personal event: jade dot (6px)
- Has reminder: azure pulse animation on dot
- Locked + has event: muted jade dot (opacity 0.4), no title

**Interaction:**
- Click cell → select date, sync lunisolar calendar, scroll agenda
- Hover → subtle jade border glow (`var(--border-jade)`)
- Keyboard: arrows move selection, Enter opens event editor

### 9.3 Lunisolar Calendar Grid

**Elements:**
- Year stem-branch + animal (乙巳年 蛇)
- Month name (五月)
- Prev/Next month arrows (independent of Gregorian — navigates lunar months)
- 农历 day cells: 初一 through 三十
- Lunar phase glyph per cell
- "See also" indicator when cell falls in adjacent lunar month

**Cell states:**
- Same dot system as Gregorian (shared data)
- 初一 (1st of month): slightly emphasized (the month boundary)
- Selected: synced with Gregorian selection

### 9.4 Daily Agenda Panel

**Sections (in order):**
1. **All-day events** — no time shown, jade dot, at top
2. **Multi-day events** — span indicator, at bottom of all-day section
3. **Timed events** — chronological, time on left, jade dot
4. **Holidays** — below events, color-coded dots with labels

**Empty state:** "No events on this date" with subtle text.

**Interactions:**
- Click event → open edit modal
- Click `[+ Add Event]` → open new event modal
- Click holiday → show holiday detail tooltip

### 9.5 Daily Wisdom Card

**Default state:**
```
📜 每日格言 · Daily Wisdom           [⟳] [More →]
        白驹过隙
      bái jū guò xì
  White colt passes crack.

  人生百年如白驹过隙，青春时光尤其珍贵，不可虚度。
  Rénshēng bǎi nián rú bái jū guò xì...
  A hundred years of life flash by like a white colt
  through a crack — youth is especially precious.

  [🔊 Idiom] [🔊 Example 1] [🔊 Example 2]
```

**Expanded state (click "More →"):**
- Explanation (longer text)
- English similar proverbs

**Loading state:** Skeleton shimmer.

**First-visit state:** Card appears with animation after wisdom engine initializes.

### 9.6 Event Editor Modal

**Fields:**
- Title (text input, required)
- Date (date input, defaults to selected date)
- End date (date input, for multi-day; hidden if "Single day" toggle is off)
- All-day toggle (switch)
- Time (time input, hidden if all-day)
- Description (textarea, optional)
- Category (dropdown: "Personal" for v1)
- Reminders:
  - Default: "1 hour before + at time" (two rows)
  - Add/remove reminder rows
  - Each row: offset dropdown (5 min, 15 min, 30 min, 1 hr, 1 day, at time) + mode

**Validation:**
- Title: required, max 200 chars
- End date: must be ≥ start date
- Time: required if not all-day

### 9.7 Lock Screen

**States:**
- **Setup** (first visit): "Create a password" — two inputs (password + confirm), strength indicator
- **Unlock** (subsequent): "Enter your password" — single input, error shake on wrong password
- **Auto-locked:** "Session expired. Enter your password." — single input

### 9.8 Search Box

- Located in header (to the right of wordmark, left of action buttons)
- Placeholder: "Search events..."
- Searches decrypted event titles client-side (post-unlock only)
- Debounced 300ms
- Results: filtered agenda panel
- While locked: search box hidden

### 9.9 Keyboard Interaction Map

| Key | Action |
|-----|--------|
| ← → | Move selected date left/right |
| ↑ ↓ | Move selected date up/down (prev/next week) |
| Home | Jump to today |
| N | Open new event modal |
| Escape | Close modal / deselect |
| Enter | Open event editor for selected date (if events exist) |
| / | Focus search box (post-unlock) |
| L | Manual lock |

---

## 10. Test Plan

### 10.1 Unit Tests

**Lunar Engine (`lunar-data.js`, `lunisolar.js`):**
- Convert known Gregorian dates → 农历 and verify against published calendars (10 reference dates per decade, 1960–2060)
- Verify leap month detection for known leap years
- Verify stem-branch cycle: 2024 = 甲辰年 (Dragon), 2025 = 乙巳年 (Snake)
- Verify edge cases: 农历 三十 in months with only 29 days (should wrap to next month 初一)

**Solar Terms (`solar-terms.js`):**
- Verify 10 known solar term dates per year against published Chinese calendar (±1 day tolerance)
- Verify all 24 terms are present for each year

**Holiday Lookup (`holidays.js`):**
- Verify all 7 Chinese holidays for 5 reference years
- Verify all 19 US holidays for 5 reference years
- Verify nth-weekday computation: 3rd Monday of January 2025 = Jan 20
- Verify "day after Thanksgiving" computation

**Encryption (`crypto.js`):**
- Encrypt → decrypt round-trip produces original plaintext
- Wrong key → decryption throws `OperationError`
- IV uniqueness: encrypt same plaintext 100 times, all IVs differ
- Test payload verification: correct password decrypts to known string

**Wisdom (`wisdom.js`):**
- Pick from unseen pool: verifies selected idiom is not in shownList
- Pool exhaustion at 100: shownList clears on next pick
- Same-day stability: two calls on same day return same currentId
- Manual swap: old idiom in shownList, new idiom rendered, new idiom in shownList
- First visit (no localStorage): initializes with defaults, picks first idiom

**Reminders (`reminders.js`):**
- Reminder within window: fires notification
- Reminder outside window: does not fire
- Already-fired reminder: does not fire again
- Snooze: new reminder_at = now + snooze duration

### 10.2 Integration Tests

**API Endpoints:**
- POST /api/setup → 201, then second POST → 409
- POST /api/unlock with correct password → 200 + session token
- POST /api/unlock with wrong password → 401
- GET /api/events while locked → presence-only projection (no encrypted_blob)
- GET /api/events while unlocked → full data including encrypted_blob
- POST /api/events → 201, then GET returns the new event
- PUT /api/events/:id → 200, then GET reflects update
- DELETE /api/events/:id → 200, then GET no longer returns it
- GET /api/export → returns .db file download
- POST /api/import with valid .db → 200, events imported

**Locked/Unlocked Flow:**
- Setup → unlock → create event → lock → GET events (presence-only) → unlock → GET events (full data)

### 10.3 Manual QA Checklist

**Phase 1:**
- [ ] Calendar renders correctly for January and December (year boundary)
- [ ] Today is highlighted with jade border
- [ ] Prev/Next month navigation works
- [ ] "Today" button returns to current month
- [ ] Jump-to-date picker opens and selects correctly
- [ ] Keyboard arrows navigate dates
- [ ] Lunisolar calendar syncs with Gregorian selection
- [ ] 农历 dates match published calendar for current month
- [ ] Lunar phase glyphs change throughout the month
- [ ] Wordmark displays correctly
- [ ] Seasonal botanical appears at 30% opacity
- [ ] Theme toggle works (dark ↔ light)
- [ ] Mobile layout stacks calendars vertically

**Phase 2:**
- [ ] Chinese holiday dots appear on correct dates
- [ ] US holiday dots appear on correct dates
- [ ] Solar term markers appear on correct dates
- [ ] Color coding matches Wu Xing mapping
- [ ] Holiday detail panel shows on selection
- [ ] Legend bar is visible and accurate
- [ ] Wisdom panel displays idiom, pinyin, meaning, example
- [ ] "More →" expands explanation and English similar
- [ ] Swap button (⟳) picks a new idiom
- [ ] Wisdom persists across page refreshes (same day = same idiom)
- [ ] Wisdom cycles through all 100 before repeating

**Phase 3:**
- [ ] First visit shows setup screen
- [ ] Password creation works with strength indicator
- [ ] Unlock with correct password shows calendar
- [ ] Unlock with wrong password shows error shake
- [ ] Auto-lock after 15 minutes of inactivity
- [ ] Manual lock button works
- [ ] Create timed event → appears on calendar and agenda
- [ ] Create all-day event → appears at top of agenda
- [ ] Create multi-day event → spans across dates
- [ ] Edit event → changes persist
- [ ] Delete event → removed from calendar and agenda
- [ ] Locked state shows presence dots only
- [ ] Search finds events by title
- [ ] Search is hidden while locked

**Phase 4:**
- [ ] Default reminders (1 hr before + at time) fire correctly
- [ ] Browser notification permission requested on first visit
- [ ] Notification shows event title
- [ ] Snooze works (5 min, 10 min, 1 hr)
- [ ] Pulsing azure dot on events with upcoming reminders
- [ ] Export downloads .db file
- [ ] Import restores events from .db file
- [ ] Responsive: mobile layout works correctly
- [ ] Seasonal botanical cross-fades on 节气 pivot (manual date override to test)
- [ ] Background color temperature shifts on 节气 pivot

---

*Specification finalized. Implementation may begin upon approval.*

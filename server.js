const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/static', express.static(path.join(__dirname, 'static')));

// ── Database ─────────────────────────────────────────────────
let db;
const DB_PATH = path.join(__dirname, 'yueli.db');

async function initDatabase() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            is_all_day INTEGER DEFAULT 0,
            has_reminder INTEGER DEFAULT 0,
            reminder_at TEXT,
            encrypted_blob TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_events_date_range ON events(start_date, end_date)`);

    db.run(`
        CREATE TABLE IF NOT EXISTS crypto_meta (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            salt TEXT NOT NULL,
            test_payload TEXT NOT NULL
        )
    `);

    saveDatabase();
}

function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

function runQuery(sql, params = []) {
    const cleanParams = params.map(p => p === undefined ? null : p);
    db.run(sql, cleanParams);
    saveDatabase();
}

function getAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

function getOne(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
    }
    stmt.free();
    return null;
}

// ── Session State (in-memory) ────────────────────────────────
let session = {
    isUnlocked: false,
    token: null,
    lastActivity: null
};

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

function checkSession() {
    if (session.isUnlocked && Date.now() - session.lastActivity > SESSION_TIMEOUT) {
        session.isUnlocked = false;
        session.token = null;
        session.lastActivity = null;
    }
}

function requireAuth(req, res, next) {
    checkSession();
    const token = req.headers['x-yueli-session'];
    if (!session.isUnlocked || session.token !== token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    session.lastActivity = Date.now();
    next();
}

// ── Upload Config ────────────────────────────────────────────
const upload = multer({ dest: path.join(__dirname, 'tmp/') });

// ── Routes: HTML ─────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// ── Routes: Auth ─────────────────────────────────────────────

/**
 * POST /api/setup
 * Create master password (first visit only).
 * Body: { salt, test_payload }
 */
app.post('/api/setup', (req, res) => {
    const { salt, test_payload } = req.body;

    // Check if password already exists
    const existing = getOne('SELECT id FROM crypto_meta WHERE id = 1');
    if (existing) {
        return res.status(409).json({ error: 'Password already set' });
    }

    if (!salt || !test_payload) {
        return res.status(400).json({ error: 'Missing salt or test_payload' });
    }

    runQuery('INSERT INTO crypto_meta (id, salt, test_payload) VALUES (1, ?, ?)', [salt, test_payload]);
    res.status(201).json({ status: 'ok', message: 'Password created' });
});

/**
 * POST /api/unlock
 * Verify password by sending decrypted test payload.
 * Body: { test_decrypt_attempt }
 */
app.post('/api/unlock', (req, res) => {
    const { test_decrypt_attempt } = req.body;

    const meta = getOne('SELECT test_payload FROM crypto_meta WHERE id = 1');
    if (!meta) {
        return res.status(404).json({ error: 'No password set — call /api/setup first' });
    }

    // The client sends the decrypted test payload
    // We compare it to the known plaintext
    if (test_decrypt_attempt !== 'yueli-test-payload-v1') {
        return res.status(401).json({ error: 'Invalid password' });
    }

    // Create session
    session.isUnlocked = true;
    session.token = uuidv4();
    session.lastActivity = Date.now();

    res.json({ session_token: session.token, expires_in: 900 });
});

/**
 * POST /api/lock
 * Lock the app (clear session).
 */
app.post('/api/lock', requireAuth, (req, res) => {
    session.isUnlocked = false;
    session.token = null;
    session.lastActivity = null;
    res.json({ status: 'locked' });
});

/**
 * GET /api/status
 * Check if the app has been set up and if it's unlocked.
 */
app.get('/api/status', (req, res) => {
    checkSession();
    const meta = getOne('SELECT id FROM crypto_meta WHERE id = 1');
    res.json({
        isSetup: !!meta,
        isUnlocked: session.isUnlocked
    });
});

// ── Routes: Events ───────────────────────────────────────────

/**
 * GET /api/events
 * List events for a date range.
 * Query: start_date, end_date
 * While locked: returns presence-only projection (no encrypted_blob)
 */
app.get('/api/events', (req, res) => {
    checkSession();
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Missing start_date or end_date' });
    }

    const events = getAll(
        'SELECT * FROM events WHERE start_date <= ? AND end_date >= ?',
        [end_date, start_date]
    );

    if (!session.isUnlocked) {
        // Presence-only projection
        const projection = events.map(e => ({
            id: e.id,
            start_date: e.start_date,
            end_date: e.end_date,
            is_all_day: e.is_all_day,
            has_reminder: e.has_reminder,
            encrypted_blob: null
        }));
        return res.json({ events: projection });
    }

    res.json({ events });
});

/**
 * POST /api/events
 * Create a new event.
 */
app.post('/api/events', requireAuth, (req, res) => {
    const { start_date, end_date, is_all_day, has_reminder, reminder_at, encrypted_blob } = req.body;

    if (!start_date || !encrypted_blob) {
        return res.status(400).json({ error: 'Missing start_date or encrypted_blob' });
    }

    const id = uuidv4();
    const finalEndDate = end_date || start_date;
    const finalIsAllDay = is_all_day ? 1 : 0;
    const finalHasReminder = has_reminder ? 1 : 0;

    runQuery(
        'INSERT INTO events (id, start_date, end_date, is_all_day, has_reminder, reminder_at, encrypted_blob) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, start_date, finalEndDate, finalIsAllDay, finalHasReminder, reminder_at || null, encrypted_blob]
    );

    res.status(201).json({ id, created_at: new Date().toISOString() });
});

/**
 * PUT /api/events/:id
 * Update an existing event.
 */
app.put('/api/events/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { start_date, end_date, is_all_day, has_reminder, reminder_at, encrypted_blob } = req.body;

    const existing = getOne('SELECT id FROM events WHERE id = ?', [id]);
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
    }

    runQuery(
        `UPDATE events SET
            start_date = COALESCE(?, start_date),
            end_date = COALESCE(?, end_date),
            is_all_day = COALESCE(?, is_all_day),
            has_reminder = COALESCE(?, has_reminder),
            reminder_at = ?,
            encrypted_blob = COALESCE(?, encrypted_blob),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [start_date, end_date, is_all_day !== undefined ? (is_all_day ? 1 : 0) : null, has_reminder !== undefined ? (has_reminder ? 1 : 0) : null, reminder_at !== undefined ? reminder_at : null, encrypted_blob, id]
    );

    res.json({ status: 'ok' });
});

/**
 * DELETE /api/events/:id
 * Delete an event.
 */
app.delete('/api/events/:id', requireAuth, (req, res) => {
    const { id } = req.params;

    const existing = getOne('SELECT id FROM events WHERE id = ?', [id]);
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
    }

    runQuery('DELETE FROM events WHERE id = ?', [id]);
    res.json({ status: 'ok' });
});

/**
 * GET /api/events/reminders
 * Get upcoming events with reminder_at in window.
 * Query: range_minutes (default 60)
 */
app.get('/api/events/reminders', requireAuth, (req, res) => {
    const rangeMinutes = parseInt(req.query.range_minutes) || 60;
    const now = new Date();
    const windowEnd = new Date(now.getTime() + rangeMinutes * 60 * 1000);

    const nowStr = now.toISOString();
    const endStr = windowEnd.toISOString();

    const events = getAll(
        'SELECT * FROM events WHERE has_reminder = 1 AND reminder_at IS NOT NULL AND reminder_at >= ? AND reminder_at <= ?',
        [nowStr, endStr]
    );

    res.json({ reminders: events });
});

// ── Routes: Export / Import ──────────────────────────────────

/**
 * GET /api/export
 * Download encrypted .db file (backup).
 */
app.get('/api/export', (req, res) => {
    if (!fs.existsSync(DB_PATH)) {
        return res.status(404).json({ error: 'No database file' });
    }

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="yueli-backup-${date}.db"`);
    res.sendFile(DB_PATH);
});

/**
 * POST /api/import
 * Restore from .db file.
 */
app.post('/api/import', upload.single('database'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const buffer = fs.readFileSync(req.file.path);

        // Validate it's a valid SQLite database
        const SQL = require('sql.js');
        SQL().then(sql => {
            try {
                const testDb = new sql.Database(buffer);
                // Check if it has our tables
                const tables = testDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
                testDb.close();

                // Replace current database
                fs.copyFileSync(req.file.path, DB_PATH);

                // Reload database
                const mainBuffer = fs.readFileSync(DB_PATH);
                db = new sql.Database(mainBuffer);

                // Clean up temp file
                fs.unlinkSync(req.file.path);

                // Count events
                const count = getOne('SELECT COUNT(*) as count FROM events');
                res.json({ status: 'ok', events_imported: count ? count.count : 0 });
            } catch (e) {
                fs.unlinkSync(req.file.path);
                res.status(400).json({ error: 'Invalid database file: ' + e.message });
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Import failed: ' + e.message });
    }
});

// ── Start ────────────────────────────────────────────────────
async function start() {
    await initDatabase();
    
    // Check for SSL certificates
    const keyPath = path.join(__dirname, 'certs', 'key.pem');
    const certPath = path.join(__dirname, 'certs', 'cert.pem');
    
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        // HTTPS mode
        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
        
        https.createServer(options, app).listen(PORT, () => {
            console.log(`月历 · Yueli running on https://localhost:${PORT}`);
        });
    } else {
        // HTTP mode (works with pure JS crypto fallback)
        app.listen(PORT, () => {
            console.log(`月历 · Yueli running on http://localhost:${PORT}`);
            console.log(`(Using pure JS crypto - no HTTPS required)`);
        });
    }
}

start().catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});

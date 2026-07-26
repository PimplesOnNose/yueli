/* ── reminders.js ───────────────────────────────────────────
 * Client-side reminder engine (browser notifications)
 * Checks every 30 seconds, fires notifications for due reminders.
 * ─────────────────────────────────────────────────────────── */

const Reminders = (() => {
    const CHECK_INTERVAL = 30 * 1000; // 30 seconds
    let firedReminders = new Set();
    let checkTimer = null;
    let sessionToken = null;
    let snoozedReminders = [];

    function init() {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Load snoozed reminders from localStorage
        loadSnoozed();

        // Start check loop
        checkTimer = setInterval(checkReminders, CHECK_INTERVAL);
    }

    function setSessionToken(token) {
        sessionToken = token;
    }

    /**
     * Check for due reminders
     */
    async function checkReminders() {
        if (!Crypto.isUnlocked() || !sessionToken) return;

        try {
            const res = await fetch('/api/events/reminders?range_minutes=60', {
                headers: { 'X-Yueli-Session': sessionToken }
            });

            if (res.status === 401) return;

            const data = await res.json();
            const reminders = data.reminders || [];

            for (const reminder of reminders) {
                const reminderTime = new Date(reminder.reminder_at);
                const now = new Date();
                const reminderKey = `${reminder.id}_${reminder.reminder_at}`;

                // Skip if already fired
                if (firedReminders.has(reminderKey)) continue;

                // Check if snoozed
                if (isSnoozed(reminder.id)) continue;

                // Fire if time has passed
                if (reminderTime <= now) {
                    await fireNotification(reminder);
                    firedReminders.add(reminderKey);
                }
            }

            // Also check snoozed reminders
            checkSnoozed();

        } catch (err) {
            console.warn('Reminder check failed:', err);
        }
    }

    /**
     * Fire a browser notification
     */
    async function fireNotification(reminder) {
        if (Notification.permission !== 'granted') return;

        try {
            // Decrypt the event
            const plaintext = await Crypto.decrypt(reminder.encrypted_blob);
            const event = JSON.parse(plaintext);

            const title = event.title || 'Untitled Event';
            const body = event.time ? `At ${event.time}` : 'All-day event';

            const notification = new Notification(`📅 ${title}`, {
                body,
                icon: '/static/assets/icons/calendar.svg',
                tag: reminder.id,
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                // Navigate to the event date
                if (reminder.start_date) {
                    App.selectDate(reminder.start_date);
                }
            };

            // Update UI indicator
            updateReminderIndicator(reminder.id, true);

        } catch (err) {
            console.warn('Failed to fire notification:', err);
        }
    }

    /**
     * Snooze a reminder
     */
    function snooze(eventId, minutes) {
        const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
        snoozedReminders.push({ eventId, snoozeUntil: snoozeUntil.toISOString() });
        saveSnoozed();

        // Remove from fired set so it can fire again
        firedReminders.delete(eventId);
    }

    /**
     * Check if an event is currently snoozed
     */
    function isSnoozed(eventId) {
        const now = new Date();
        return snoozedReminders.some(s => {
            if (s.eventId !== eventId) return false;
            return new Date(s.snoozeUntil) > now;
        });
    }

    /**
     * Check snoozed reminders and fire if snooze time has passed
     */
    function checkSnoozed() {
        const now = new Date();
        const expired = [];
        const active = [];

        for (const s of snoozedReminders) {
            if (new Date(s.snoozeUntil) <= now) {
                expired.push(s);
            } else {
                active.push(s);
            }
        }

        if (expired.length > 0) {
            snoozedReminders = active;
            saveSnoozed();
            // The next checkReminders cycle will pick these up
        }
    }

    /**
     * Update the reminder indicator dot on an event
     */
    function updateReminderIndicator(eventId, hasReminder) {
        const items = document.querySelectorAll(`[data-event-id="${eventId}"]`);
        items.forEach(item => {
            let indicator = item.querySelector('.reminder-indicator');
            if (hasReminder && !indicator) {
                indicator = document.createElement('span');
                indicator.className = 'dot dot--water reminder-indicator';
                indicator.style.cssText = 'width:4px;height:4px;margin-left:4px;';
                item.appendChild(indicator);
            } else if (!hasReminder && indicator) {
                indicator.remove();
            }
        });
    }

    /**
     * Load snoozed reminders from localStorage
     */
    function loadSnoozed() {
        try {
            const raw = localStorage.getItem('yueli_snoozed');
            if (raw) snoozedReminders = JSON.parse(raw);
        } catch {}
    }

    /**
     * Save snoozed reminders to localStorage
     */
    function saveSnoozed() {
        try {
            localStorage.setItem('yueli_snoozed', JSON.stringify(snoozedReminders));
        } catch {}
    }

    function stop() {
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
    }

    return {
        init,
        setSessionToken,
        checkReminders,
        fireNotification,
        snooze,
        stop
    };
})();

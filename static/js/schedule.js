/* ── schedule.js ────────────────────────────────────────────
 * Personal event CRUD — agenda panel rendering
 * Shows holidays, solar terms, and personal events for selected date.
 * ─────────────────────────────────────────────────────────── */

const Schedule = (() => {
    let events = []; // decrypted events for current view
    let sessionToken = null;
    // Tracks the date range currently held in `events`.
    // `null` means the cache is empty / invalid → next showDate() must reload.
    let loadedRange = { start: null, end: null };

    function init() {
        // Session token will be set by App after unlock
    }

    /**
     * Compute the visible month range (YYYY-MM-DD) for a given date string.
     * This covers the calendar grid which typically shows leading days from
     * the previous month and trailing days from the next month.
     */
    function monthRangeFor(dateStr) {
        const d = Utils.parseDate(dateStr);
        const year = d.getFullYear();
        const month = d.getMonth();

        // First of this month — back up to Sunday (week starts on Sunday here)
        const firstOfMonth = new Date(year, month, 1);
        const start = new Date(firstOfMonth);
        start.setDate(start.getDate() - firstOfMonth.getDay()); // 0 = Sunday

        // Last of this month — forward to Saturday
        const lastOfMonth = new Date(year, month + 1, 0);
        const end = new Date(lastOfMonth);
        end.setDate(end.getDate() + (6 - lastOfMonth.getDay()));

        return {
            start: Utils.formatDateISO(start),
            end: Utils.formatDateISO(end)
        };
    }

    /**
     * Is a date string within the currently-loaded range (inclusive)?
     */
    function isInRange(dateStr) {
        return loadedRange.start && loadedRange.end &&
            dateStr >= loadedRange.start && dateStr <= loadedRange.end;
    }

    function setSessionToken(token) {
        sessionToken = token;
    }

    function getSessionToken() {
        return sessionToken;
    }

    /**
     * Show events for a given date in the agenda panel.
     * If the date falls outside the currently-loaded cache range, the events
     * for that month are reloaded from the server first (fire-and-forget).
     */
    function showDate(dateStr) {
        // Make sure the cache covers this date; reload if it doesn't.
        if (sessionToken && !isInRange(dateStr)) {
            const range = monthRangeFor(dateStr);
            loadEvents(range.start, range.end).then(() => {
                renderAgenda(dateStr);
            });
        }
        // Always re-render immediately with whatever we have (covers the
        // common case where data is already cached, plus locked-mode).
        renderAgenda(dateStr);
    }

    /**
     * Render the agenda panel for a date from the in-memory cache.
     */
    function renderAgenda(dateStr) {
        const dateEl = Utils.$('#agenda-date');
        const listEl = Utils.$('#agenda-list');
        if (!dateEl || !listEl) return;

        // Format display date with lunar info
        const date = Utils.parseDate(dateStr);
        let dateText = Utils.formatDateDisplay(date);

        // Add lunar date if available
        if (typeof LunisolarCalendar !== 'undefined') {
            const lunar = LunisolarCalendar.getLunarDisplayForDate(dateStr);
            if (lunar && lunar.dayName) {
                dateText += ` — ${lunar.monthName}${lunar.dayName}`;
            }
        }

        dateEl.textContent = dateText;

        // Build agenda items
        let html = '';

        // Holidays
        if (typeof Holidays !== 'undefined') {
            const holidays = Holidays.getForDate(dateStr);

            // Chinese holidays
            for (const h of holidays.chinese) {
                html += `
                    <div class="agenda__item agenda__item--holiday">
                        <span class="agenda__item-dot dot dot--fire"></span>
                        <span class="agenda__item-title">
                            <span class="agenda__item-name-zh">${h.name}</span>
                            <span class="agenda__item-name-en">${h.nameEn}</span>
                            ${h.lunar ? `<span class="agenda__item-lunar">${h.lunar}</span>` : ''}
                        </span>
                    </div>
                `;
            }

            // US holidays
            for (const h of holidays.us) {
                html += `
                    <div class="agenda__item agenda__item--holiday">
                        <span class="agenda__item-dot dot dot--metal"></span>
                        <span class="agenda__item-title">
                            <span class="agenda__item-name-en">${h.name}</span>
                            <span class="agenda__item-type">${h.type}</span>
                        </span>
                    </div>
                `;
            }
        }

        // Solar terms
        if (typeof SolarTerms !== 'undefined') {
            const term = SolarTerms.getForDate(dateStr);
            if (term) {
                html += `
                    <div class="agenda__item agenda__item--solar-term">
                        <span class="agenda__item-dot dot dot--earth"></span>
                        <span class="agenda__item-title">
                            <span class="agenda__item-name-zh">${term.name}</span>
                            <span class="agenda__item-name-en">${term.nameEn}</span>
                        </span>
                    </div>
                `;
            }
        }

        // Personal events (from decrypted cache)
        const dayEvents = events.filter(e => {
            return dateStr >= e.start_date && dateStr <= e.end_date;
        });

        // Sort: all-day first, then by time
        dayEvents.sort((a, b) => {
            if (a.is_all_day && !b.is_all_day) return -1;
            if (!a.is_all_day && b.is_all_day) return 1;
            return 0;
        });

        for (const evt of dayEvents) {
            const payload = evt._payload || {};
            let timeStr = '--';
            if (!evt.is_all_day) {
                const start = payload.time || '--';
                const end = payload.end_time || '';
                timeStr = end ? `${start}-${end}` : start;
            }
            const hasReminder = evt.has_reminder === 1;
            const isDue = hasReminder && evt.reminder_at && new Date(evt.reminder_at) <= new Date();
            
            html += `
                <div class="agenda__item agenda__item--personal" data-event-id="${evt.id}">
                    <span class="agenda__item-dot dot dot--wood"></span>
                    <span class="agenda__item-time">${timeStr}</span>
                    <span class="agenda__item-title">${payload.title || 'Untitled'}</span>
                    ${hasReminder ? '<span class="dot dot--water reminder-indicator" style="width:4px;height:4px;margin-left:4px;"></span>' : ''}
                </div>
            `;

            // Show snooze options if reminder is due
            if (isDue) {
                html += `
                    <div class="snooze-buttons" data-event-id="${evt.id}">
                        <button class="snooze-btn" onclick="Schedule.snoozeEvent('${evt.id}', 5)">5 min</button>
                        <button class="snooze-btn" onclick="Schedule.snoozeEvent('${evt.id}', 10)">10 min</button>
                        <button class="snooze-btn" onclick="Schedule.snoozeEvent('${evt.id}', 60)">1 hr</button>
                    </div>
                `;
            }
        }

        // Empty state
        if (!html) {
            html = '<p class="agenda__empty">No events on this date</p>';
        }

        listEl.innerHTML = html;

        // Bind click handlers on personal events
        listEl.querySelectorAll('.agenda__item--personal').forEach(item => {
            item.addEventListener('click', () => {
                const eventId = item.dataset.eventId;
                const evt = events.find(e => e.id === eventId);
                if (evt) openEditEvent(evt);
            });
        });
    }

    /**
     * Load events for a date range from the server
     */
    async function loadEvents(startDate, endDate) {
        if (!sessionToken) return;

        try {
            const res = await fetch(`/api/events?start_date=${startDate}&end_date=${endDate}`, {
                headers: { 'X-Yueli-Session': sessionToken }
            });

            if (res.status === 401) {
                // Not authenticated
                events = [];
                loadedRange = { start: null, end: null };
                return;
            }

            const data = await res.json();
            const rawEvents = data.events || [];

            // Decrypt events that have encrypted_blob
            events = [];
            for (const evt of rawEvents) {
                if (evt.encrypted_blob) {
                    try {
                        const plaintext = await Crypto.decrypt(evt.encrypted_blob);
                        const payload = JSON.parse(plaintext);
                        events.push({ ...evt, _payload: payload });
                    } catch (err) {
                        console.warn('Failed to decrypt event:', evt.id);
                        events.push({ ...evt, _payload: { title: '[encrypted]' } });
                    }
                } else {
                    // Presence-only (locked mode)
                    events.push({ ...evt, _payload: null });
                }
            }

            // Record the range we just loaded so showDate() knows the cache is valid.
            loadedRange = { start: startDate, end: endDate };
        } catch (err) {
            console.warn('Failed to load events:', err);
            events = [];
            loadedRange = { start: null, end: null };
        }
    }

    /**
     * Create a new event
     */
    async function createEvent(eventData) {
        if (!sessionToken) return null;

        try {
            // Encrypt the payload
            const payload = {
                title: eventData.title,
                description: eventData.description || '',
                time: eventData.time || null,
                end_time: eventData.end_time || null,
                category: eventData.category || 'personal',
                reminders: eventData.reminders || []
            };

            const encrypted = await Crypto.encrypt(JSON.stringify(payload));

            // Compute reminder_at timestamp
            let reminderAt = null;
            if (eventData.hasReminder && payload.reminders.length > 0) {
                const eventTime = eventData.time || '09:00';
                const [hours, minutes] = eventTime.split(':').map(Number);
                const eventDate = new Date(eventData.start_date);
                eventDate.setHours(hours, minutes, 0, 0);

                // Use the first reminder offset
                const firstReminder = payload.reminders[0];
                if (firstReminder.mode === 'before') {
                    reminderAt = new Date(eventDate.getTime() - firstReminder.offset_minutes * 60000).toISOString();
                } else {
                    reminderAt = eventDate.toISOString();
                }
            }

            const res = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Yueli-Session': sessionToken
                },
                body: JSON.stringify({
                    start_date: eventData.start_date,
                    end_date: eventData.end_date || eventData.start_date,
                    is_all_day: eventData.is_all_day || false,
                    has_reminder: eventData.hasReminder || false,
                    reminder_at: reminderAt,
                    encrypted_blob: encrypted
                })
            });

            if (!res.ok) {
                const err = await res.json();
                console.warn('Failed to create event:', err);
                return null;
            }

            const result = await res.json();

            // Reload events for the whole visible month so that other days in
            // view remain in the cache (prevents events from vanishing when
            // the user clicks between dates after a create).
            const range = monthRangeFor(eventData.start_date);
            await loadEvents(range.start, range.end);

            return result.id;
        } catch (err) {
            console.warn('Failed to create event:', err);
            return null;
        }
    }

    /**
     * Update an existing event
     */
    async function updateEvent(id, eventData) {
        if (!sessionToken) return false;

        try {
            const payload = {
                title: eventData.title,
                description: eventData.description || '',
                time: eventData.time || null,
                end_time: eventData.end_time || null,
                category: eventData.category || 'personal',
                reminders: eventData.reminders || []
            };

            const encrypted = await Crypto.encrypt(JSON.stringify(payload));

            let reminderAt = null;
            if (eventData.hasReminder && payload.reminders.length > 0) {
                const eventTime = eventData.time || '09:00';
                const [hours, minutes] = eventTime.split(':').map(Number);
                const eventDate = new Date(eventData.start_date);
                eventDate.setHours(hours, minutes, 0, 0);

                const firstReminder = payload.reminders[0];
                if (firstReminder.mode === 'before') {
                    reminderAt = new Date(eventDate.getTime() - firstReminder.offset_minutes * 60000).toISOString();
                } else {
                    reminderAt = eventDate.toISOString();
                }
            }

            const res = await fetch(`/api/events/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Yueli-Session': sessionToken
                },
                body: JSON.stringify({
                    start_date: eventData.start_date,
                    end_date: eventData.end_date || eventData.start_date,
                    is_all_day: eventData.is_all_day || false,
                    has_reminder: eventData.hasReminder || false,
                    reminder_at: reminderAt,
                    encrypted_blob: encrypted
                })
            });

            if (!res.ok) {
                const err = await res.json();
                console.warn('Failed to update event:', err);
                return false;
            }

            // Reload events for the whole visible month (see createEvent).
            const range = monthRangeFor(eventData.start_date);
            await loadEvents(range.start, range.end);
            return true;
        } catch (err) {
            console.warn('Failed to update event:', err);
            return false;
        }
    }

    /**
     * Delete an event
     */
    async function deleteEvent(id) {
        if (!sessionToken) return false;

        try {
            const res = await fetch(`/api/events/${id}`, {
                method: 'DELETE',
                headers: { 'X-Yueli-Session': sessionToken }
            });

            if (!res.ok) {
                const err = await res.json();
                console.warn('Failed to delete event:', err);
                return false;
            }

            // Remove from local cache
            events = events.filter(e => e.id !== id);
            // Invalidate the range cache so the next showDate() reloads from
            // the server — prevents other dates from showing stale data.
            loadedRange = { start: null, end: null };
            return true;
        } catch (err) {
            console.warn('Failed to delete event:', err);
            return false;
        }
    }

    /**
     * Open new event modal
     */
    function openNewEvent(dateStr) {
        const modal = Utils.$('#modal-event');
        const title = Utils.$('#event-title');
        const dateInput = Utils.$('#event-date');
        const endDateInput = Utils.$('#event-end-date');
        const allDayInput = Utils.$('#event-all-day');
        const timeInput = Utils.$('#event-time');
        const timeRow = Utils.$('#event-time-row');
        const descriptionInput = Utils.$('#event-description');

        if (!modal) return;

        // Reset form
        if (title) title.value = '';
        if (dateInput) dateInput.value = dateStr || Utils.todayISO();
        if (endDateInput) endDateInput.value = dateStr || Utils.todayISO();
        if (allDayInput) allDayInput.checked = false;
        if (timeInput) timeInput.value = '09:00';
        if (timeRow) timeRow.style.display = 'flex';
        if (descriptionInput) descriptionInput.value = '';

        // Store mode
        modal.dataset.mode = 'new';
        modal.dataset.eventId = '';

        modal.hidden = false;
        modal.querySelector('.modal__card').classList.add('modal-enter');
    }

    /**
     * Open edit event modal
     */
    function openEditEvent(evt) {
        const modal = Utils.$('#modal-event');
        const title = Utils.$('#event-title');
        const dateInput = Utils.$('#event-date');
        const endDateInput = Utils.$('#event-end-date');
        const allDayInput = Utils.$('#event-all-day');
        const timeInput = Utils.$('#event-time');
        const timeRow = Utils.$('#event-time-row');
        const descriptionInput = Utils.$('#event-description');

        if (!modal) return;

        const payload = evt._payload || {};

        // Fill form
        if (title) title.value = payload.title || '';
        if (dateInput) dateInput.value = evt.start_date;
        if (endDateInput) endDateInput.value = evt.end_date;
        if (allDayInput) allDayInput.checked = evt.is_all_day === 1;
        if (timeInput) timeInput.value = payload.time || '09:00';
        if (timeRow) timeRow.style.display = evt.is_all_day ? 'none' : 'flex';
        
        const endTimeInput = Utils.$('#event-end-time');
        const endTimeRow = Utils.$('#event-end-time-row');
        if (endTimeInput) endTimeInput.value = payload.end_time || payload.time || '10:00';
        if (endTimeRow) endTimeRow.style.display = evt.is_all_day ? 'none' : 'flex';
        
        if (descriptionInput) descriptionInput.value = payload.description || '';

        // Set reminder value
        const reminderSelect = Utils.$('#event-reminder');
        if (reminderSelect) {
            if (payload.reminders && payload.reminders.length > 0) {
                const firstReminder = payload.reminders[0];
                if (firstReminder.mode === 'at_time') {
                    reminderSelect.value = '0';
                } else {
                    reminderSelect.value = firstReminder.offset_minutes.toString();
                }
            } else {
                reminderSelect.value = 'none';
            }
        }

        // Store mode
        modal.dataset.mode = 'edit';
        modal.dataset.eventId = evt.id;

        modal.hidden = false;
        modal.querySelector('.modal__card').classList.add('modal-enter');
    }

    /**
     * Save event (create or update based on modal mode)
     */
    async function saveEvent() {
        const modal = Utils.$('#modal-event');
        if (!modal) return;

        const mode = modal.dataset.mode;
        const eventId = modal.dataset.eventId;

        const title = Utils.$('#event-title')?.value?.trim();
        const date = Utils.$('#event-date')?.value;
        const endDate = Utils.$('#event-end-date')?.value;
        const isAllDay = Utils.$('#event-all-day')?.checked;
        const time = Utils.$('#event-time')?.value;
        const endTime = Utils.$('#event-end-time')?.value;
        const description = Utils.$('#event-description')?.value?.trim();
        const reminderValue = Utils.$('#event-reminder')?.value;

        if (!title || !date) {
            alert('Title and date are required');
            return;
        }

        const hasReminder = reminderValue && reminderValue !== 'none';
        const reminders = hasReminder ? [{ offset_minutes: parseInt(reminderValue), mode: 'before' }] : [];

        const eventData = {
            title,
            description,
            start_date: date,
            end_date: endDate || date,
            is_all_day: isAllDay,
            time: isAllDay ? null : time,
            end_time: isAllDay ? null : endTime,
            hasReminder,
            reminders,
            category: 'personal'
        };

        let success = false;
        if (mode === 'edit' && eventId) {
            success = await updateEvent(eventId, eventData);
        } else {
            const newId = await createEvent(eventData);
            success = !!newId;
        }

        if (success) {
            closeEventModal();
            // Refresh the agenda
            showDate(date);
            // Refresh calendar dots
            if (typeof GregorianCalendar !== 'undefined') GregorianCalendar.render();
            if (typeof LunisolarCalendar !== 'undefined') LunisolarCalendar.render();
        }
    }

    /**
     * Close event modal
     */
    function closeEventModal() {
        const modal = Utils.$('#modal-event');
        if (modal) modal.hidden = true;
    }

    /**
     * Get all events (for calendar dot rendering)
     */
    function getEvents() {
        return events;
    }

    /**
     * Snooze a reminder for an event
     */
    function snoozeEvent(eventId, minutes) {
        if (typeof Reminders !== 'undefined') {
            Reminders.snooze(eventId, minutes);
        }
    }

    return {
        init,
        setSessionToken,
        getSessionToken,
        showDate,
        loadEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        openNewEvent,
        openEditEvent,
        saveEvent,
        closeEventModal,
        getEvents,
        snoozeEvent
    };
})();

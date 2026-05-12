/**
 * Format date to readable string
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Parse user date input (supports "today", "yesterday", or YYYY-MM-DD)
 * @param {string} input
 * @returns {string|null} ISO date string or null if invalid
 */
export function parseDate(input) {
    input = input.trim().toLowerCase();

    if (input === 'today') {
        return new Date().toISOString().split('T')[0];
    }

    if (input === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    // Validate YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(input)) {
        const date = new Date(input);
        if (!isNaN(date.getTime())) {
            return input;
        }
    }

    return null;
}

/**
 * Extract phone number from any WhatsApp JID.
 * Works with @s.whatsapp.net, @c.us, @lid — all of them.
 * The phone number is ALWAYS the part before the @.
 * @param {string} jid
 * @returns {string|null}
 */
export function extractPhone(jid) {
    if (!jid) return null;
    const number = jid.split('@')[0];       // strip @s.whatsapp.net, @lid, etc.
    return number.replace(/[^0-9]/g, '');   // strip any non-digit characters (e.g. device suffix :15)
}

/**
 * Check if a JID belongs to an admin defined in ADMIN_NUMBERS env var.
 * @param {string} jid - Raw JID from WhatsApp
 * @returns {boolean}
 */
export function isAdminJid(jid) {
    const phone = extractPhone(jid);
    if (!phone) return false;
    const admins = (process.env.ADMIN_NUMBERS || '').split(',').map(n => n.trim().replace(/[^0-9]/g, ''));
    return admins.includes(phone);
}

/**
 * Normalize phone number to WhatsApp JID format
 * @param {string} phone - Raw phone number string
 * @returns {string}
 */
export function normalizePhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/[^0-9]/g, '');
    return digits + '@s.whatsapp.net';
}



/**
 * Sleep for specified milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format number with commas
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Calculate conversion rate
 * @param {number} conversions
 * @param {number} reached
 * @returns {string}
 */
export function calculateConversionRate(conversions, reached) {
    if (reached === 0) return '0.00%';
    return ((conversions / reached) * 100).toFixed(2) + '%';
}

/**
 * Get month name from date
 * @param {string|Date} date
 * @returns {string}
 */
export function getMonthName(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get report range (1st to last day of previous month)
 * @param {Date} [baseDate] - Date to calculate from (defaults to now)
 * @returns {{start: string, end: string}}
 */
export function getPreviousMonthRange(baseDate = null) {
    const now = baseDate ? new Date(baseDate) : new Date();

    let year = now.getFullYear();
    let month = now.getMonth() - 1;

    if (month < 0) {
        month = 11;
        year--;
    }

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    const fmt = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    return {
        start: fmt(year, month, 1),
        end: fmt(year, month, end.getDate())
    };
}

/**
 * Format the period name for the date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {string} e.g. "January 10 - February 9, 2026"
 */
export function getPeriodName(startDate, endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);

    const startStr = s.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const endStr = e.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return `${startStr} - ${endStr}`;
}

/**
 * Get previous day date range (yesterday)
 * @returns {{start: string, end: string}}
 */
export function getPreviousDayRange() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = yesterday.toISOString().split('T')[0];

    return {
        start: dateStr,
        end: dateStr
    };
}

/**
 * Format a YYYY-MM-DD date as a human-readable calendar date
 * e.g. "2026-02-28" → "Saturday, 28 February 2026"
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {string}
 */
export function formatCalendarDate(dateStr) {
    // Parse as UTC to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    });
}

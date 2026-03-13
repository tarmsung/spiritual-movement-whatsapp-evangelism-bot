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
 * Normalize phone number to WhatsApp format
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
    // Remove all non-digits
    phone = phone.replace(/\D/g, '');

    // Add @s.whatsapp.net if not present
    if (!phone.includes('@')) {
        phone = phone + '@s.whatsapp.net';
    }

    return phone;
}

/**
 * Extract phone number from WhatsApp JID
 * @param {string} jid
 * @returns {string}
 */
export function extractPhone(jid) {
    if (!jid) return '';
    // Handle formats like 263772123456@s.whatsapp.net, @g.us, @lid
    return jid.replace(/@s\.whatsapp\.net|@g\.us|@lid|@c\.us/, '').split(':')[0];
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
 * Get report range (10th of previous month to 9th of current month)
 * @param {Date} [baseDate] - Date to calculate from (defaults to now)
 * @returns {{start: string, end: string}}
 */
export function get10thTo9thRange(baseDate = null) {
    const now = baseDate ? new Date(baseDate) : new Date();

    // If the base date is before the 10th, it belongs to the previous cycle.
    // E.g., March 5th implies the "Jan 10 - Feb 9" cycle.
    // E.g., March 15th implies the "Feb 10 - March 9" cycle.
    const isPast10th = now.getDate() >= 10;

    // Current month of the cycle (the month the cycle Ends in)
    let endYear = now.getFullYear();
    let endMonth = isPast10th ? now.getMonth() : now.getMonth() - 1;

    if (endMonth < 0) {
        endMonth = 11;
        endYear--;
    }

    // Previous month of the cycle (the month the cycle Starts in)
    let startYear = endYear;
    let startMonth = endMonth - 1;

    if (startMonth < 0) {
        startMonth = 11;
        startYear--;
    }

    // Start: 10th of previous month
    const start = new Date(startYear, startMonth, 10);
    // End: 9th of current month
    const end = new Date(endYear, endMonth, 9);

    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

/**
 * Format the period name for the 10th to 9th cycle
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

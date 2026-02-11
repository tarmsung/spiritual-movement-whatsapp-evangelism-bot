/**
 * Format date to readable string
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
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
    return jid.split('@')[0];
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
 * Get previous month date range
 * @returns {{start: string, end: string}}
 */
export function getPreviousMonthRange() {
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

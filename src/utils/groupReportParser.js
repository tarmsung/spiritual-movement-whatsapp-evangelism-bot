/**
 * Group Report Parser
 * Parses structured evangelism reports from group messages
 * Supports flexible keyword formats that real users type
 */

/**
 * Strip WhatsApp formatting characters (* for bold, _ for italic, ~ for strikethrough)
 * e.g. "*Evangelism Report*" → "Evangelism Report"
 */
function stripWhatsAppFormatting(text) {
    return text.replace(/[*_~]/g, '');
}

/**
 * Check if message is an evangelism report
 * Matches: "Evangelism Report", "EVANGELISM REPORT", "evangelism report", etc.
 * @param {string} messageText - The message to check
 * @returns {boolean}
 */
export function isEvangelismReport(messageText) {
    if (!messageText) return false;
    const cleaned = stripWhatsAppFormatting(messageText).trim().toUpperCase();
    return cleaned.startsWith('EVANGELISM REPORT');
}

/**
 * Keyword definitions with multiple aliases per field.
 * Each alias can use ":" or "=" as separator in the actual message.
 * Order matters — fields are matched top-to-bottom,
 * and a field's value runs until the next matched keyword.
 */
const FIELD_ALIASES = [
    {
        field: 'activity_date',
        aliases: ['Date']
    },
    {
        field: 'location',
        aliases: ['Location', 'Place', 'Venue']
    },
    {
        field: 'area',
        aliases: ['Area', 'Neighbourhood', 'Neighborhood']
    },
    {
        field: 'city',
        aliases: ['City', 'Town']
    },
    {
        field: 'activity_type',
        aliases: ['Type of Activity', 'Activity Type', 'Type of Evangelism', 'Activity', 'Type']
    },
    {
        field: 'preachers_team',
        aliases: ['Preacher(s) Team', 'Preachers Team', 'Preacher', 'Preachers', 'Team', 'Minister', 'Ministers']
    },
    {
        field: 'message_summary',
        aliases: ['Message Summary', 'Message summary', 'Summary', 'Message']
    },
    {
        field: 'response_moments',
        aliases: ['Response/Notable Moments', 'Notable Moments', 'Notable moments', 'Response', 'Moments', 'Highlights']
    },
    {
        field: 'saved',
        aliases: ['Saved', 'Converts', 'Convert', 'Souls Won', 'Souls']
    },
    {
        field: 'healed',
        aliases: ['Healed', 'Healing', 'Sick prayed for', 'Sick Prayed For', 'Prayed for', 'Sick']
    },
    {
        field: 'reporter_name',
        aliases: ['Reporter', 'Reported by', 'Submitted by', 'Name']
    }
];

/**
 * Build a regex pattern for a single alias.
 * Matches the alias followed by : or = (with optional surrounding whitespace).
 * Example: "Converts" matches "Converts:", "Converts=", "Converts :", etc.
 */
function buildAliasPattern(alias) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `${escaped}\\s*[=:]`;
}

/**
 * Build a combined regex for all aliases of a field.
 * Returns a case-insensitive regex that matches any of the aliases.
 */
function buildFieldRegex(fieldDef) {
    const patterns = fieldDef.aliases.map(buildAliasPattern);
    return new RegExp(`(?:${patterns.join('|')})`, 'i');
}

/**
 * Parse evangelism report from group message
 * @param {string} messageText - The message text
 * @returns {Object} Parsed report data
 */
export function parseReport(messageText) {
    // Strip WhatsApp formatting before parsing
    messageText = stripWhatsAppFormatting(messageText);
    const report = {};

    // Find all keyword matches with their positions
    const matches = [];
    for (const fieldDef of FIELD_ALIASES) {
        const regex = buildFieldRegex(fieldDef);
        const match = messageText.match(regex);

        if (match) {
            matches.push({
                field: fieldDef.field,
                matchStart: match.index,
                valueStart: match.index + match[0].length
            });
        }
    }

    // Sort matches by position in the message
    matches.sort((a, b) => a.matchStart - b.matchStart);

    // Extract values — each value runs from after the keyword to the next keyword (or end of message)
    for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const nextStart = (i + 1 < matches.length) ? matches[i + 1].matchStart : messageText.length;

        let value = messageText.substring(current.valueStart, nextStart).trim();

        // Clean up extra whitespace but preserve meaningful line breaks for multi-line fields
        value = value.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

        // Convert number fields
        if (current.field === 'saved' || current.field === 'healed') {
            const num = parseInt(value);
            value = isNaN(num) ? 0 : num;
        }

        // Convert date format
        if (current.field === 'activity_date') {
            value = convertDateFormat(value);
        }

        report[current.field] = value;
    }

    // Ensure preachers_team has a fallback (DB requires NOT NULL)
    if (!report.preachers_team || (typeof report.preachers_team === 'string' && report.preachers_team.trim() === '')) {
        report.preachers_team = report.reporter_name || 'Not specified';
    }

    return report;
}

/**
 * Convert date from DD/MM/YYYY to YYYY-MM-DD
 * Also handles: DD-MM-YYYY, DD.MM.YYYY, "today", "yesterday"
 * @param {string} dateStr - Date string
 * @returns {string|null} Date in YYYY-MM-DD format or null if invalid
 */
function convertDateFormat(dateStr) {
    if (!dateStr) return null;

    const lower = dateStr.toLowerCase().trim();
    const today = new Date();

    if (lower === 'today') {
        return today.toISOString().split('T')[0];
    }

    if (lower === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    // Try to parse DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
    const parts = dateStr.trim().split(/[\/\-\.]/);
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);

        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000) {
            const paddedDay = day.toString().padStart(2, '0');
            const paddedMonth = month.toString().padStart(2, '0');
            return `${year}-${paddedMonth}-${paddedDay}`;
        }
    }

    return null;
}

/**
 * Validate parsed report
 * @param {Object} report - Parsed report data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateParsedReport(report) {
    const errors = [];

    // Required fields
    const requiredFields = [
        { field: 'activity_date', name: 'Date' },
        { field: 'location', name: 'Location' },
        { field: 'activity_type', name: 'Type of Activity' },
        { field: 'message_summary', name: 'Message Summary' }
    ];

    for (const { field, name } of requiredFields) {
        if (!report[field] && report[field] !== 0) {
            errors.push(`Missing required field: ${name}`);
        } else if (typeof report[field] === 'string' && report[field].trim() === '') {
            errors.push(`Empty required field: ${name}`);
        }
    }

    // Validate date format
    if (report.activity_date && !report.activity_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        errors.push('Invalid date format. Use DD/MM/YYYY (e.g. 10/02/2026)');
    }

    // Validate numbers
    if (report.saved !== undefined && typeof report.saved !== 'number') {
        errors.push('Saved must be a number');
    }

    if (report.healed !== undefined && typeof report.healed !== 'number') {
        errors.push('Healed must be a number');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

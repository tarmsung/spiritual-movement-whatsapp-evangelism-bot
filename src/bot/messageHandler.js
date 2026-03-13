import config from '../config/config.js';
import logger from '../utils/logger.js';
import { handleGroupMessage } from './groupMessageHandler.js';
import { getUpcomingEvents, getNextEvent } from '../database/db.js';
import { formatCalendarDate } from '../utils/helpers.js';

/**
 * Main message handler
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {string} messageText - Message text content
 */
export async function handleMessage(sock, msg, messageText) {
    const userJid = msg.key.remoteJid;
    const isGroup = userJid.endsWith('@g.us');

    logger.info(`[DEBUG] handleMessage started. JID: ${userJid}, Text: ${messageText}`);

    // Route group messages to group handler
    if (isGroup) {
        await handleGroupMessage(sock, msg, messageText);
        return;
    }

    // DM Functionality gracefully disabled
    logger.info(`[DM] Ignoring DM from ${userJid} as DM functionality is currently disabled.`);
    
    // Optionally alert the user (commented out for complete silence)
    // await sock.sendMessage(userJid, { text: "🚧 Direct Messaging with the bot is currently disabled for maintenance." });
}


/**
 * Send upcoming events list for a specific month
 */
export async function sendUpcomingEvents(sock, jid, monthArg = null) {
    try {
        if (!monthArg) {
            await sock.sendMessage(jid, {
                text: '📅 Please specify a month to view events.\n\n*Example:* `!events March` or `!events 3`'
            });
            return;
        }

        const events = await getUpcomingEvents(15, monthArg);
        if (!events || events.length === 0) {
            const timeFrame = monthArg ? `in ${monthArg.toUpperCase()}` : 'upcoming';
            await sock.sendMessage(jid, { text: `📅 No ${timeFrame} events found.` });
            return;
        }

        const headerTitle = monthArg ? `UPCOMING CHURCH EVENTS — ${monthArg.toUpperCase()}` : 'UPCOMING CHURCH EVENTS';

        let msg = `🗓️ *${headerTitle}*\n`;
        msg += '────────────────────\n\n';

        for (const event of events) {
            msg += `**${event.name}**\n`;
            msg += `🔸 ${formatCalendarDate(event.event_date)}\n\n`;
        }

        msg += '────────────────────\n';
        msg += '_God bless your attendance!_ 🙏';

        await sock.sendMessage(jid, { text: msg });
    } catch (error) {
        await sock.sendMessage(jid, { text: '❌ Could not load events. Please try again later.' });
    }
}

/**
 * Send next single event
 */
export async function sendNextEvent(sock, jid) {
    try {
        const event = await getNextEvent();
        if (!event) {
            await sock.sendMessage(jid, { text: '📅 No upcoming events found.' });
            return;
        }

        let msg = '🗓️ *NEXT UPCOMING EVENT*\n';
        msg += '────────────────────\n\n';
        msg += `**${event.name}**\n`;
        msg += `🔸 ${formatCalendarDate(event.event_date)}\n\n`;
        msg += '────────────────────\n';
        msg += '_God bless your attendance!_ 🙏';

        await sock.sendMessage(jid, { text: msg });
    } catch (error) {
        await sock.sendMessage(jid, { text: '❌ Could not load the next event. Please try again later.' });
    }
}

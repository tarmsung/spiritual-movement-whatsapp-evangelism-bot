import logger from '../utils/logger.js';
import { handleGroupMessage } from './groupMessageHandler.js';
import { extractPhone, isAdminJid } from '../utils/helpers.js';
import { getUpcomingEvents, getNextEvent } from '../database/db.js';
import { formatCalendarDate } from '../utils/helpers.js';

/**
 * Main message handler - entry point for all incoming messages
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {string} messageText - Message text content
 */
export async function handleMessage(sock, msg, messageText) {
    const remoteJid = msg.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');

    // Route group messages to dedicated group handler
    if (isGroup) {
        await handleGroupMessage(sock, msg, messageText);
        return;
    }

    // --- DM Handling ---
    const senderJid = remoteJid; // for DMs, the remoteJid IS the sender
    const phone = extractPhone(senderJid);
    const adminAccess = isAdminJid(senderJid);

    logger.info(`[DM] Message from ${phone} (admin: ${adminAccess}): ${messageText}`);

    if (adminAccess) {
        await handleAdminDm(sock, senderJid, messageText);
    } else {
        await handlePublicDm(sock, senderJid, messageText);
    }
}

/**
 * Handle DM from an admin user (listed in ADMIN_NUMBERS)
 */
async function handleAdminDm(sock, jid, messageText) {
    const text = messageText.trim().toLowerCase();

    // TODO: Add admin menu here
    await sock.sendMessage(jid, {
        text: `👋 Welcome Admin!\n\n🔧 *Admin Menu coming soon.*\n\nYour phone: ${extractPhone(jid)}`
    });
}

/**
 * Handle DM from a non-admin user
 */
async function handlePublicDm(sock, jid, messageText) {
    const text = messageText.trim().toLowerCase();

    // TODO: Add public member menu here
    await sock.sendMessage(jid, {
        text: `👋 Hello!\n\nThis bot is used for managing church evangelism reports.\n\nPlease use the group to submit your report. 🙏`
    });
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
            msg += `*${event.name}*\n`;
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
        msg += `*${event.name}*\n`;
        msg += `🔸 ${formatCalendarDate(event.event_date)}\n\n`;
        msg += '────────────────────\n';
        msg += '_God bless your attendance!_ 🙏';

        await sock.sendMessage(jid, { text: msg });
    } catch (error) {
        await sock.sendMessage(jid, { text: '❌ Could not load the next event. Please try again later.' });
    }
}

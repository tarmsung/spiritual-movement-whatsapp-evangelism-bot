import config from '../config/config.js';
import logger from '../utils/logger.js';
import { startReportForm, processFormResponse, hasActiveForm } from '../forms/reportForm.js';
import { handleGroupMessage } from './groupMessageHandler.js';
import { hasActiveTestReport, startTestReport, processTestReportResponse } from './testReportHandler.js';
import { getUpcomingEvents, getNextEvent, isAdmin } from '../database/db.js';
import { handleDmMenu } from './menus/dmMenuHandler.js';

import { formatCalendarDate, extractPhone, getCleanPhone } from '../utils/helpers.js';
import { store } from './connection.js';

/**
 * Resolves a JID to a phone number using store and network lookups
 * @param {string} jid - User's JID
 * @param {Object} sock - WhatsApp socket
 * @returns {Promise<string|null>} - Resolved phone number (digits) or null
 */
export async function resolvePhone(jid, sock) {
    // 1. Already a phone JID
    if (jid?.endsWith('@s.whatsapp.net') || jid?.endsWith('@c.us')) {
        return getCleanPhone(jid);
    }

    // 2. Try store contact lookup for @lid
    if (jid?.endsWith('@lid')) {
        logger.debug(`[AUTH] Attempting store resolution for LID: ${jid}`);
        const contacts = store?.contacts || {};
        for (const [phoneJid, contact] of Object.entries(contacts)) {
            if (contact.lid === jid) {
                logger.info(`[AUTH] Resolved LID ${jid} to phone via store: ${phoneJid}`);
                return getCleanPhone(phoneJid);
            }
        }

        // 3. Try fetching contact info directly from WhatsApp
        try {
            logger.debug(`[AUTH] Attempting network resolution for LID: ${jid}`);
            const [result] = await sock.onWhatsApp(jid);
            if (result?.exists && result?.jid) {
                logger.info(`[AUTH] Resolved LID ${jid} to phone via network: ${result.jid}`);
                return getCleanPhone(result.jid);
            }
        } catch (e) {
            logger.warn(`[AUTH] Network resolution failed for ${jid}: ${e.message}`);
        }
    }

    return null; // Unresolvable
}

/**
 * Check if a user is authorized (Admin only for now)
 * @param {string} resolvedPhone - Cleaned phone number digits
 * @returns {Promise<boolean>}
 */
async function checkAuthorization(resolvedPhone) {
    if (!resolvedPhone) return false;

    // Normalize admin numbers from config (.env) for comparison
    const cleanAdminNumbers = config.adminNumbers.map(n => getCleanPhone(n));
    
    // Check against Admin Numbers
    const isAuthorized = cleanAdminNumbers.includes(resolvedPhone);
    
    if (!isAuthorized) {
        logger.warn(`[AUTH] Authorization failed for "${resolvedPhone}". Not in ${JSON.stringify(cleanAdminNumbers)}`);
    }

    return isAuthorized;
}

/**
 * Main message handler
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {string} messageText - Message text content
 */
export async function handleMessage(sock, msg, messageText) {
    const userJid = msg.key.remoteJid;
    const isGroup = userJid.endsWith('@g.us');

    // Route group messages to group handler
    if (isGroup) {
        await handleGroupMessage(sock, msg, messageText);
        return;
    }

    // Resolve LID to phone if necessary
    const resolvedPhone = await resolvePhone(userJid, sock);
    
    if (!resolvedPhone) {
        logger.warn(`[AUTH] Could not resolve identity for ${userJid}`);
        await sock.sendMessage(userJid, { text: "🚫 Access Denied: Unresolvable identity." });
        return;
    }

    const isAuthorized = await checkAuthorization(resolvedPhone);

    if (!isAuthorized) {
        logger.warn(`[AUTH] Unauthorized DM attempt from ${resolvedPhone} (JID: ${userJid})`);
        await sock.sendMessage(userJid, { text: "🚫 You are not authorised." });
        return;
    }

    logger.info(`Message from ${userJid}: ${messageText}`);

    // Check if user has an active test report session
    if (hasActiveTestReport(userJid)) {
        await processTestReportResponse(sock, userJid, messageText);
        return;
    }

    // Check for wake phrase ('evangelism') in DM - gently block
    const normalizedMessage = messageText.trim().toLowerCase();
    if (normalizedMessage === 'evangelism') {
        await sock.sendMessage(userJid, {
            text: '🚫❌ Evangelism reports cannot be submitted via DM.\n\n📢 Please use the group to submit your report! 🙏'
        });
        return;
    }

    // Determine admin status specifically for menu routing (admins get Executor menu)
    const isUserAdmin = await isAdmin(resolvedPhone);

    // Route EVERYTHING else in DMs to the modern DM menu system
    await handleDmMenu(sock, msg, userJid, messageText, isUserAdmin);
}

/**
 * Send help message
 */
async function sendHelpMessage(sock, userJid) {
    let helpText = `📖 EVANGELISM REPORTER BOT\n\n`;
    helpText += `Welcome to ${config.churchName}'s Evangelism Reporter!\n\n`;
    helpText += `*COMMANDS:*\n`;
    helpText += `evangelism - Start new evangelism report\n`;
    helpText += `!events - View upcoming church events\n`;
    helpText += `!next - View the next upcoming event\n`;
    helpText += `testreport - Generate a test report\n`;
    helpText += `!help - Show this help message\n`;
    helpText += `cancel - Cancel current form (during filling)\n\n`;
    helpText += `*HOW IT WORKS:*\n`;
    helpText += `1. Send "evangelism" to begin\n`;
    helpText += `2. Answer the questions step by step\n`;
    helpText += `3. Review and confirm your report\n`;
    helpText += `4. Your report is automatically posted to your assembly group\n\n`;
    helpText += `All reports are stored and analyzed for monthly summaries.\n\n`;
    helpText += `God bless your evangelism efforts! 🙏`;

    await sock.sendMessage(userJid, { text: helpText });
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

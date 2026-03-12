import config from '../config/config.js';
import logger from '../utils/logger.js';
import { startReportForm, processFormResponse, hasActiveForm } from '../forms/reportForm.js';
import { handleGroupMessage } from './groupMessageHandler.js';
import { hasActiveTestReport, startTestReport, processTestReportResponse } from './testReportHandler.js';
import { getUpcomingEvents, getNextEvent, isAdmin } from '../database/db.js';
import { handleDmMenu } from './menus/dmMenuHandler.js';

import { formatCalendarDate, extractPhone } from '../utils/helpers.js';

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

    logger.info(`Message from ${userJid}: ${messageText}`);

    // Check if user has an active test report session (this runs independently of the DM menu)
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

    // Determine admin status
    const phone = extractPhone(userJid);
    const isUserAdmin = await isAdmin(phone);

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

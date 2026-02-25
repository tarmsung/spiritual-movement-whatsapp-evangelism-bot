import config from '../config/config.js';
import logger from '../utils/logger.js';
import { startReportForm, processFormResponse, hasActiveForm } from '../forms/reportForm.js';
import { handleGroupMessage } from './groupMessageHandler.js';
import { hasActiveTestReport, startTestReport, processTestReportResponse } from './testReportHandler.js';
import { getUpcomingEvents, getNextEvent } from '../database/db.js';
import { formatCalendarDate } from '../utils/helpers.js';
import { sendEventReminders } from '../services/scheduler.js';

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

    // Check if user has an active test report session
    if (hasActiveTestReport(userJid)) {
        await processTestReportResponse(sock, userJid, messageText);
        return;
    }

    // Check if user has an active form
    if (await hasActiveForm(userJid)) {
        await processFormResponse(sock, userJid, messageText);
        return;
    }

    // Check for wake phrase ('evangelism')
    const normalizedMessage = messageText.trim().toLowerCase();

    if (normalizedMessage === 'evangelism') {
        await sock.sendMessage(userJid, {
            text: '🚫❌ Evangelism reports cannot be submitted via DM.\n\n📢 Please use the group to submit your report! 🙏'
        });
        return;
    }

    // Help command
    if (normalizedMessage === '!help' || normalizedMessage === 'help') {
        await sendHelpMessage(sock, userJid);
        return;
    }

    // Events command (can include a month, e.g. "!events march")
    if (normalizedMessage.startsWith('!events') || normalizedMessage.startsWith('events')) {
        // Extract month argument if present
        const parts = normalizedMessage.split(' ');
        const monthArg = parts.length > 1 ? parts[1] : null;
        await sendUpcomingEvents(sock, userJid, monthArg);
        return;
    }

    // Run test reminder command
    if (normalizedMessage === 'runtest' || normalizedMessage === '!runtest') {
        await sock.sendMessage(userJid, { text: '⚙️ Running event reminders test (1-minute delayed batch)...' });
        await sendEventReminders(true); // true = strictly test events
        return;
    }

    // Next event command
    if (normalizedMessage === '!next' || normalizedMessage === 'next event') {
        await sendNextEvent(sock, userJid);
        return;
    }

    // Test report command
    if (normalizedMessage === 'testreport' || normalizedMessage === '!testreport') {
        await startTestReport(sock, userJid);
        return;
    }

    // Unknown command - send gentle reminder
    if (normalizedMessage.startsWith('!')) {
        await sock.sendMessage(userJid, {
            text: `I don't recognize that command. Send "evangelism" to start an evangelism report, or send "!help" for assistance.`
        });
    }
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

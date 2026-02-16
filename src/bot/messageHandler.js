import config from '../config/config.js';
import logger from '../utils/logger.js';
import { startReportForm, processFormResponse, hasActiveForm } from '../forms/reportForm.js';
import { handleGroupMessage } from './groupMessageHandler.js';
import { hasActiveTestReport, startTestReport, processTestReportResponse } from './testReportHandler.js';

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
        await startReportForm(sock, userJid);
        return;
    }

    // Help command
    if (normalizedMessage === '!help' || normalizedMessage === 'help') {
        await sendHelpMessage(sock, userJid);
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
    helpText += `**COMMANDS:**\n`;
    helpText += `evangelism - Start new evangelism report\n`;
    helpText += `testreport - Generate a test report for a specific cluster & month\n`;
    helpText += `!help - Show this help message\n`;
    helpText += `cancel - Cancel current form (during filling)\n\n`;
    helpText += `**HOW IT WORKS:**\n`;
    helpText += `1. Send "evangelism" to begin\n`;
    helpText += `2. Answer the questions step by step\n`;
    helpText += `3. Review and confirm your report\n`;
    helpText += `4. Your report is automatically posted to your assembly group\n\n`;
    helpText += `All reports are stored and analyzed for monthly summaries.\n\n`;
    helpText += `God bless your evangelism efforts! 🙏`;

    await sock.sendMessage(userJid, { text: helpText });
}

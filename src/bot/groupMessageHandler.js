import { isEvangelismReport, parseReport, validateParsedReport } from '../utils/groupReportParser.js';
import { getAssemblyByGroupJid, createGroupReport } from '../database/db.js';
import { sendUpcomingEvents, sendNextEvent } from './messageHandler.js';
import { extractPhone } from '../utils/helpers.js';
import logger from '../utils/logger.js';

/**
 * Handle group messages for evangelism reports
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {string} messageText - Message text
 */
export async function handleGroupMessage(sock, msg, messageText) {
    const groupJid = msg.key.remoteJid;
    const senderJid = msg.key.participant || msg.participant;

    // Ignore messages sent by the bot itself
    if (msg.key.fromMe) {
        return;
    }

    logger.info(`[GROUP] Message received in group: ${groupJid} from: ${senderJid}`);

    const normalizedText = messageText.trim().toLowerCase();

    // Handle calendar commands from group
    if (normalizedText.startsWith('!events') || normalizedText.startsWith('events')) {
        // Extract month argument if present
        const parts = normalizedText.split(' ');
        const monthArg = parts.length > 1 ? parts[1] : null;
        await sendUpcomingEvents(sock, groupJid, monthArg);
        return;
    }

    if (normalizedText === '!next' || normalizedText === 'next event') {
        await sendNextEvent(sock, groupJid);
        return;
    }


    // Check if this is an evangelism report
    // NOTE: Group commands like !events and !next remain open to all members.
    // Only the submission of evangelism reports is restricted by supervisor status if needed.
    if (!isEvangelismReport(messageText)) {
        logger.info(`[GROUP] Not an evangelism report, ignoring.`);
        return;
    }

    logger.info(`[GROUP] Detected evangelism report in group: ${groupJid}`);

    try {
        // Parse the report
        const parsedReport = parseReport(messageText);
        logger.info(`[GROUP] Parsed report:`, JSON.stringify(parsedReport));

        // Validate the parsed data
        const validation = validateParsedReport(parsedReport);

        if (!validation.valid) {
            logger.warn(`[GROUP] Invalid evangelism report from ${senderJid}:`, validation.errors);

            // Optionally send error message to group
            const errorMsg = `❌ *Evangelism Report Error* @${extractPhone(senderJid)}\n\n` +
                `The report could not be saved due to the following issues:\n` +
                validation.errors.map(err => `• ${err}`).join('\n') +
                `\n\n_Please check the format and try again._`;

            await sock.sendMessage(groupJid, {
                text: errorMsg,
                mentions: [senderJid]
            });
            return;
        }

        // Get assembly for this group
        const assembly = await getAssemblyByGroupJid(groupJid);
        logger.info(`[GROUP] Assembly lookup for ${groupJid}: ${assembly ? assembly.name : 'NOT FOUND'}`);

        if (!assembly) {
            logger.warn(`[GROUP] No assembly found for group: ${groupJid}`);
            await sock.sendMessage(groupJid, {
                text: '❌ This group is not configured as a cluster group. Please contact the administrator.'
            });
            return;
        }

        // Extract sender phone number
        const senderPhone = extractPhone(senderJid) || 'unknown';

        // If reporter_name is missing, use the sender's phone number
        if (!parsedReport.reporter_name || parsedReport.reporter_name.trim() === '') {
            parsedReport.reporter_name = senderPhone;
        }

        // Save the report
        const result = await createGroupReport(assembly.id, parsedReport, senderPhone, msg.key.id);

        logger.info(`[GROUP] Report saved successfully with ID: ${result.lastInsertRowid}`);

        // Send confirmation message
        const confirmMsg = `✅ *Evangelism Report Saved!* @${senderPhone}\n\n` +
            `📋 Report #${result.lastInsertRowid}\n` +
            `📅 Date: ${parsedReport.activity_date}\n` +
            `🏘️ Area: ${parsedReport.area || 'N/A'}\n` +
            `✝️ Saved: ${parsedReport.saved}\n` +
            `🙏 Healed: ${parsedReport.healed}\n` +
            `🏛️ Cluster: ${assembly.name}\n\n` +
            `Thank you for your faithfulness! 🙏`;

        await sock.sendMessage(groupJid, {
            text: confirmMsg,
            mentions: [senderJid]
        });

    } catch (error) {
        logger.error('[GROUP] Error processing group report:', error);

        await sock.sendMessage(groupJid, {
            text: '❌ An error occurred while saving the report. Please try again or contact the administrator.'
        });
    }
}

import { isEvangelismReport, parseReport, validateParsedReport } from '../utils/groupReportParser.js';
import { getAssemblyByGroupJid, createGroupReport, getMembersByIds } from '../database/db.js';
import { sendUpcomingEvents, sendNextEvent } from './messageHandler.js';
import { extractPhone } from '../utils/helpers.js';
import { lidToPhone } from './connection.js';
import logger from '../utils/logger.js';

/**
 * Handle group messages for evangelism reports
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {string} messageText - Message text
 */
export async function handleGroupMessage(sock, msg, messageText) {
    const groupJid = msg.key.remoteJid;
    // senderJid is kept as-is (possibly a @lid) because it is what mentions must
    // target in LID-addressed groups.
    const senderJid = msg.key.participant || msg.participant;

    // Resolve the sender's real phone number for storage and display. In LID-addressed
    // groups the participant is an opaque @lid, whose digits are NOT a phone number —
    // storing those as reporter_phone corrupts the record. WhatsApp supplies the real
    // phone JID on the message key (participant_pn stanza attr); fall back to the cache.
    let senderPhoneJid = senderJid;
    if (senderJid?.endsWith('@lid')) {
        const resolved = lidToPhone[senderJid] || msg.key.participantPn;
        if (resolved) {
            senderPhoneJid = resolved;
        } else {
            logger.warn(`[GROUP] Unresolved participant LID: ${senderJid} — storing LID digits as reporter_phone`);
        }
    }
    const senderPhone = extractPhone(senderPhoneJid) || 'unknown';

    // The digits shown as "@..." in outgoing text MUST match the digits of
    // whatever JID is passed in `mentions` below, or WhatsApp clients fail to
    // render/notify the mention pill. mentions always targets senderJid (see
    // comment above — the LID itself in a LID-addressed group), so the
    // visible tag must be built from senderJid's own digits, not the
    // resolved phone number.
    const mentionDigits = extractPhone(senderJid) || senderPhone;

    // Ignore messages sent by the bot itself
    if (msg.key.fromMe) {
        return;
    }

    logger.info(`[GROUP] Message received in group: ${groupJid} from: ${senderJid}`);

    const normalizedText = messageText.trim().toLowerCase();

    // Handle calendar commands from group
    if (normalizedText.startsWith('!events') || normalizedText.startsWith('events')) {
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
    if (!isEvangelismReport(messageText)) {
        logger.info(`[GROUP] Not an evangelism report, ignoring.`);
        return;
    }

    logger.info(`[GROUP] Detected evangelism report in group: ${groupJid}`);

    try {
        // Parse the report
        const parsedReport = parseReport(messageText);
        logger.info(`[GROUP] Parsed report:`, JSON.stringify(parsedReport));

        // Validate the parsed data (field presence, date format, numbers)
        const validation = validateParsedReport(parsedReport);

        if (!validation.valid) {
            logger.warn(`[GROUP] Invalid evangelism report from ${senderJid}:`, validation.errors);

            const errorMsg =
                `❌ *Evangelism Report Error* @${mentionDigits}\n\n` +
                `The report could not be saved due to the following issues:\n` +
                validation.errors.map(err => `• ${err}`).join('\n') +
                `\n\n_Please check the format and try again._`;

            await sock.sendMessage(groupJid, { text: errorMsg, mentions: [senderJid] });
            return;
        }

        // ── ID Resolution ────────────────────────────────────────────────────
        // The Team field must now contain comma-separated member IDs (e.g. "1079, 1059, 1082").
        // We resolve each ID to the canonical full_name stored in the members table.
        // If ANY ID is not found, the entire report is REJECTED — nothing is saved.
        const rawTeam = (parsedReport.preachers_team || '').trim();
        const teamTokens = rawTeam.split(',').map(t => t.trim()).filter(Boolean);

        // Separate numeric tokens (IDs) from plain-text tokens (fallback names)
        const numericIds = [];
        const invalidTokens = [];

        for (const token of teamTokens) {
            const num = parseInt(token, 10);
            if (!isNaN(num) && String(num) === token.trim()) {
                numericIds.push(num);
            } else {
                invalidTokens.push(token);
            }
        }

        // Strictly enforce IDs: reject if any plain names were used
        if (invalidTokens.length > 0) {
            const invalidList = invalidTokens.map(t => `• ${t}`).join('\n');
            const errorMsg =
                `❌ *Evangelism Report Error* @${mentionDigits}\n\n` +
                `You provided names instead of Member IDs for the Team field:\n` +
                `${invalidList}\n\n` +
                `*Only numeric Member IDs are allowed.* Please replace the names with the correct IDs and resubmit your report.\n` +
                `_(You can ask an administrator if you don't know your ID.)_`;

            logger.warn(`[GROUP] Rejected report from ${senderJid} due to non-numeric team members: ${invalidTokens.join(', ')}`);
            await sock.sendMessage(groupJid, { text: errorMsg, mentions: [senderJid] });
            return; // Hard stop — report NOT saved
        }

        if (numericIds.length > 0) {
            // Batch-look up all IDs in one query
            const memberMap = await getMembersByIds(numericIds);

            // Find any IDs that were not in the database
            const unknownIds = numericIds.filter(id => !memberMap.has(id));

            if (unknownIds.length > 0) {
                const idList = unknownIds.map(id => `• ${id}`).join('\n');
                const errorMsg =
                    `❌ *Evangelism Report Error* @${mentionDigits}\n\n` +
                    `The following Team IDs were not found in the database:\n` +
                    `${idList}\n\n` +
                    `Please check the IDs and resubmit your report.\n` +
                    `_(You can ask an administrator if you don't know your ID.)_`;

                logger.warn(`[GROUP] Unknown member IDs in report from ${senderJid}: ${unknownIds.join(', ')}`);
                await sock.sendMessage(groupJid, { text: errorMsg, mentions: [senderJid] });
                return; // Hard stop — report NOT saved
            }

            // All IDs resolved — build the canonical names string
            const resolvedNames = teamTokens.map(token => {
                const num = parseInt(token, 10);
                return memberMap.get(num); // canonical name
            });

            parsedReport.preachers_team = resolvedNames.join(', ');
            logger.info(`[GROUP] Team resolved: ${parsedReport.preachers_team}`);
        }
        // ── End ID Resolution ─────────────────────────────────────────────────

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

        // If reporter_name is missing, use the sender's phone number
        if (!parsedReport.reporter_name || parsedReport.reporter_name.trim() === '') {
            parsedReport.reporter_name = senderPhone;
        }

        // Save the report with resolved names
        const result = await createGroupReport(assembly.id, parsedReport, senderPhone, msg.key.id);

        logger.info(`[GROUP] Report saved successfully with ID: ${result.lastInsertRowid}`);

        // Send confirmation message
        const confirmMsg =
            `✅ *Evangelism Report Saved!* @${mentionDigits}\n\n` +
            `📋 Report #${result.lastInsertRowid}\n` +
            `📅 Date: ${parsedReport.activity_date}\n` +
            `👥 Team: ${parsedReport.preachers_team || 'N/A'}\n` +
            `🏘️ Area: ${parsedReport.area || 'N/A'}\n` +
            `✝️ Saved: ${parsedReport.saved}\n` +
            `🙏 Healed: ${parsedReport.healed}\n` +
            `🏛️ Cluster: ${assembly.name}\n\n` +
            `Thank you for your faithfulness! 🙏`;

        await sock.sendMessage(groupJid, { text: confirmMsg, mentions: [senderJid] });

    } catch (error) {
        logger.error('[GROUP] Error processing group report:', error);

        await sock.sendMessage(groupJid, {
            text: '❌ An error occurred while saving the report. Please try again or contact the administrator.'
        });
    }
}



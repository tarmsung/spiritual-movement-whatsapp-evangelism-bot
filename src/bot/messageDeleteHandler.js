import logger from '../utils/logger.js';
import { deleteReportByMessageId } from '../database/db.js';

/**
 * Handle deleted WhatsApp messages.
 * If the deleted message was a saved evangelism report, delete it from the DB
 * and notify the group.
 *
 * @param {Object} sock - WhatsApp socket
 * @param {Array}  keys - Array of message key objects from Baileys messages.delete event
 */
export async function handleMessageDelete(sock, keys) {
    for (const key of keys) {
        const waMessageId = key.id;
        const groupJid = key.remoteJid;

        // Only process group messages
        if (!groupJid?.endsWith('@g.us')) continue;

        logger.info(`[DELETE] Message deleted in ${groupJid} — WA ID: ${waMessageId}`);

        try {
            const deleted = await deleteReportByMessageId(waMessageId);

            if (!deleted) {
                // The deleted message wasn't a tracked evangelism report — ignore
                logger.info(`[DELETE] Message ${waMessageId} was not a tracked report, ignoring.`);
                continue;
            }

            logger.info(`[DELETE] Report #${deleted.id} deleted from DB (originally by ${deleted.reporter_name})`);

            // Determine the deleter's display name.
            // In Baileys, the participant who deleted is in key.participant (group sender).
            // We use their phone number as a fallback if name isn't available.
            const deleterJid = key.participant || key.remoteJid;
            const deleterPhone = deleterJid ? deleterJid.split('@')[0] : 'Unknown';

            // Try to get the deleter's WhatsApp push name — not always available from the key,
            // so we fall back to phone number.
            const deleterDisplay = deleterPhone;

            // Send notification to the group
            const notifyMsg =
                `🗑️ *Report #${deleted.id} has been deleted.*\n\n` +
                `👤 Deleted by: ${deleterDisplay}\n` +
                `📋 Original reporter: ${deleted.reporter_name || 'Unknown'}\n` +
                `📅 Activity date: ${deleted.activity_date || 'N/A'}\n` +
                `📍 Location: ${deleted.location || 'N/A'}\n\n` +
                `_This report has been removed from the database._`;

            await sock.sendMessage(groupJid, { text: notifyMsg });

        } catch (error) {
            logger.error(`[DELETE] Error handling deleted message ${waMessageId}:`, error);
        }
    }
}

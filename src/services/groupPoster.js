import { getReport, markReportAsPosted } from '../database/db.js';
import logger from '../utils/logger.js';
import { formatDate } from '../utils/helpers.js';

/**
 * Post evangelism report to WhatsApp group
 * @param {Object} sock - WhatsApp socket
 * @param {number} reportId - Report ID
 */
export async function postReportToGroup(sock, reportId) {
    try {
        const report = await getReport(reportId);

        if (!report) {
            logger.error(`Report ${reportId} not found`);
            return;
        }

        if (report.posted_to_group) {
            logger.info(`Report ${reportId} already posted to group`);
            return;
        }

        if (!report.whatsapp_group_id) {
            logger.warn(`No WhatsApp group ID for cluster: ${report.assembly_name}`);
            return;
        }

        // Format the report message
        const message = formatReportMessage(report);

        // Send to group
        const groupJid = report.whatsapp_group_id;
        await sock.sendMessage(groupJid, { text: message });

        logger.info(`Report ${reportId} posted to group ${groupJid}`);

        // Mark as posted
        await markReportAsPosted(reportId);

    } catch (error) {
        logger.error(`Error posting report ${reportId} to group:`, error);

        // Retry once after delay
        setTimeout(async () => {
            try {
                const report = await getReport(reportId);
                if (report && !report.posted_to_group) {
                    const message = formatReportMessage(report);
                    await sock.sendMessage(report.whatsapp_group_id, { text: message });
                    await markReportAsPosted(reportId);
                    logger.info(`Report ${reportId} posted to group on retry`);
                }
            } catch (retryError) {
                logger.error(`Retry failed for report ${reportId}:`, retryError);
            }
        }, 5000);
    }
}

/**
 * Format report for group posting
 * @param {Object} report
 * @returns {string}
 */
function formatReportMessage(report) {
    let message = '📊 EVANGELISM REPORT 📊\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += `📅 Date: ${formatDate(report.activity_date)}\n`;
    message += `📍 Location: ${report.location}\n`;
    if (report.area) {
        message += `🏘️ Area: ${report.area}\n`;
    }
    if (report.city) {
        message += `🏙️ City: ${report.city}\n`;
    }
    message += `📋 Activity: ${report.activity_type}\n`;
    message += `👥 Team: ${report.preachers_team}\n\n`;

    message += `📖 Summary:\n${report.message_summary}\n\n`;

    if (report.response_moments) {
        message += `✨ Notable Moments:\n${report.response_moments}\n\n`;
    }

    message += `📈 Results:\n`;
    message += `✝️ Saved: ${report.saved}\n`;
    message += `🙏 Healed: ${report.healed}\n\n`;

    message += `📝 Reporter: ${report.reporter_name}\n`;
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += `🏛️ Cluster: ${report.assembly_name}`;

    return message;
}

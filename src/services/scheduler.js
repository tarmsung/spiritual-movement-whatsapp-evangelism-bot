import fs from 'fs';
import cron from 'node-cron';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { getAllAssemblies } from '../database/db.js';
import { getPreviousMonthRange, getPreviousDayRange, formatNumber } from '../utils/helpers.js';
import { generateMonthlyReport } from './aiReportGenerator.js';
import { generatePDFReport } from './pdfGenerator.js';
import { getSocket } from '../bot/connection.js';

let scheduledTask = null;

/**
 * Start monthly report scheduler
 */
export function startScheduler() {
    // Validate cron expression
    if (!cron.validate(config.reportSchedule)) {
        logger.error(`Invalid cron schedule: ${config.reportSchedule}`);
        return;
    }

    logger.info(`Starting monthly report scheduler: ${config.reportSchedule}`);

    scheduledTask = cron.schedule(config.reportSchedule, async () => {
        logger.info('Monthly report generation triggered by scheduler');
        await generateAndDistributeMonthlyReport();
    });

    logger.info('Scheduler started successfully');
}

/**
 * Stop scheduler
 */
export function stopScheduler() {
    if (scheduledTask) {
        scheduledTask.stop();
        logger.info('Scheduler stopped');
    }
}

/**
 * Generate and distribute monthly report
 */
export async function generateAndDistributeMonthlyReport() {
    try {
        logger.info('Starting monthly report generation...');

        // Get previous month date range
        const { start, end } = getPreviousMonthRange();

        // Generate report data
        const reportData = await generateMonthlyReport(start, end);

        // Generate PDF
        const pdfPath = await generatePDFReport(reportData);

        // Get WhatsApp socket
        const sock = getSocket();
        if (!sock) {
            logger.error('WhatsApp not connected - cannot distribute report');
            return;
        }

        // Create summary message
        const summaryMessage = formatSummaryMessage(reportData);

        // Get all assemblies
        const assemblies = await getAllAssemblies();

        // Send summary and PDF to all assembly groups
        for (const assembly of assemblies) {
            if (assembly.whatsapp_group_id) {
                try {
                    // 1. Send text summary
                    await sock.sendMessage(assembly.whatsapp_group_id, {
                        text: summaryMessage
                    });

                    // 2. Send PDF document
                    const fileBuffer = fs.readFileSync(pdfPath);
                    const fileName = `Evangelism_Report_${reportData.period.replace(/ /g, '_')}.pdf`;

                    await sock.sendMessage(assembly.whatsapp_group_id, {
                        document: fileBuffer,
                        mimetype: 'application/pdf',
                        fileName: fileName,
                        caption: `📄 ${reportData.period} Full Report`
                    });

                    logger.info(`Report summary and PDF sent to ${assembly.name}`);
                } catch (error) {
                    logger.error(`Failed to send report to ${assembly.name}:`, error);
                }
            }
        }

        logger.info('Monthly report generation and distribution completed');

    } catch (error) {
        logger.error('Error in monthly report generation:', error);
    }
}

/**
 * Format summary message for groups
 */
function formatSummaryMessage(reportData) {
    let message = '📊 MONTHLY EVANGELISM REPORT 📊\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    message += `📅 Period: ${reportData.period}\n\n`;

    message += 'KEY STATISTICS\n';
    message += '━━━━━━━━━━━━━━━━\n';
    message += `📝 Total Reports: ${reportData.overall.totalReports}\n`;
    message += `👥 People Reached: ${formatNumber(reportData.overall.totalReached)}\n`;
    message += `✝️ Conversions: ${formatNumber(reportData.overall.totalConversions)}\n`;
    message += `📈 Conversion Rate: ${reportData.overall.conversionRate}\n\n`;

    if (reportData.assemblies.length > 0) {
        message += 'ASSEMBLY PERFORMANCE\n';
        message += '━━━━━━━━━━━━━━━━━━━━\n';

        reportData.assemblies.forEach(assembly => {
            message += `🏛️ ${assembly.name}\n`;
            message += `   Reports: ${assembly.reports} | `;
            message += `Reached: ${formatNumber(assembly.reached)} | `;
            message += `Conversions: ${formatNumber(assembly.conversions)}\n\n`;
        });
    }

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '📄 Full report with detailed analysis has been generated.\n';
    message += 'Praise God for His faithfulness! 🙏\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

    return message;
}

/**
 * Manually trigger report generation (for testing)
 */
export async function manuallyTriggerReport() {
    logger.info('Manual report generation triggered');
    await generateAndDistributeMonthlyReport();
}

/**
 * Generate test report for a single user
 * @param {Object} sock - WhatsApp socket
 * @param {string} recipientJid - Recipient JID
 */
export async function generateTestReport(sock, recipientJid) {
    try {
        logger.info(`Generating test report for ${recipientJid}...`);
        await sock.sendMessage(recipientJid, { text: 'Generating test report... Please wait.' });

        // Get previous day date range (yesterday)
        const { start, end } = getPreviousDayRange();
        const customTitle = `Daily Test Report (${start})`;

        // Generate report data with custom title
        const reportData = await generateMonthlyReport(start, end, customTitle);
        reportData.title = customTitle; // Set title for PDF

        // Generate PDF
        const pdfPath = await generatePDFReport(reportData);

        // Create summary message
        const summaryMessage = formatSummaryMessage(reportData);

        // 1. Send text summary
        await sock.sendMessage(recipientJid, {
            text: summaryMessage
        });

        // 2. Send PDF document
        const fileBuffer = fs.readFileSync(pdfPath);
        const fileName = `Daily_Report_${start}.pdf`;

        await sock.sendMessage(recipientJid, {
            document: fileBuffer,
            mimetype: 'application/pdf',
            fileName: fileName,
            caption: `📄 ${customTitle}`
        });

        logger.info(`Test report sent to ${recipientJid}`);

    } catch (error) {
        logger.error(`Error generating test report for ${recipientJid}:`, error);
        await sock.sendMessage(recipientJid, { text: 'Error generating test report. Check logs.' });
    }
}

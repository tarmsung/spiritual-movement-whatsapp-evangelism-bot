import fs from 'fs';
import cron from 'node-cron';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { getAllAssemblies, getEventsInDays } from '../database/db.js';
import { getPreviousMonthRange, getPreviousDayRange, formatNumber, formatCalendarDate, sleep } from '../utils/helpers.js';
import { generateAssemblyReports, generateAssemblyReport } from './aiReportGenerator.js';
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
    }, {
        scheduled: true,
        timezone: 'Africa/Harare'
    });

    // Daily event reminder — runs every morning at 7:00 AM (Harare Time)
    cron.schedule('0 7 * * *', async () => {
        logger.info('[SCHEDULER] Running daily event reminder check...');
        await sendEventReminders(false); // false = strictly real events
    }, {
        scheduled: true,
        timezone: 'Africa/Harare'
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
 * Generate and distribute monthly reports (one per assembly)
 */
export async function generateAndDistributeMonthlyReport() {
    try {
        logger.info('Starting monthly report generation...');

        // Get previous month date range
        const { start, end } = getPreviousMonthRange();

        // Generate reports for all assemblies
        const assemblyReports = await generateAssemblyReports(start, end);

        if (assemblyReports.length === 0) {
            logger.info('No assembly reports to distribute - no data for this period');
            return;
        }

        // Get WhatsApp socket
        const sock = getSocket();
        if (!sock) {
            logger.error('WhatsApp not connected - cannot distribute reports');
            return;
        }

        // Get all assemblies (for group JIDs)
        const assemblies = await getAllAssemblies();

        // Send each assembly's report to its own group
        for (const report of assemblyReports) {
            // Find this assembly's group JID
            const assembly = assemblies.find(a => a.name === report.assemblyName);
            if (!assembly || !assembly.whatsapp_group_id) {
                logger.warn(`No WhatsApp group configured for ${report.assemblyName} - skipping distribution`);
                continue;
            }

            try {
                // Generate PDF for this assembly
                const pdfPath = await generatePDFReport(report);

                // Create summary message for this assembly
                const summaryMessage = formatAssemblySummaryMessage(report);

                // 1. Send text summary
                await sock.sendMessage(assembly.whatsapp_group_id, {
                    text: summaryMessage
                });

                // 2. Send PDF document
                const fileBuffer = fs.readFileSync(pdfPath);
                const fileName = `Evangelism_Report_${report.assemblyName.replace(/\s+/g, '_')}_${report.period.replace(/ /g, '_')}.pdf`;

                await sock.sendMessage(assembly.whatsapp_group_id, {
                    document: fileBuffer,
                    mimetype: 'application/pdf',
                    fileName: fileName,
                    caption: `📄 ${report.assemblyName} - ${report.period} Full Report`
                });

                logger.info(`Report sent to ${report.assemblyName} group`);
            } catch (error) {
                logger.error(`Failed to send report to ${report.assemblyName}:`, error);
            }
        }

        logger.info('Monthly report generation and distribution completed');

    } catch (error) {
        logger.error('Error in monthly report generation:', error);
    }
}

/**
 * Format summary message for an assembly's group
 */
function formatAssemblySummaryMessage(report) {
    let message = '📊 MONTHLY EVANGELISM REPORT 📊\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    message += `🏛️ ${report.assemblyName}\n`;
    message += `📅 Period: ${report.period}\n\n`;

    message += 'KEY STATISTICS\n';
    message += '━━━━━━━━━━━━━━━━\n';
    message += `📝 Total Outreaches: ${report.totalOutreaches}\n`;
    message += `✝️ Saved: ${formatNumber(report.totalSaved)}\n`;
    message += `🙏 Healed: ${formatNumber(report.totalHealed)}\n\n`;

    if (report.locations.length > 0) {
        message += 'LOCATIONS PREACHED AT\n';
        message += '━━━━━━━━━━━━━━━━━━━━\n';
        message += report.locations.map(l => `📍 ${l}`).join('\n');
        message += '\n\n';
    }

    if (report.labourers.length > 0) {
        message += 'LABOURERS IN THE FIELD\n';
        message += '━━━━━━━━━━━━━━━━━━━━━━\n';
        message += report.labourers.map(l => `👤 ${l}`).join('\n');
        message += '\n\n';
    }

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '📄 Full report with detailed analysis attached.\n';
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
 * Check for upcoming events and send reminders at 7, 3, and 1 day(s) before
 * @param {boolean} isTest - If true, only process dummy test events. If false, process real events.
 */
export async function sendEventReminders(isTest = false) {
    try {
        const calendarGroupJid = '263772635811-1585590002@g.us';

        const sock = getSocket();
        if (!sock) {
            logger.error('[SCHEDULER] WhatsApp not connected - cannot send event reminders');
            return;
        }

        // Define reminder intervals with their messages
        const reminders = [
            {
                daysOut: 7,
                label: (name, date) =>
                    `⏳ *1 WEEK AWAY*\n` +
                    `🗓️ *UPCOMING CHURCH EVENT*\n` +
                    `────────────────────\n` +
                    `**${name}**\n` +
                    `🔸 WHEN: ${date}\n\n` +
                    `_Mark your calendars! Preparation time is now._ 🙏\n` +
                    `────────────────────`
            },
            {
                daysOut: 3,
                label: (name, date) =>
                    `⏳ *3 DAYS TO GO*\n` +
                    `🗓️ *UPCOMING CHURCH EVENT*\n` +
                    `────────────────────\n` +
                    `**${name}**\n` +
                    `🔸 WHEN: ${date}\n\n` +
                    `_Only 3 days left! Kindly make your arrangements._ 🙏\n` +
                    `────────────────────`
            },
            {
                daysOut: 1,
                label: (name, date) =>
                    `🔔 *EVENT TOMORROW*\n` +
                    `🗓️ *CHURCH EVENT REMINDER*\n` +
                    `────────────────────\n` +
                    `**${name}**\n` +
                    `🔸 WHEN: ${date}\n\n` +
                    `_Please make your final arrangements. God bless!_ 🙏\n` +
                    `────────────────────`
            }
        ];

        for (const { daysOut, label } of reminders) {
            const events = await getEventsInDays(daysOut, isTest);
            if (!events || events.length === 0) continue;

            for (const event of events) {
                const msg = label(event.name, formatCalendarDate(event.event_date));
                try {
                    await sock.sendMessage(calendarGroupJid, { text: msg });
                    logger.info(`[SCHEDULER] ${daysOut}-day reminder sent for: ${event.name}`);

                    // Wait 1 minute before sending the next one
                    await sleep(60000);
                } catch (err) {
                    logger.error(`[SCHEDULER] Failed to send ${daysOut}-day reminder:`, err);
                }
            }
        }

    } catch (error) {
        logger.error('[SCHEDULER] Error sending event reminders:', error);
    }
}


/**
 * Generate test report for a single user (sends reports for all assemblies)
 * @param {Object} sock - WhatsApp socket
 * @param {string} recipientJid - Recipient JID
 */
export async function generateTestReport(sock, recipientJid) {
    try {
        logger.info(`Generating test report for ${recipientJid}...`);
        await sock.sendMessage(recipientJid, { text: 'Generating assembly reports... Please wait.' });

        // Get previous day date range (yesterday)
        const { start, end } = getPreviousDayRange();

        // Generate reports for all assemblies
        const assemblyReports = await generateAssemblyReports(start, end);

        if (assemblyReports.length === 0) {
            await sock.sendMessage(recipientJid, { text: 'No evangelism reports found for the period.' });
            return;
        }

        // Send summary and PDFs for each assembly
        for (const report of assemblyReports) {
            const summaryMessage = formatAssemblySummaryMessage(report);
            await sock.sendMessage(recipientJid, { text: summaryMessage });

            // Generate and send PDF
            const pdfPath = await generatePDFReport(report);
            const fileBuffer = fs.readFileSync(pdfPath);
            const fileName = `Report_${report.assemblyName.replace(/\s+/g, '_')}_${start}.pdf`;

            await sock.sendMessage(recipientJid, {
                document: fileBuffer,
                mimetype: 'application/pdf',
                fileName: fileName,
                caption: `📄 ${report.assemblyName} - Daily Report (${start})`
            });
        }

        await sock.sendMessage(recipientJid, {
            text: `✅ Generated ${assemblyReports.length} assembly report(s).`
        });

        logger.info(`Test reports sent to ${recipientJid}`);

    } catch (error) {
        logger.error(`Error generating test report for ${recipientJid}:`, error);
        await sock.sendMessage(recipientJid, { text: 'Error generating test report. Check logs.' });
    }
}

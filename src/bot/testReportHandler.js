import logger from '../utils/logger.js';
import { CANCEL_MESSAGE } from '../utils/constants.js';
import { getAllAssemblies } from '../database/db.js';
import { generateAssemblyReport } from '../services/aiReportGenerator.js';
import { generatePDFReport } from '../services/pdfGenerator.js';
import fs from 'fs';

/**
 * In-memory state for test report interactive flow
 * Key: userJid, Value: { step, assemblies, selectedAssembly, months }
 */
const testReportState = new Map();

/**
 * Check if user has an active test report session
 */
export function hasActiveTestReport(userJid) {
    return testReportState.has(userJid);
}

/**
 * Start the interactive test report flow
 */
export async function startTestReport(sock, userJid) {
    const assemblies = await getAllAssemblies();

    if (assemblies.length === 0) {
        await sock.sendMessage(userJid, {
            text: '❌ No clusters/assemblies configured. Please contact the administrator.'
        });
        return;
    }

    // Save state
    testReportState.set(userJid, {
        step: 'select_assembly',
        assemblies
    });

    // Show assembly selection
    let message = '📊 *TEST REPORT GENERATOR*\n\n';
    message += '🏛️ *Select the cluster you want a report for:*\n\n';

    assemblies.forEach((assembly, index) => {
        message += `  ${index + 1}. ${assembly.name}\n`;
    });

    message += '\n🔢 Reply with the number of the cluster';
    message += '\n\n_Type "cancel" to cancel._';

    await sock.sendMessage(userJid, { text: message });
}

/**
 * Process user response in the test report flow
 */
export async function processTestReportResponse(sock, userJid, message) {
    const state = testReportState.get(userJid);
    if (!state) return;

    const text = message.trim().toLowerCase();

    // Handle cancel
    if (text === 'cancel') {
        testReportState.delete(userJid);
        await sock.sendMessage(userJid, { text: CANCEL_MESSAGE });
        return;
    }

    if (state.step === 'select_assembly') {
        await processAssemblySelection(sock, userJid, message, state);
    } else if (state.step === 'select_month') {
        await processMonthSelection(sock, userJid, message, state);
    }
}

/**
 * Process assembly selection
 */
async function processAssemblySelection(sock, userJid, message, state) {
    const num = parseInt(message.trim());

    if (isNaN(num) || num < 1 || num > state.assemblies.length) {
        await sock.sendMessage(userJid, {
            text: `❌ Please enter a valid number between 1 and ${state.assemblies.length}.`
        });
        return;
    }

    const selectedAssembly = state.assemblies[num - 1];

    // Build month options (last 12 months)
    const months = [];
    const now = new Date();

    // We want the last 12 "10th to 9th" cycles.
    // If today is before the 10th, the *current* active cycle ends in the previous month.
    let currentEndYear = now.getFullYear();
    let currentEndMonth = now.getDate() >= 10 ? now.getMonth() : now.getMonth() - 1;

    if (currentEndMonth < 0) {
        currentEndMonth = 11;
        currentEndYear--;
    }

    for (let i = 0; i < 12; i++) {
        let endYear = currentEndYear;
        let endMonth = currentEndMonth - i;

        while (endMonth < 0) {
            endMonth += 12;
            endYear--;
        }

        let startYear = endYear;
        let startMonth = endMonth - 1;

        if (startMonth < 0) {
            startMonth = 11;
            startYear--;
        }

        const startStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-10`;
        const endStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-09`;

        const sDate = new Date(startYear, startMonth, 10);
        const eDate = new Date(endYear, endMonth, 9);

        const labelStr = `${sDate.toLocaleString('en-US', { month: 'short' })} 10 - ${eDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })} 9`;

        months.push({
            label: labelStr,
            startDate: startStr,
            endDate: endStr
        });
    }

    // Update state
    state.step = 'select_month';
    state.selectedAssembly = selectedAssembly;
    state.months = months;
    testReportState.set(userJid, state);

    // Show month selection
    let msg = `✅ Selected: *${selectedAssembly.name}*\n\n`;
    msg += '📅 *Select the month for the report:*\n\n';

    months.forEach((m, index) => {
        msg += `  ${index + 1}. ${m.label}\n`;
    });

    msg += '\n🔢 Reply with the number of the month';
    msg += '\n\n_Type "cancel" to cancel._';

    await sock.sendMessage(userJid, { text: msg });
}

/**
 * Process month selection and generate the report
 */
async function processMonthSelection(sock, userJid, message, state) {
    const num = parseInt(message.trim());

    if (isNaN(num) || num < 1 || num > state.months.length) {
        await sock.sendMessage(userJid, {
            text: `❌ Please enter a valid number between 1 and ${state.months.length}.`
        });
        return;
    }

    const selectedMonth = state.months[num - 1];
    const assembly = state.selectedAssembly;

    // Clear state before generating (so user isn't stuck if it errors)
    testReportState.delete(userJid);

    await sock.sendMessage(userJid, {
        text: `⏳ Generating report for *${assembly.name}* — *${selectedMonth.label}*...\n\nThis may take a moment while the AI analyzes the data.`
    });

    try {
        // Generate report for the selected assembly
        const reportData = await generateAssemblyReport(
            assembly,
            selectedMonth.startDate,
            selectedMonth.endDate,
            { command: '[Executor Report]' }
        );

        if (reportData.totalOutreaches === 0) {
            await sock.sendMessage(userJid, {
                text: `⚠️ No evangelism reports found for *${assembly.name}* in *${selectedMonth.label}*.`
            });
            return;
        }

        // Generate PDF
        const pdfPath = await generatePDFReport(reportData);

        // Send summary
        let summary = `📊 *${assembly.name} — ${selectedMonth.label} REPORT*\n`;
        summary += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        summary += `📝 Total Outreaches: ${reportData.totalOutreaches}\n`;
        summary += `✝️ Saved: ${reportData.totalSaved}\n`;
        summary += `🙏 Healed: ${reportData.totalHealed}\n\n`;

        if (reportData.locations.length > 0) {
            summary += `📍 Locations: ${reportData.locations.join(', ')}\n\n`;
        }
        if (reportData.labourers.length > 0) {
            summary += `👥 Labourers: ${reportData.labourers.join(', ')}\n\n`;
        }

        summary += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

        await sock.sendMessage(userJid, { text: summary });

        // Send PDF
        const fileBuffer = fs.readFileSync(pdfPath);
        const fileName = `Report_${assembly.name.replace(/\s+/g, '_')}_${selectedMonth.label.replace(/\s+/g, '_')}.pdf`;

        await sock.sendMessage(userJid, {
            document: fileBuffer,
            mimetype: 'application/pdf',
            fileName: fileName,
            caption: `📄 ${assembly.name} — ${selectedMonth.label} Full Report`
        });

        logger.info(`Test report for ${assembly.name} (${selectedMonth.label}) sent to ${userJid}`);

    } catch (error) {
        logger.error(`Error generating test report:`, error);
        await sock.sendMessage(userJid, {
            text: '❌ Error generating the report. Please check the logs or try again.'
        });
    }
}

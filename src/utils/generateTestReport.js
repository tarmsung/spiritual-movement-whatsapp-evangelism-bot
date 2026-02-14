/**
 * Test Script for SMC Report Generation
 * 
 * Generates a sample monthly evangelism report using the SMC framework.
 * This script demonstrates the full pipeline from data extraction to PDF generation.
 * 
 * Usage:
 *   node src/utils/generateTestReport.js
 *   node src/utils/generateTestReport.js --command "[Compiled from Executor Podcast]"
 *   node src/utils/generateTestReport.js --cluster "Mutare Cluster" --month 2026-01
 */

import { generateMonthlyReport } from '../services/aiReportGenerator.js';
import { generatePDFReport } from '../services/pdfGenerator.js';
import logger from './logger.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--command') {
        options.command = args[i + 1];
        i++;
    } else if (args[i] === '--cluster') {
        options.clusterName = args[i + 1];
        i++;
    } else if (args[i] === '--month') {
        const month = args[i + 1]; // Format: YYYY-MM
        const [year, monthNum] = month.split('-');
        options.startDate = `${year}-${monthNum}-01`;

        // Calculate last day of month
        const lastDay = new Date(year, monthNum, 0).getDate();
        options.endDate = `${year}-${monthNum}-${lastDay}`;
        i++;
    }
}

// Default values if not provided
if (!options.startDate) {
    // Default to January 2026 (matching the example PDF)
    options.startDate = '2026-01-01';
    options.endDate = '2026-01-31';
}

if (!options.clusterName) {
    options.clusterName = 'Mutare Cluster';
}

if (!options.command) {
    options.command = '[Executor Report]';
}

logger.info('='.repeat(60));
logger.info('SMC REPORT GENERATION TEST');
logger.info('='.repeat(60));
logger.info(`Date Range: ${options.startDate} to ${options.endDate}`);
logger.info(`Cluster: ${options.clusterName}`);
logger.info(`Command: ${options.command}`);
logger.info('='.repeat(60));

async function runTest() {
    try {
        // Step 1: Generate report data
        logger.info('Step 1: Generating report data...');
        const reportData = await generateMonthlyReport(
            options.startDate,
            options.endDate,
            {
                clusterName: options.clusterName,
                command: options.command
            }
        );

        logger.info('Report data generated successfully!');
        logger.info(`  - Locations: ${reportData.locations.length}`);
        logger.info(`  - Labourers: ${reportData.labourers.length}`);
        logger.info(`  - Converts: ${reportData.overall.totalConversions}`);
        logger.info(`  - Sick Prayed For: ${reportData.overall.totalReached}`);
        logger.info(`  - Command Used: ${reportData.command}`);
        logger.info(`  - Map Generated: ${reportData.mapImagePath ? 'Yes' : 'No'}`);

        // Step 2: Generate PDF
        logger.info('\\nStep 2: Generating PDF report...');
        const pdfPath = await generatePDFReport(reportData);

        logger.info('='.repeat(60));
        logger.info('SUCCESS!');
        logger.info('='.repeat(60));
        logger.info(`PDF Report Generated: ${pdfPath}`);
        logger.info('='.repeat(60));

        // Display narrative preview
        if (reportData.narrative) {
            logger.info('\\nNARRATIVE PREVIEW:');
            const preview = reportData.narrative.substring(0, 300) + '...';
            logger.info(preview);
        }

        // Display message emphasis
        if (reportData.messageEmphasis && reportData.messageEmphasis.length > 0) {
            logger.info('\\nMESSAGE EMPHASIS:');
            reportData.messageEmphasis.forEach(item => {
                logger.info(`  • ${item}`);
            });
        }

    } catch (error) {
        logger.error('Test failed:', error);
        logger.error(error.stack);
        process.exit(1);
    }
}

// Run the test
runTest();

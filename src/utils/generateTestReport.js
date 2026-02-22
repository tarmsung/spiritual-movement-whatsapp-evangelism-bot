/**
 * Test Script for Assembly-Based Report Generation
 * 
 * Generates monthly evangelism reports per assembly.
 * Each assembly gets its own separate PDF report.
 * 
 * Usage:
 *   node src/utils/generateTestReport.js
 *   node src/utils/generateTestReport.js --month 2026-02
 *   node src/utils/generateTestReport.js --month 2026-02 --assembly "Assembly Name"
 *   node src/utils/generateTestReport.js --command "[Compiled from Executor Podcast]"
 */

import { generateAssemblyReports, generateAssemblyReport } from '../services/aiReportGenerator.js';
import { generatePDFReport } from '../services/pdfGenerator.js';
import { getAllAssemblies } from '../database/db.js';
import logger from './logger.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
let assemblyFilter = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--command') {
        options.command = args[i + 1];
        i++;
    } else if (args[i] === '--assembly') {
        assemblyFilter = args[i + 1];
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
    options.startDate = '2026-01-01';
    options.endDate = '2026-01-31';
}

if (!options.command) {
    options.command = '[Executor Report]';
}

logger.info('='.repeat(60));
logger.info('ASSEMBLY-BASED REPORT GENERATION');
logger.info('='.repeat(60));
logger.info(`Date Range: ${options.startDate} to ${options.endDate}`);
logger.info(`Command: ${options.command}`);
if (assemblyFilter) {
    logger.info(`Assembly Filter: ${assemblyFilter}`);
}
logger.info('='.repeat(60));

async function runTest() {
    try {
        let reports;

        if (assemblyFilter) {
            // Generate report for a specific assembly
            const assemblies = await getAllAssemblies();
            const assembly = assemblies.find(a =>
                a.name.toLowerCase() === assemblyFilter.toLowerCase()
            );

            if (!assembly) {
                logger.error(`Assembly "${assemblyFilter}" not found. Available assemblies:`);
                assemblies.forEach(a => logger.info(`  - ${a.name}`));
                process.exit(1);
            }

            logger.info(`Generating report for: ${assembly.name}`);
            const report = await generateAssemblyReport(assembly, options.startDate, options.endDate, options);
            reports = report.totalOutreaches > 0 ? [report] : [];
        } else {
            // Generate reports for all assemblies
            logger.info('Generating reports for ALL assemblies...');
            reports = await generateAssemblyReports(options.startDate, options.endDate, options);
        }

        if (reports.length === 0) {
            logger.info('No reports found for any assembly in this period.');
            process.exit(0);
        }

        // Generate PDFs for each assembly report
        const pdfPaths = [];
        for (const report of reports) {
            logger.info(`\n--- ${report.assemblyName} ---`);
            logger.info(`  Outreaches: ${report.totalOutreaches}`);
            logger.info(`  Locations: ${report.locations.join(', ')}`);
            logger.info(`  Labourers: ${report.labourers.join(', ')}`);
            logger.info(`  Saved: ${report.totalSaved}`);
            logger.info(`  Healed: ${report.totalHealed}`);
            logger.info(`  Activity Types: ${report.activityTypes.join(', ')}`);

            const pdfPath = await generatePDFReport(report);
            pdfPaths.push(pdfPath);
            logger.info(`  PDF: ${pdfPath}`);
        }

        logger.info('\n' + '='.repeat(60));
        logger.info('SUCCESS!');
        logger.info('='.repeat(60));
        logger.info(`Generated ${pdfPaths.length} assembly report(s):`);
        pdfPaths.forEach(p => logger.info(`  - ${p}`));
        logger.info('='.repeat(60));

    } catch (error) {
        logger.error('Test failed:', error);
        logger.error(error.stack);
        process.exit(1);
    }
}

// Run the test
runTest();

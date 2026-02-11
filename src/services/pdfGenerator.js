import PDFDocument from 'pdfkit';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import { formatNumber } from '../utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPORTS_DIR = join(__dirname, '../../reports');

// Ensure reports directory exists
if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Generate PDF report from monthly data
 * @param {Object} reportData - Monthly report data
 * @returns {Promise<string>} Path to generated PDF
 */
export async function generatePDFReport(reportData) {
    const filename = `evangelism_report_${reportData.startDate}_to_${reportData.endDate}.pdf`;
    const filepath = join(REPORTS_DIR, filename);

    logger.info(`Generating PDF report: ${filename}`);

    return new Promise((resolve, reject) => {
        try {
            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            // Pipe to file
            const stream = createWriteStream(filepath);
            doc.pipe(stream);

            // Build PDF content
            buildPDFContent(doc, reportData);

            // Finalize PDF
            doc.end();

            stream.on('finish', () => {
                logger.info(`PDF report generated: ${filepath}`);
                resolve(filepath);
            });

            stream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Build PDF content
 */
function buildPDFContent(doc, reportData) {
    const pageWidth = doc.page.width - 100; // Account for margins

    // Header
    doc.fontSize(24)
        .fillColor('#1a1a1a')
        .text(config.churchName, { align: 'center' });

    doc.fontSize(16)
        .fillColor('#666')
        .text('Monthly Evangelism Report', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(12)
        .fillColor('#999')
        .text(reportData.period, { align: 'center' });

    doc.moveDown(2);

    // Horizontal line
    doc.strokeColor('#ddd')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

    doc.moveDown(2);

    // Overall Statistics Section
    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .text('📊 Overall Statistics', { underline: true });

    doc.moveDown(1);

    const statsData = [
        ['Total Reports:', reportData.overall.totalReports.toString()],
        ['People Reached:', formatNumber(reportData.overall.totalReached)],
        ['Conversions:', formatNumber(reportData.overall.totalConversions)],
        ['Conversion Rate:', reportData.overall.conversionRate]
    ];

    statsData.forEach(([label, value]) => {
        doc.fontSize(12)
            .fillColor('#333')
            .text(label, 70, doc.y, { continued: true, width: 200 })
            .fillColor('#000')
            .font('Helvetica-Bold')
            .text(value, { align: 'right' })
            .font('Helvetica');
        doc.moveDown(0.8);
    });

    doc.moveDown(2);

    // Assembly Performance Section
    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .text('🏛️ Assembly Performance', { underline: true });

    doc.moveDown(1);

    if (reportData.assemblies.length > 0) {
        reportData.assemblies.forEach(assembly => {
            doc.fontSize(14)
                .fillColor('#1a73e8')
                .text(assembly.name);

            doc.fontSize(11)
                .fillColor('#555')
                .text(`Reports: ${assembly.reports} | Reached: ${formatNumber(assembly.reached)} | Conversions: ${formatNumber(assembly.conversions)} | Rate: ${assembly.conversionRate}`, {
                    indent: 20
                });

            doc.moveDown(1);
        });
    } else {
        doc.fontSize(11)
            .fillColor('#999')
            .text('No assembly data available');
    }

    doc.moveDown(2);

    // Activity Types Section
    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .text('📋 Activity Breakdown', { underline: true });

    doc.moveDown(1);

    if (reportData.activityTypes.length > 0) {
        reportData.activityTypes.forEach(activity => {
            doc.fontSize(12)
                .fillColor('#333')
                .text(`${activity.type}:`, 70, doc.y, { continued: true, width: 200 })
                .fillColor('#666')
                .text(`${activity.count} activities, ${formatNumber(activity.conversions)} conversions`, { align: 'right' });
            doc.moveDown(0.8);
        });
    }

    doc.moveDown(2);

    // Add new page for AI analysis if needed
    if (doc.y > doc.page.height - 200) {
        doc.addPage();
    }

    // AI Analysis Section
    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .text('🤖 Analysis & Insights', { underline: true });

    doc.moveDown(1);

    doc.fontSize(11)
        .fillColor('#333')
        .text(reportData.aiAnalysis || 'No analysis available', {
            align: 'justify',
            lineGap: 5
        });

    doc.moveDown(3);

    // Footer
    doc.fontSize(9)
        .fillColor('#999')
        .text(`Generated on ${new Date().toLocaleDateString()}`, {
            align: 'center'
        });

    doc.text('Powered by Evangelism Reporter Bot', {
        align: 'center'
    });
}

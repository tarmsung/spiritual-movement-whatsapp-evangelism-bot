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
 * Generate publication-quality PDF report from monthly data (SMC format)
 * @param {Object} reportData - Monthly report data with SMC structure
 * @returns {Promise<string>} Path to generated PDF
 */
export async function generatePDFReport(reportData) {
    const assemblySlug = (reportData.assemblyName || 'all').replace(/\s+/g, '_');
    const filename = `evangelism_report_${assemblySlug}_${reportData.startDate}_to_${reportData.endDate}.pdf`;
    const filepath = join(REPORTS_DIR, filename);

    logger.info(`Generating PDF report for ${reportData.assemblyName || 'All Assemblies'}: ${filename}`);

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

            // Build PDF content with SMC structure
            buildSMCPDFContent(doc, reportData);

            // Finalize PDF
            doc.end();

            stream.on('finish', () => {
                logger.info(`SMC PDF report generated: ${filepath}`);
                resolve(filepath);
            });

            stream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Build SMC-formatted PDF content
 */
function buildSMCPDFContent(doc, reportData) {
    const pageWidth = doc.page.width - 100; // Account for margins

    // ===== HEADER =====
    doc.fontSize(24)
        .fillColor('#1a1a1a')
        .font('Helvetica-Bold')
        .text('MONTHLY MINISTRY REPORT', { align: 'center' });

    doc.moveDown(0.5);

    // Assembly name prominently displayed
    if (reportData.assemblyName) {
        doc.fontSize(20)
            .fillColor('#222')
            .font('Helvetica-Bold')
            .text(reportData.assemblyName, { align: 'center' });
        doc.moveDown(0.3);
    }

    doc.fontSize(18)
        .fillColor('#333')
        .font('Helvetica')
        .text(reportData.period, { align: 'center' });

    doc.moveDown(2);

    // Horizontal line
    doc.strokeColor('#ddd')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

    doc.moveDown(2);

    // ===== NARRATIVE REPORT SECTION =====
    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .font('Helvetica-Bold')
        .text('NARRATIVE REPORT', { underline: true });

    doc.moveDown(1);

    if (reportData.narrative) {
        doc.fontSize(11)
            .fillColor('#333')
            .font('Helvetica')
            .text(reportData.narrative, {
                align: 'justify',
                lineGap: 4
            });
    } else {
        doc.fontSize(11)
            .fillColor('#999')
            .text('No narrative available');
    }

    doc.moveDown(2);

    // Horizontal line
    doc.strokeColor('#ddd')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

    doc.moveDown(2);

    // ===== QUANTIFIED FRUIT SECTION =====
    const fruitTitle = `${reportData.period.toUpperCase()} FRUIT`;
    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .font('Helvetica-Bold')
        .text(fruitTitle, { underline: true });

    doc.moveDown(1);

    // Souls Added
    doc.fontSize(14)
        .fillColor('#333')
        .font('Helvetica-Bold')
        .text('Souls Added');

    doc.fontSize(12)
        .fillColor('#000')
        .font('Helvetica')
        .text(`${reportData.overall.totalConversions} people gave their lives to Christ.`);

    doc.moveDown(1);

    // Healing Ministry
    doc.fontSize(14)
        .fillColor('#333')
        .font('Helvetica-Bold')
        .text('Healing Ministry');

    doc.fontSize(12)
        .fillColor('#000')
        .font('Helvetica')
        .text(`${reportData.overall.totalReached} individuals were prayed for in sickness.`);

    doc.moveDown(2);

    // Horizontal line
    doc.strokeColor('#ddd')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

    doc.moveDown(2);

    // ===== LABOURERS IN THE FIELD SECTION =====
    // Check if we need a new page
    if (doc.y > doc.page.height - 250) {
        doc.addPage();
    }

    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .font('Helvetica-Bold')
        .text('LABOURERS IN THE FIELD', { underline: true });

    doc.moveDown(1);

    if (reportData.labourers && reportData.labourers.length > 0) {
        doc.fontSize(11)
            .fillColor('#333')
            .font('Helvetica');

        reportData.labourers.forEach(labourer => {
            doc.text(`• ${labourer}`, { indent: 20 });
            doc.moveDown(0.5);
        });
    } else {
        doc.fontSize(11)
            .fillColor('#999')
            .font('Helvetica')
            .text('No labourers data available');
    }

    doc.moveDown(2);

    // ===== FIELDS ENTERED SECTION (New Page) =====
    doc.addPage();

    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .font('Helvetica-Bold')
        .text('FIELDS ENTERED', { underline: true });

    doc.moveDown(1);

    // Embed map if it exists
    if (reportData.mapImagePath && existsSync(reportData.mapImagePath)) {
        try {
            doc.image(reportData.mapImagePath, {
                fit: [500, 400],
                align: 'center'
            });
            doc.moveDown(1);
        } catch (error) {
            logger.error('Error embedding map image:', error);
        }
    }

    // List locations below map
    if (reportData.locations && reportData.locations.length > 0) {
        doc.fontSize(11)
            .fillColor('#333')
            .font('Helvetica')
            .text(reportData.locations.join(', '), {
                align: 'justify'
            });
    } else {
        doc.fontSize(11)
            .fillColor('#999')
            .text('No location data available');
    }

    doc.moveDown(3);

    // Horizontal line
    doc.strokeColor('#ddd')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

    doc.moveDown(2);

    // ===== MESSAGE EMPHASIS SECTION =====
    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .font('Helvetica-Bold')
        .text('MESSAGE EMPHASIS', { underline: true });

    doc.moveDown(1);

    if (reportData.messageEmphasis && reportData.messageEmphasis.length > 0) {
        doc.fontSize(11)
            .fillColor('#333')
            .font('Helvetica');

        reportData.messageEmphasis.forEach(item => {
            doc.text(`• ${item}`, { indent: 20 });
            doc.moveDown(0.5);
        });
    } else {
        doc.fontSize(11)
            .fillColor('#999')
            .text('No message emphasis data available');
    }

    doc.moveDown(2);

    // Horizontal line
    doc.strokeColor('#ddd')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

    doc.moveDown(2);

    // ===== CONCLUSION SECTION =====
    doc.fontSize(18)
        .fillColor('#1a1a1a')
        .font('Helvetica-Bold')
        .text('CONCLUSION', { underline: true });

    doc.moveDown(1);

    if (reportData.conclusion) {
        doc.fontSize(11)
            .fillColor('#333')
            .font('Helvetica')
            .text(reportData.conclusion, {
                align: 'justify',
                lineGap: 4
            });
    } else {
        doc.fontSize(11)
            .fillColor('#999')
            .text('No conclusion available');
    }

    doc.moveDown(3);

    // ===== FOOTER =====
    doc.fontSize(9)
        .fillColor('#999')
        .font('Helvetica')
        .text(`Generated on ${new Date().toLocaleDateString()}`, {
            align: 'center'
        });

    doc.text('Powered by Evangelism Reporter Bot', {
        align: 'center'
    });
}

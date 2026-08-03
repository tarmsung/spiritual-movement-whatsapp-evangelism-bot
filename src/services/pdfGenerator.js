import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    ShadingType,
    VerticalAlign,
    PageNumber,
    Header,
    Footer,
    ImageRun,
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
    convertInchesToTwip
} from 'docx';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCanvas, loadImage } from 'canvas';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPORTS_DIR = join(__dirname, '../../reports');
const WATERMARK_PATH = join(__dirname, '../../watermark_logo_v2.png');

// Ensure reports directory exists
if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
}

// ─── Colour palette rotation ────────────────────────────────────────────────
// Each entry: { primary, accent, headerText, accentText }
const PALETTES = [
    { primary: '1B2A4A', accent: 'B8912A', headerText: 'FFFFFF', accentText: '1B2A4A' }, // navy/gold
    { primary: '1A3A2A', accent: 'A0622A', headerText: 'FFFFFF', accentText: '1A3A2A' }, // deep green/copper
    { primary: '5C1A2E', accent: 'F5F0E8', headerText: 'FFFFFF', accentText: '5C1A2E' }, // burgundy/cream
    { primary: '2E3535', accent: '3A8A8A', headerText: 'FFFFFF', accentText: '2E3535' }, // charcoal/teal
    { primary: '3A3A5C', accent: 'C0A080', headerText: 'FFFFFF', accentText: '3A3A5C' }, // slate/rose-gold
    { primary: '0D1B2A', accent: 'A8B8C8', headerText: 'FFFFFF', accentText: '0D1B2A' }, // midnight blue/silver
    { primary: '1A3A1A', accent: 'C8961A', headerText: 'FFFFFF', accentText: '1A3A1A' }, // forest green/amber
    { primary: '3A3018', accent: 'B05A30', headerText: 'FFFFFF', accentText: '3A3018' }, // olive/terracotta
    { primary: '2A1A4A', accent: 'A8B8C8', headerText: 'FFFFFF', accentText: '2A1A4A' }, // deep indigo/silver
    { primary: '5C1A2E', accent: 'B8912A', headerText: 'FFFFFF', accentText: '5C1A2E' }, // warm burgundy/gold
];

/**
 * Pick a palette deterministically based on the report period string so the
 * same month always gets the same colour, but consecutive months differ.
 */
function pickPalette(period) {
    let hash = 0;
    for (let i = 0; i < period.length; i++) {
        hash = (hash * 31 + period.charCodeAt(i)) & 0xffff;
    }
    return PALETTES[hash % PALETTES.length];
}

// ─── Rich-text parser ────────────────────────────────────────────────────────
/**
 * Parse a string containing **bold** markers into an array of TextRun objects.
 * Also handles **Heading** lines (entire line bold, larger, coloured).
 */
function parseInlineRuns(line, palette, opts = {}) {
    const parts = line.split(/(\*\*[^*]+\*\*)/);
    return parts
        .filter(p => p !== '')
        .map(part => {
            const isBold = part.startsWith('**') && part.endsWith('**');
            const text = isBold ? part.slice(2, -2) : part;
            return new TextRun({
                text,
                bold: isBold || opts.bold || false,
                size: opts.size || 22,          // half-points: 22 = 11pt
                color: opts.color || '222222',
                font: 'Palatino Linotype',
            });
        });
}

/**
 * Convert a rich-text block (with **bold** and blank-line paragraphs)
 * into an array of docx Paragraph objects.
 */
function richTextToParagraphs(text, palette, opts = {}) {
    if (!text) return [new Paragraph({ children: [] })];

    const paragraphs = [];
    const blocks = text.split(/\n\n+/);

    for (const block of blocks) {
        const lines = block.split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;

            // Bold-only heading line: **Heading**
            const headingMatch = line.trim().match(/^\*\*(.+?)\*\*\s*$/);
            if (headingMatch) {
                paragraphs.push(new Paragraph({
                    spacing: { before: 160, after: 60 },
                    children: [new TextRun({
                        text: headingMatch[1],
                        bold: true,
                        size: 22,
                        color: palette.primary,
                        font: 'Palatino Linotype',
                    })]
                }));
            } else {
                paragraphs.push(new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { before: 0, after: 80 },
                    children: parseInlineRuns(line, palette, opts)
                }));
            }
        }
        // Extra space between blocks
        paragraphs.push(new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }));
    }

    return paragraphs;
}

// ─── Section heading ─────────────────────────────────────────────────────────
function sectionHeadingParagraph(title, palette, opts = {}) {
    return new Paragraph({
        spacing: { before: opts.pageBreakBefore ? 0 : 360, after: 120 },
        pageBreakBefore: opts.pageBreakBefore || false,
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: palette.accent }
        },
        children: [
            new TextRun({
                text: title.toUpperCase(),
                bold: true,
                size: 24,             // 12pt
                color: palette.primary,
                font: 'Palatino Linotype',
                characterSpacing: 40,
            })
        ]
    });
}

// ─── Watermark ───────────────────────────────────────────────────────────────
// Opacity to apply to the watermark logo (0–1). 0.28 ≈ 28% per the style guide.
const WATERMARK_OPACITY = 0.28;

// Cache the processed watermark buffer so canvas work only runs once per session.
let _watermarkCache = null;
let _watermarkCacheAttempted = false;

/**
 * Load the watermark logo, composite it at WATERMARK_OPACITY over a white
 * background using `canvas`, and return the resulting PNG Buffer.
 * Returns null if the file is missing or processing fails.
 */
async function buildWatermarkBuffer() {
    if (_watermarkCacheAttempted) return _watermarkCache;
    _watermarkCacheAttempted = true;

    if (!existsSync(WATERMARK_PATH)) {
        logger.warn('Watermark file not found:', WATERMARK_PATH);
        return null;
    }

    try {
        const img = await loadImage(WATERMARK_PATH);
        const SIZE = 400; // output dimensions in pixels (matches ImageRun transformation)
        const canvas = createCanvas(SIZE, SIZE);
        const ctx = canvas.getContext('2d');

        // White background so the washed-out logo blends correctly in Word
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, SIZE, SIZE);

        // Draw the logo at reduced opacity
        ctx.globalAlpha = WATERMARK_OPACITY;
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        ctx.globalAlpha = 1;

        _watermarkCache = canvas.toBuffer('image/png');
        logger.info(`Watermark processed at ${WATERMARK_OPACITY * 100}% opacity`);
        return _watermarkCache;
    } catch (e) {
        logger.warn('Could not process watermark image:', e.message);
        return null;
    }
}

/**
 * Build the ImageRun for the watermark, using the pre-baked low-opacity PNG.
 * Must be called with await.
 */
async function buildWatermark() {
    const imageData = await buildWatermarkBuffer();
    if (!imageData) return null;
    return new ImageRun({
        data: imageData,
        transformation: { width: 400, height: 400 },
        floating: {
            behindDocument: true,
            horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                align: 'center',
            },
            verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                align: 'center',
            },
        },
    });
}

// ─── Stats table ─────────────────────────────────────────────────────────────
function buildStatsTable(reportData, palette) {
    const cols = [
        { label: 'EVANGELISTS',     value: reportData.labourers ? reportData.labourers.length : 0 },
        { label: 'SOULS SAVED',     value: reportData.totalSaved || 0 },
        { label: 'SICK PRAYED FOR', value: reportData.totalHealed || 0 },
        { label: 'OPPORTUNITIES',   value: reportData.totalOutreaches || 0 },
        { label: 'LOCATIONS',       value: reportData.locations ? reportData.locations.length : 0 },
    ];

    const cellWidth = Math.floor(9638 / cols.length); // total usable width in twips / cols

    const cells = cols.map((col, idx) => {
        // Alternate fills: even index = primary, odd index = accent
        const isAccent = idx % 2 === 1;
        const cellFill  = isAccent ? palette.accent  : palette.primary;
        // Label colour: muted on dark cells, slightly darker muted on accent cells
        const labelColor = isAccent ? '555555' : 'AAAAAA';
        // Value colour: always white on primary; dark on light accent cells
        // We check if accent is light (starts with F or E or high-brightness hex)
        const isLightAccent = /^[EFef]/.test(palette.accent);
        const valueColor = isAccent && isLightAccent ? palette.primary : 'FFFFFF';

        return new TableCell({
            width: { size: cellWidth, type: WidthType.DXA },
            verticalAlign: VerticalAlign.BOTTOM,
            shading: { type: ShadingType.SOLID, fill: cellFill },
            margins: { top: 120, bottom: 120, left: 80, right: 80 },
            borders: {
                top:    { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left:   { style: BorderStyle.NONE },
                // Thin divider in accent colour between cells
                right:  { style: BorderStyle.SINGLE, size: 6, color: palette.accent },
            },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 40 },
                    children: [new TextRun({
                        text: col.label,
                        size: 14,    // 7pt
                        color: labelColor,
                        bold: false,
                        font: 'Helvetica Neue',
                        characterSpacing: 20,
                    })]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [new TextRun({
                        text: String(col.value),
                        size: 52,    // 26pt
                        color: valueColor,
                        bold: true,
                        font: 'Palatino Linotype',
                    })]
                }),
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: cells })],
        borders: {
            top:    { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left:   { style: BorderStyle.NONE },
            right:  { style: BorderStyle.NONE },
        },
    });
}

// ─── Scripture block ──────────────────────────────────────────────────────────
function buildScriptureBlock(text, palette) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 480 },
        border: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: palette.accent },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: palette.accent },
        },
        children: [new TextRun({
            text,
            italics: true,
            size: 22,
            color: '444444',
            font: 'Palatino Linotype',
        })]
    });
}

// ─── Main document builder ────────────────────────────────────────────────────
/**
 * Build and write the complete DOCX report for one cluster.
 * Returns the output file path.
 */
async function buildDocxReport(reportData) {
    const palette = pickPalette(reportData.period || '');
    const watermarkRun = await buildWatermark();

    // ── Helper: build a watermarked header paragraph for each page ──
    const watermarkHeader = watermarkRun
        ? new Header({ children: [new Paragraph({ children: [watermarkRun] })] })
        : undefined;

    // ── Section 1: Cover / Header ──────────────────────────────────
    const headerBlock = [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [new TextRun({
                text: 'SPIRITUAL MOVEMENT CRUSADERS',
                size: 18,
                color: '888888',
                characterSpacing: 60,
                font: 'Palatino Linotype',
            })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [new TextRun({
                text: reportData.assemblyName || '',
                size: 52,
                bold: true,
                color: palette.primary,
                font: 'Palatino Linotype',
            })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [new TextRun({
                text: reportData.period || '',
                size: 28,
                color: '444444',
                font: 'Palatino Linotype',
            })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 240 },
            children: [new TextRun({
                text: 'Field Report',
                size: 18,
                color: '999999',
                characterSpacing: 40,
                font: 'Palatino Linotype',
            })]
        }),
        // Divider
        new Paragraph({
            spacing: { before: 0, after: 320 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: palette.primary } },
            children: []
        }),
    ];

    // ── Section 2: Month at a Glance ───────────────────────────────
    const glanceBlock = [
        sectionHeadingParagraph('The Month at a Glance', palette),
        buildStatsTable(reportData, palette),
        new Paragraph({ spacing: { before: 240, after: 0 }, children: [] }),
    ];

    // ── Section 3: From the Field ──────────────────────────────────
    const fromTheFieldText = reportData.fromTheField || reportData.narrative || '';
    const fromTheFieldBlock = [
        sectionHeadingParagraph('From the Field', palette),
        ...richTextToParagraphs(fromTheFieldText, palette),
    ];

    // ── Section 4: Encounters from the Month ──────────────────────
    const encountersBlock = [
        sectionHeadingParagraph('Encounters from the Month', palette, { pageBreakBefore: true }),
        ...richTextToParagraphs(reportData.encounters || '', palette),
    ];

    // ── Section 5: What We Preached ────────────────────────────────
    const preachedText = Array.isArray(reportData.whatWePreached)
        ? reportData.whatWePreached.join('\n\n')
        : (reportData.whatWePreached || '');
    const preachedBlock = [
        sectionHeadingParagraph('What We Preached', palette, { pageBreakBefore: true }),
        ...richTextToParagraphs(preachedText, palette),
    ];

    // ── Section 6: Honest Reflection ───────────────────────────────
    const reflectionBlock = [
        sectionHeadingParagraph('Honest Reflection', palette, { pageBreakBefore: true }),
        ...richTextToParagraphs(reportData.honestReflection || '', palette),
    ];

    // ── Section 7: Closing Word ────────────────────────────────────
    const closingWordText = reportData.closingWord || reportData.conclusion || '';
    const closingWordBlock = [
        sectionHeadingParagraph('Closing Word', palette, { pageBreakBefore: true }),
        ...richTextToParagraphs(closingWordText, palette),
    ];

    // ── Section 8: Closing Scripture ──────────────────────────────
    const scriptureBlock = reportData.closingScripture
        ? [buildScriptureBlock(reportData.closingScripture, palette)]
        : [];

    // ── Footer ─────────────────────────────────────────────────────
    const footerParagraph = new Footer({
        children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
                text: `Spiritual Movement Crusaders · ${reportData.period || ''} · `,
                size: 16,
                color: 'AAAAAA',
                font: 'Palatino Linotype',
            }),
            new TextRun({
                children: [PageNumber.CURRENT],
                size: 16,
                color: 'AAAAAA',
                font: 'Palatino Linotype',
            })]
        })]
    });

    // ── Assemble document ──────────────────────────────────────────
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: 'Palatino Linotype', size: 22, color: '222222' },
                    paragraph: { spacing: { line: 340 } }  // 1.4 line spacing
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top:    convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left:   convertInchesToTwip(1.1),
                        right:  convertInchesToTwip(1.1),
                    }
                }
            },
            headers: watermarkHeader ? { default: watermarkHeader } : undefined,
            footers: { default: footerParagraph },
            children: [
                ...headerBlock,
                ...glanceBlock,
                ...fromTheFieldBlock,
                ...encountersBlock,
                ...preachedBlock,
                ...reflectionBlock,
                ...closingWordBlock,
                ...scriptureBlock,
            ]
        }]
    });

    return doc;
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Generate a DOCX cluster field report.
 * Named generatePDFReport for backward compatibility with all callers.
 * Returns the path to the generated .docx file.
 *
 * @param {Object} reportData
 * @returns {Promise<string>} Absolute path to the generated .docx file
 */
export async function generatePDFReport(reportData) {
    const assemblySlug = (reportData.assemblyName || 'cluster').replace(/\s+/g, '_');
    const filename = `field_report_${assemblySlug}_${reportData.startDate}_to_${reportData.endDate}.docx`;
    const filepath = join(REPORTS_DIR, filename);

    logger.info(`Generating DOCX report for ${reportData.assemblyName || 'Cluster'}: ${filename}`);

    try {
        const doc = await buildDocxReport(reportData);
        const buffer = await Packer.toBuffer(doc);
        writeFileSync(filepath, buffer);
        logger.info(`DOCX report generated: ${filepath}`);
        return filepath;
    } catch (error) {
        logger.error('Error generating DOCX report:', error);
        throw error;
    }
}

// ─── SM Youth Convention DOCX ────────────────────────────────────────────────

/**
 * Build a DOCX document for the SM Youth Convention extraction report.
 * Organises the four themes (Rejection, Failure, Anxiety, Delay) plus
 * the cross-cluster observation into a clean, branded document.
 *
 * @param {Object} data
 * @param {string} data.assemblyName
 * @param {string} data.period
 * @param {string} data.startDate
 * @param {string} data.endDate
 * @param {number} data.totalReports
 * @param {string} data.rejection
 * @param {string} data.failure
 * @param {string} data.anxiety
 * @param {string} data.delay
 * @param {string} data.crossCluster
 * @returns {Promise<string>} Absolute path to the generated .docx file
 */
export async function generateSmYouthDocx(data) {
    const palette    = pickPalette(data.period || 'youth');
    const watermarkRun = await buildWatermark();

    const watermarkHeader = watermarkRun
        ? new Header({ children: [new Paragraph({ children: [watermarkRun] })] })
        : undefined;

    // ── Cover block ─────────────────────────────────────────────────
    const coverBlock = [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [new TextRun({
                text: 'SPIRITUAL MOVEMENT CRUSADERS',
                size: 18,
                color: '888888',
                characterSpacing: 60,
                font: 'Palatino Linotype',
            })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [new TextRun({
                text: 'SM YOUTH',
                size: 52,
                bold: true,
                color: palette.primary,
                font: 'Palatino Linotype',
            })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [new TextRun({
                text: 'Field Example Extraction',
                size: 28,
                color: '444444',
                font: 'Palatino Linotype',
            })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [new TextRun({
                text: `${data.assemblyName} · ${data.period}`,
                size: 22,
                color: '666666',
                font: 'Palatino Linotype',
            })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 60 },
            children: [new TextRun({
                text: '"Evangelism: Facing Rejection, Failure, Anxiety and Delay with God"',
                italics: true,
                size: 20,
                color: '888888',
                font: 'Palatino Linotype',
            })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 60 },
            children: [new TextRun({
                text: `Source reports: ${data.totalReports}`,
                size: 18,
                color: 'AAAAAA',
                font: 'Palatino Linotype',
            })]
        }),
        // Divider
        new Paragraph({
            spacing: { before: 0, after: 320 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: palette.primary } },
            children: []
        }),
    ];

    // ── Theme sections ───────────────────────────────────────────────
    const THEME_ICONS = {
        rejection:    '✋ REJECTION',
        failure:      '🚪 FAILURE',
        anxiety:      '💬 ANXIETY',
        delay:        '⏳ DELAY',
        crossCluster: '🔍 CROSS-CLUSTER OBSERVATION',
    };

    const themeOrder = ['rejection', 'failure', 'anxiety', 'delay', 'crossCluster'];

    const themeBlocks = themeOrder.flatMap((key, idx) => {
        const text  = data[key];
        const title = THEME_ICONS[key];
        return [
            sectionHeadingParagraph(title, palette, { pageBreakBefore: idx > 0 }),
            ...(text
                ? richTextToParagraphs(text, palette)
                : [new Paragraph({
                    spacing: { before: 60, after: 60 },
                    children: [new TextRun({
                        text: '(No examples found for this theme in the selected reports.)',
                        italics: true,
                        size: 22,
                        color: '888888',
                        font: 'Palatino Linotype',
                    })]
                })]
            ),
        ];
    });

    // ── Footer ───────────────────────────────────────────────────────
    const footerParagraph = new Footer({
        children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({
                    text: `SM Youth · ${data.assemblyName} · ${data.period} · `,
                    size: 16,
                    color: 'AAAAAA',
                    font: 'Palatino Linotype',
                }),
                new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: 'AAAAAA',
                    font: 'Palatino Linotype',
                }),
            ]
        })]
    });

    // ── Assemble document ────────────────────────────────────────────
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: 'Palatino Linotype', size: 22, color: '222222' },
                    paragraph: { spacing: { line: 340 } }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top:    convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left:   convertInchesToTwip(1.1),
                        right:  convertInchesToTwip(1.1),
                    }
                }
            },
            headers: watermarkHeader ? { default: watermarkHeader } : undefined,
            footers: { default: footerParagraph },
            children: [
                ...coverBlock,
                ...themeBlocks,
            ]
        }]
    });

    // ── Write to disk ────────────────────────────────────────────────
    const assemblySlug = (data.assemblyName || 'cluster').replace(/\s+/g, '_');
    const filename  = `sm_youth_${assemblySlug}_${data.startDate}_to_${data.endDate}.docx`;
    const filepath  = join(REPORTS_DIR, filename);

    logger.info(`[SMYouth] Generating DOCX: ${filename}`);
    const buffer = await Packer.toBuffer(doc);
    writeFileSync(filepath, buffer);
    logger.info(`[SMYouth] DOCX generated: ${filepath}`);
    return filepath;
}

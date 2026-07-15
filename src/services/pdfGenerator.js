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
    HeadingLevel,
    BorderStyle,
    ShadingType,
    VerticalAlign,
    PageNumber,
    Header,
    Footer,
    ImageRun,
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
    HorizontalPositionAlign,
    VerticalPositionAlign,
    TableLayoutType,
    convertInchesToTwip,
    UnderlineType
} from 'docx';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
function sectionHeadingParagraph(title, palette) {
    return new Paragraph({
        spacing: { before: 360, after: 120 },
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: palette.primary }
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
function buildWatermark() {
    if (!existsSync(WATERMARK_PATH)) return null;
    try {
        const imageData = readFileSync(WATERMARK_PATH);
        return new ImageRun({
            data: imageData,
            transformation: { width: 400, height: 400 },
            floating: {
                behindDocument: true,
                horizontalPosition: {
                    relative: HorizontalPositionRelativeFrom.PAGE,
                    align: HorizontalPositionAlign.CENTER,
                },
                verticalPosition: {
                    relative: VerticalPositionRelativeFrom.PAGE,
                    align: VerticalPositionAlign.CENTER,
                },
            },
            transparency: 72,   // ~28% opacity (100 - 72 = 28%)
        });
    } catch (e) {
        logger.warn('Could not load watermark image:', e.message);
        return null;
    }
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

    const cells = cols.map(col => new TableCell({
        width: { size: cellWidth, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.SOLID, fill: palette.primary },
        margins: { top: 120, bottom: 120, left: 80, right: 80 },
        borders: {
            top:    { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left:   { style: BorderStyle.NONE },
            right:  { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' },
        },
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 40 },
                children: [new TextRun({
                    text: col.label,
                    size: 14,    // 7pt
                    color: 'AAAAAA',
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
                    color: 'FFFFFF',
                    bold: true,
                    font: 'Palatino Linotype',
                })]
            }),
        ]
    }));

    return new Table({
        layout: TableLayoutType.FIXED,
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
    const watermarkRun = buildWatermark();

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
        sectionHeadingParagraph('Encounters from the Month', palette),
        ...richTextToParagraphs(reportData.encounters || '', palette),
    ];

    // ── Section 5: What We Preached ────────────────────────────────
    const preachedText = Array.isArray(reportData.whatWePreached)
        ? reportData.whatWePreached.join('\n\n')
        : (reportData.whatWePreached || '');
    const preachedBlock = [
        sectionHeadingParagraph('What We Preached', palette),
        ...richTextToParagraphs(preachedText, palette),
    ];

    // ── Section 6: Honest Reflection ───────────────────────────────
    const reflectionBlock = [
        sectionHeadingParagraph('Honest Reflection', palette),
        ...richTextToParagraphs(reportData.honestReflection || '', palette),
    ];

    // ── Section 7: Closing Word ────────────────────────────────────
    const closingWordText = reportData.closingWord || reportData.conclusion || '';
    const closingWordBlock = [
        sectionHeadingParagraph('Closing Word', palette),
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

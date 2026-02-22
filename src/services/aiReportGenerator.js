import OpenAI from 'openai';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import {
    getAllAssemblies,
    getReportsForAssembly
} from '../database/db.js';
import { getMonthName } from '../utils/helpers.js';
import { detectCommand, DEFAULT_COMMAND } from '../config/smc_reporting_commands.js';
import { generateLocationPlot } from './coordinateMapGenerator.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPORTS_DIR = join(__dirname, '../../reports');

/**
 * Generate AI-powered evangelism reports for ALL assemblies
 * Each assembly gets its own separate report
 * @param {string} startDate - Report start date (YYYY-MM-DD)
 * @param {string} endDate - Report end date (YYYY-MM-DD)
 * @param {Object} options - Report options
 * @returns {Promise<Array>} Array of report data objects (one per assembly)
 */
export async function generateAssemblyReports(startDate, endDate, options = {}) {
    logger.info(`Generating assembly-based reports for ${startDate} to ${endDate}`);

    const assemblies = await getAllAssemblies();
    const reports = [];

    for (const assembly of assemblies) {
        try {
            const report = await generateAssemblyReport(assembly, startDate, endDate, options);

            // Only include assemblies that have data for this period
            if (report.totalOutreaches > 0) {
                reports.push(report);
                logger.info(`Report generated for ${assembly.name}: ${report.totalOutreaches} outreaches`);
            } else {
                logger.info(`Skipping ${assembly.name} - no reports in this period`);
            }
        } catch (error) {
            logger.error(`Error generating report for ${assembly.name}:`, error);
        }
    }

    logger.info(`Generated ${reports.length} assembly reports`);
    return reports;
}

/**
 * Generate a report for a single assembly
 * @param {Object} assembly - Assembly object { id, name }
 * @param {string} startDate - Report start date (YYYY-MM-DD)
 * @param {string} endDate - Report end date (YYYY-MM-DD)
 * @param {Object} options - Report options
 * @returns {Promise<Object>} Report data for this assembly
 */
export async function generateAssemblyReport(assembly, startDate, endDate, options = {}) {
    const command = detectCommand(options.command || DEFAULT_COMMAND.name);

    // Fetch only the needed fields for this assembly
    const reports = await getReportsForAssembly(assembly.id, startDate, endDate);

    // Extract and deduplicate data
    const uniqueLocations = deduplicateLocations(
        reports.map(r => r.location).filter(Boolean)
    );

    const uniquePreachers = deduplicateLabourers(
        reports.flatMap(r => {
            if (!r.preachers_team) return [];
            // Split on comma AND 'and' (surrounded by spaces)
            return r.preachers_team
                .split(/,|\s+and\s+/i)
                .map(n => n.trim());
        }).filter(Boolean)
    );

    const uniqueActivityTypes = deduplicateList(
        reports.map(r => r.activity_type).filter(Boolean)
    );

    const messageSummaries = reports
        .map(r => r.message_summary)
        .filter(Boolean);

    // Aggregate stats
    const totalSaved = reports.reduce((sum, r) => sum + (r.saved || 0), 0);
    const totalHealed = reports.reduce((sum, r) => sum + (r.healed || 0), 0);

    // Build report data
    const reportData = {
        assemblyName: assembly.name,
        period: options.periodTitle || getMonthName(startDate),
        startDate,
        endDate,
        command: command.name,
        totalOutreaches: reports.length,
        totalSaved,
        totalHealed,
        locations: uniqueLocations,
        labourers: uniquePreachers,
        activityTypes: uniqueActivityTypes,
        messageSummaries,
        // Keep overall for backward compatibility with PDF generator
        overall: {
            totalReports: reports.length,
            totalSaved: totalSaved,
            totalHealed: totalHealed
        }
    };

    // Generate AI narrative
    if (config.openaiApiKey) {
        try {
            const narrative = await generateNarrative(reportData, command);
            reportData.narrative = narrative.narrative;
            reportData.messageEmphasis = narrative.messageEmphasis;
            reportData.conclusion = narrative.conclusion;
        } catch (error) {
            logger.error(`Error generating AI narrative for ${assembly.name}:`, error);
            reportData.narrative = generateFallbackNarrative(reportData);
            reportData.messageEmphasis = generateFallbackMessageEmphasis();
            reportData.conclusion = generateFallbackConclusion(reportData);
        }
    } else {
        logger.info('No OpenAI API key - using fallback narrative');
        reportData.narrative = generateFallbackNarrative(reportData);
        reportData.messageEmphasis = generateFallbackMessageEmphasis();
        reportData.conclusion = generateFallbackConclusion(reportData);
    }

    // Generate location map if multiple locations
    if (uniqueLocations.length > 1) {
        try {
            const mapPath = join(REPORTS_DIR, `map_${assembly.name.replace(/\s+/g, '_')}_${startDate}.png`);
            const title = `${assembly.name} - ${reportData.period} Evangelism Locations`;
            await generateLocationPlot(uniqueLocations, title, mapPath);
            reportData.mapImagePath = mapPath;
        } catch (error) {
            logger.error('Error generating location map:', error);
            reportData.mapImagePath = null;
        }
    } else {
        reportData.mapImagePath = null;
    }

    return reportData;
}

/**
 * Deduplicate a list of strings (case-insensitive)
 * Keeps the first occurrence's casing
 * @param {string[]} items - Array of strings to deduplicate
 * @returns {string[]} Deduplicated sorted array
 */
function deduplicateList(items) {
    const seen = new Map();
    items.forEach(item => {
        const key = item.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.set(key, item.trim());
        }
    });
    return Array.from(seen.values()).sort();
}

/**
 * Normalize a person's name for deduplication:
 * - Strip trailing punctuation (periods, commas)
 * - Normalize titles: Br/Brother → Brother, Sr/Sister → Sister
 * - Normalize Mrs./Mrs/Mr./Mr
 * - Collapse whitespace
 */
function normalizePersonName(name) {
    let n = name.trim();
    // Strip trailing punctuation
    n = n.replace(/[.,;:!]+$/, '').trim();
    // Collapse whitespace
    n = n.replace(/\s+/g, ' ');
    // Remove leading slash or "and" fragments
    n = n.replace(/^\/\s*/, '').trim();
    // Normalize titles to a canonical form for comparison
    // "Br " → "Brother ", "Sr " → "Sister ", "Mrs." → "Mrs", "Mr." → "Mr"
    return n;
}

/**
 * Create a comparison key for a person's name.
 * Normalizes prefixes so that "Br Tadiwa" and "Brother Tadiwa" generate the same key.
 */
function personKey(name) {
    let key = name.toLowerCase().trim();
    // Strip trailing punctuation
    key = key.replace(/[.,;:!/]+$/, '').trim();
    // Collapse whitespace
    key = key.replace(/\s+/g, ' ');
    // Normalize title prefixes
    key = key.replace(/^brother\s+/i, 'br ');
    key = key.replace(/^sister\s+/i, 'sr ');
    key = key.replace(/^mrs\.?\s+/i, 'mrs ');
    key = key.replace(/^mr\.?\s+/i, 'mr ');
    key = key.replace(/^pastor\s+/i, 'pastor ');
    return key;
}

/** Entries to filter out entirely */
const JUNK_NAMES = ['not specified', 'unknown', 'n/a', 'none', '-', ''];

/**
 * Deduplicate labourers/preachers with smart name normalization
 * Handles: trailing periods, Br/Brother variants, junk entries
 */
function deduplicateLabourers(items) {
    const seen = new Map();
    items.forEach(item => {
        const cleaned = normalizePersonName(item);
        // Filter junk entries
        if (JUNK_NAMES.includes(cleaned.toLowerCase())) return;
        // Filter entries that are too short (e.g., just "and")
        if (cleaned.length < 3) return;

        const key = personKey(cleaned);
        if (!seen.has(key)) {
            seen.set(key, cleaned);
        }
    });
    return Array.from(seen.values()).sort();
}

/**
 * Normalize a location string for comparison:
 * - Strip trailing punctuation
 * - Collapse whitespace around slashes
 * - Remove wrapping parentheses
 * - Collapse multiple spaces
 */
function locationKey(loc) {
    let key = loc.toLowerCase().trim();
    // Strip trailing punctuation
    key = key.replace(/[.,;:!]+$/, '').trim();
    // Remove wrapping parentheses
    key = key.replace(/^\((.+)\)$/, '$1');
    // Normalize spaces around slashes
    key = key.replace(/\s*\/\s*/g, '/');
    // Collapse whitespace
    key = key.replace(/\s+/g, ' ');
    return key;
}

/**
 * Deduplicate locations with normalization
 * Handles: trailing periods, inconsistent spacing, wrapping parens
 */
function deduplicateLocations(items) {
    const seen = new Map();
    items.forEach(item => {
        const cleaned = item.trim().replace(/[.,;:!]+$/, '').trim();
        if (cleaned.length < 2) return;

        const key = locationKey(cleaned);
        if (!seen.has(key)) {
            seen.set(key, cleaned);
        }
    });
    return Array.from(seen.values()).sort();
}

/**
 * Generate narrative report using OpenAI with SMC authority voice
 */
async function generateNarrative(reportData, command) {
    const openai = new OpenAI({ apiKey: config.openaiApiKey });
    const prompt = buildNarrativePrompt(reportData, command);

    logger.info(`Generating narrative for ${reportData.assemblyName} with ${command.voice} voice`);

    const completion = await openai.chat.completions.create({
        model: 'gpt-5.2',
        messages: [
            {
                role: 'system',
                content: buildSystemPrompt(command)
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.7,
        max_completion_tokens: 2500
    });

    const response = completion.choices[0].message.content;
    return parseNarrativeResponse(response);
}

/**
 * Build system prompt based on SMC command
 */
function buildSystemPrompt(command) {
    let systemPrompt = 'You are writing a monthly evangelism ministry report for a specific cluster/assembly. ';

    if (command.voice === 'first_person') {
        systemPrompt += 'You are an EXECUTOR who was physically present during the evangelism activities. ';
        systemPrompt += 'Write in FIRST PERSON using "we", "our", "the Gospel was carried", etc. ';
        systemPrompt += 'Use an eyewitness, authoritative tone - you SAW these events and can describe resistance, perseverance, and fruit with conviction. ';
        systemPrompt += 'Write like the Book of Acts: factual, descriptive, emphasizing God\'s work through human obedience.';
    } else if (command.voice === 'luke_style_third_person') {
        systemPrompt += 'You are COMPILING testimony from executors who were present. You were NOT there. ';
        systemPrompt += 'Write in THIRD PERSON using "the evangelists", "they proclaimed", etc. ';
        systemPrompt += 'Use Luke 1:1-2 style: formal, compiled from eyewitness accounts. ';
        systemPrompt += 'Do NOT invent details. Stick to reported facts.';
    } else {
        systemPrompt += 'Write in neutral THIRD PERSON. Use "the team", "evangelists", etc.';
    }

    systemPrompt += '\n\nTone: perseverance, courage, faithful proclamation, spiritual resistance overcome through prayer and boldness.';
    systemPrompt += '\nStyle: formal but passionate, factual but faith-filled, sober but hopeful.';
    systemPrompt += '\n\nIMPORTANT: Only reference facts from the data provided. Do not invent specific incidents, names, or locations not in the data.';

    return systemPrompt;
}

/**
 * Build narrative prompt with only the selected fields
 */
function buildNarrativePrompt(reportData, command) {
    let prompt = `Write a monthly evangelism report for ${reportData.assemblyName} following this structure:\n\n`;

    prompt += `CONTEXT:\n`;
    prompt += `- Assembly/Cluster: ${reportData.assemblyName}\n`;
    prompt += `- Period: ${reportData.period}\n`;
    prompt += `- Reporting Command: ${command.name}\n`;
    prompt += `- Total Outreach Events: ${reportData.totalOutreaches}\n\n`;

    prompt += `STATISTICS:\n`;
    prompt += `- People Saved: ${reportData.totalSaved}\n`;
    prompt += `- People Healed: ${reportData.totalHealed}\n\n`;

    prompt += `LOCATIONS PREACHED AT (unique, already deduplicated):\n`;
    prompt += reportData.locations.map(l => `- ${l}`).join('\n');
    prompt += `\n\n`;

    prompt += `ACTIVITY TYPES (unique, already deduplicated):\n`;
    prompt += reportData.activityTypes.map(t => `- ${t}`).join('\n');
    prompt += `\n\n`;

    prompt += `LABOURERS / PREACHERS TEAM (unique, already deduplicated):\n`;
    prompt += reportData.labourers.map(l => `- ${l}`).join('\n');
    prompt += `\n\n`;

    if (reportData.messageSummaries.length > 0) {
        prompt += `MESSAGE SUMMARIES FROM INDIVIDUAL REPORTS (use these to identify themes):\n`;
        reportData.messageSummaries.forEach((summary, i) => {
            prompt += `${i + 1}. ${summary}\n`;
        });
        prompt += `\n`;
    }

    prompt += `INSTRUCTIONS:\n\n`;
    prompt += `Write a NARRATIVE REPORT section (3-4 paragraphs):\n`;
    prompt += `1. Opening: Describe how the Gospel was carried throughout the month in ${reportData.assemblyName}\n`;
    prompt += `   - Mention the specific locations listed above\n`;
    prompt += `   - Emphasize the message was not confined to church buildings but taken into daily life\n\n`;

    prompt += `2. Middle Paragraphs: Cover these themes\n`;
    prompt += `   - The clarity and conviction of the preaching (reference actual message summaries above)\n`;
    prompt += `   - Evangelists testified of their own deliverance from specific sins/bondages\n`;
    prompt += `   - Resistance encountered (interruptions, loud music, public objections, confrontation)\n`;
    prompt += `   - The Word did not cease - it continued with persistence and boldness\n`;
    prompt += `   - Some who initially mocked later listened in silence or continued conversations after the preaching\n`;
    prompt += `   - Prayer for the sick - hearts opened, space for salvation message\n\n`;

    prompt += `3. Closing: Summarize the month's work\n`;
    prompt += `   - Steady obedience rather than isolated enthusiasm\n`;
    prompt += `   - Gospel heard repeatedly across key areas\n`;
    prompt += `   - Seed sown consistently\n\n`;

    prompt += `Then provide:\n`;
    prompt += `MESSAGE EMPHASIS (5 bullet points):\n`;
    prompt += `- Derive these from the actual MESSAGE SUMMARIES provided above\n`;
    prompt += `- List the theological themes that were actually emphasized in the preaching\n\n`;

    prompt += `CONCLUSION (2-3 sentences):\n`;
    prompt += `- Summarize the month with themes of perseverance, courage, faithful proclamation\n`;
    prompt += `- Mention resistance in certain places, but the Word continued to be spoken\n`;
    prompt += `- Emphasize sustained obedience and foundation laid for future growth\n\n`;

    prompt += `Format your response EXACTLY like this:\n`;
    prompt += `NARRATIVE:\n[3-4 paragraphs here]\n\n`;
    prompt += `MESSAGE EMPHASIS:\n- [bullet 1]\n- [bullet 2]\n- [bullet 3]\n- [bullet 4]\n- [bullet 5]\n\n`;
    prompt += `CONCLUSION:\n[2-3 sentences here]`;

    return prompt;
}

/**
 * Parse AI response into structured sections
 */
function parseNarrativeResponse(response) {
    const sections = {
        narrative: '',
        messageEmphasis: [],
        conclusion: ''
    };

    // Extract MESSAGE EMPHASIS section
    const emphasisMatch = response.match(/MESSAGE EMPHASIS[:\s]+([\s\S]*?)(?=\n\nCONCLUSION|$)/i);
    if (emphasisMatch) {
        sections.messageEmphasis = emphasisMatch[1]
            .split('\n')
            .filter(line => line.trim().match(/^[-•*]/))
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(Boolean);
    }

    // Extract CONCLUSION section
    const conclusionMatch = response.match(/CONCLUSION[:\s]+([\s\S]+?)$/i);
    if (conclusionMatch) {
        sections.conclusion = conclusionMatch[1].trim();
    }

    // Extract NARRATIVE (everything before MESSAGE EMPHASIS)
    const narrativeMatch = response.match(/NARRATIVE[:\s]+([\s\S]*?)(?=\n\nMESSAGE EMPHASIS|$)/i);
    if (narrativeMatch) {
        sections.narrative = narrativeMatch[1].trim();
    } else {
        // Fallback: take everything before MESSAGE EMPHASIS
        const emphasisIndex = response.indexOf('MESSAGE EMPHASIS');
        if (emphasisIndex > 0) {
            sections.narrative = response.substring(0, emphasisIndex).trim();
        } else {
            sections.narrative = response.trim();
        }
    }

    return sections;
}

/**
 * Generate fallback narrative when AI is not available
 */
function generateFallbackNarrative(reportData) {
    const name = reportData.assemblyName;
    let narrative = `In ${reportData.period}, the Gospel was carried faithfully throughout ${name}. `;
    narrative += `Day after day, the Word of God was proclaimed in ${reportData.locations.join(', ') || 'various locations'}. `;
    narrative += `The message was not confined to church buildings but was taken into the ordinary flow of daily life.\n\n`;

    narrative += `The preaching throughout the month was marked by clarity and conviction. The call was not merely to religious affiliation, `;
    narrative += `but to repentance and true freedom from sin through Jesus Christ. Evangelists testified openly of their own deliverance from `;
    narrative += `immorality, ancestral practices, gossip, bitterness, drug abuse, and other forms of bondage. These testimonies became living proof `;
    narrative += `that the power of Christ is still able to transform lives.\n\n`;

    narrative += `In several places, resistance arose. There were interruptions, loud music intended to drown out the message, public objections, `;
    narrative += `and moments of confrontation. Yet the preaching did not cease. The Word continued to be declared with persistence and boldness. `;
    narrative += `In some instances, those who initially mocked later listened in silence. In others, conversations continued long after the `;
    narrative += `open-air preaching had ended.\n\n`;

    narrative += `Prayer for the sick accompanied the preaching of the Gospel. Individuals in pain and distress were prayed for across various locations. `;
    narrative += `These moments of prayer opened hearts and created space for the message of salvation to be received. `;
    narrative += `Throughout the month, the work reflected steady obedience rather than isolated enthusiasm. The Gospel was heard repeatedly across `;
    narrative += `key areas, and the seed was sown consistently.`;

    return narrative;
}

/**
 * Generate fallback message emphasis
 */
function generateFallbackMessageEmphasis() {
    return [
        'Repentance and remission of sins',
        'Holiness as evidence of salvation',
        'Christ as the only source of freedom',
        'A call beyond religious routine',
        'Preparation for eternity'
    ];
}

/**
 * Generate fallback conclusion
 */
function generateFallbackConclusion(reportData) {
    return `${reportData.period} in ${reportData.assemblyName} was marked by perseverance, courage, and faithful proclamation. ` +
        `Though resistance arose in certain places, the Word continued to be spoken. The Gospel moved through streets and transport routes, ` +
        `through homes and marketplaces, and into individual hearts. The work was carried out not as a single event, but as sustained obedience. ` +
        `The fruit recorded reflects continued labour in the field and a foundation laid for future growth.`;
}

// Keep backward compatibility - export old function name pointing to new logic
export { generateAssemblyReports as generateMonthlyReport };

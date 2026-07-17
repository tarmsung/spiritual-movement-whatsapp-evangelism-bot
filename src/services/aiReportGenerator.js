import Anthropic from '@anthropic-ai/sdk';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import {
    getAllAssemblies,
    getReportsForAssembly
} from '../database/db.js';
import { getPeriodName } from '../utils/helpers.js';
import { detectCommand, DEFAULT_COMMAND } from '../config/smc_reporting_commands.js';
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
        period: options.periodTitle || getPeriodName(startDate, endDate),
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
        // Keep overall for backward compatibility
        overall: {
            totalReports: reports.length,
            totalSaved: totalSaved,
            totalHealed: totalHealed
        }
    };

    // Generate AI narrative
    if (config.anthropicApiKey) {
        try {
            const narrative = await generateNarrative(reportData, command);
            reportData.fromTheField = narrative.fromTheField;
            reportData.encounters = narrative.encounters;
            reportData.whatWePreached = narrative.whatWePreached;
            reportData.honestReflection = narrative.honestReflection;
            reportData.closingWord = narrative.closingWord;
            reportData.closingScripture = narrative.closingScripture;
            // Legacy field aliases for backward compatibility
            reportData.narrative = narrative.fromTheField;
            reportData.messageEmphasis = narrative.whatWePreached;
            reportData.conclusion = narrative.closingWord;
        } catch (error) {
            logger.error(`Error generating AI narrative for ${assembly.name}:`, error);
            applyFallbackNarrative(reportData);
        }
    } else {
        logger.info('No Anthropic API key - using fallback narrative');
        applyFallbackNarrative(reportData);
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
 * - Collapse whitespace
 * - Remove leading slash or "and" fragments
 */
function normalizePersonName(name) {
    let n = name.trim();
    // Strip trailing punctuation
    n = n.replace(/[.,;:!]+$/, '').trim();
    // Collapse whitespace
    n = n.replace(/\s+/g, ' ');
    // Remove leading slash or "and" fragments
    n = n.replace(/^\/\s*/, '').trim();
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
 * Normalize a location string for comparison
 */
function locationKey(loc) {
    let key = loc.toLowerCase().trim();
    key = key.replace(/[.,;:!]+$/, '').trim();
    key = key.replace(/^\((.+)\)$/, '$1');
    key = key.replace(/\s*\/\s*/g, '/');
    key = key.replace(/\s+/g, ' ');
    return key;
}

/**
 * Deduplicate locations with normalization
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
 * Generate narrative report using Claude AI
 */
async function generateNarrative(reportData, command) {
    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    const prompt = buildNarrativePrompt(reportData, command);

    logger.info(`Generating SMC Cluster Report narrative for ${reportData.assemblyName}`);

    const completion = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: buildSystemPrompt(command),
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.7
    });

    const response = completion.content[0].text;
    return parseNarrativeResponse(response);
}

/**
 * Build system prompt — SMC Cluster Report voice (always first-person)
 * The command parameter is retained for signature compatibility but voice is fixed.
 */
function buildSystemPrompt(command) {
    return `You are the report-writing assistant for Spiritual Movement Crusaders. Your role is to write each cluster's monthly field report — written entirely in first person, as the cluster speaking about their own work.

CORE PRINCIPLE: The cluster is the author. They are reporting back to the wider movement, to partner churches, and to the historical record about what we did, what we encountered, what God did through us. These reports are written in the spirit of biblical narrative — honest, plain, and purposeful. Like the accounts in Acts, they record what happened: the fruit, the resistance, the healings, the refusals, the faithfulness, and the silence. They are not promotional material. They are a living record that partner churches in Europe, Africa, and beyond will read to be encouraged, to learn, and to see the pattern of God's faithfulness in this generation.

VOICE AND PERSPECTIVE:
- Use "we" when speaking collectively about the cluster's work
- Only use "I" when a specific evangelist is named by name in that encounter (e.g. "Tanaka Makuzo said, 'I approached her...'") — "I" is tied to a named individual's own reflection, never a stand-in for an unnamed or generic evangelist
- DEFAULT TO "we" IN "Encounters from the Month." Nearly all encounters are the cluster's collective work; if no individual evangelist is named in the encounter, write it entirely in "we" — never leave an unattributed "I" in the narrative
- Write as if giving an honest account to the wider body of Christ — warm, grounded, and real
- The evangelists themselves are witnesses to what God has done; the report is their testimony to the broader church
- Always use actual names of individuals from the field data where provided — never replace names with "Brother" or "Sister" followed by a surname as a substitute

THEOLOGY OF EVANGELISM — strictly reflected in all report language:
- Our role is to offer — to present the Gospel, to offer prayer, to give every person the opportunity to respond
- If someone refuses prayer or rejects the Gospel, that is their story with God, not our unfinished assignment
- NEVER write phrases like "we will continue to pray for them from a distance", "we pray for them beyond what our hands could reach", or "they are prayed for from a distance" — we do not know what God asks of us after a refusal, and we do not presume to
- Faithfulness is measured by opportunities created — as long as a cluster is showing up, going out, and presenting the Gospel, they are being faithful. Whether people accept Christ or accept prayer is entirely between them and God
- We show up. We present. We give people the chance. We respect their choice. We move on in faith

ON REPORTING NUMBERS HONESTLY — biblical plainness:
- If zero salvations, state it plainly: we recorded zero souls saved — no softening, no explanation, no reassurance. That is the account.
- If salvations occurred, state the number plainly — no commentary about not knowing how to explain it. That is the account.
- Report what happened. Readers will draw their own encouragement from an honest record. This is how Scripture records the work of God — plainly, faithfully, without spin.

TERMINOLOGY — STRICTLY OBSERVED:
- NEVER write "spirit" when referring to God's Spirit. ALWAYS write "Holy Spirit" (capital H, capital S)
- This applies everywhere — narrative sections, encounter stories, themes, reflection, closing word
- Other spiritual references (evil spirits, ancestral spirits, false spirits) retain their own descriptors and are written as "spirits" when not referring to the Holy Spirit

NUMBER FORMATTING — STRICTLY OBSERVED throughout every report:
- Always write numbers as numerals, never in words (e.g. "16 evangelists" not "sixteen evangelists", "3 souls" not "three souls")
- When statistical numbers appear in the body text, make them bold using **number** markdown (e.g. "**103** people received Jesus", "we prayed for **89** who were sick")
- This applies everywhere in the report body — narrative, encounters, reflection, closing word — not only in the stats table

CORE VALUES:
- Truth and accuracy above all — never embellish numbers or outcomes
- Faith-driven, scripturally grounded language — not religious jargon, but living, breathing faith
- Encouragement for faithfulness, not celebration of volume
- Written as a historical witness for the wider body of Christ — partner churches, sister clusters, and future readers will encounter God through these accounts
- Holiness, genuine Christianity, and obedience to the Holy Spirit are recurring values of this movement

CLOSING WORD — STRICTLY OBSERVED:
- Write as a historical witness only — plain and factual
- Do NOT address the evangelists by name
- Do NOT say "well done" or "thank you" to them
- Do NOT add emotional commentary or reassurance
- Close the account simply and plainly — so those who read it now or in years to come receive an honest record of what this movement did and what God did through it`;
}

/**
 * Build narrative prompt — SMC Cluster Report structure (6 content sections)
 */
function buildNarrativePrompt(reportData, command) {
    let prompt = `Write the monthly field report for ${reportData.assemblyName} — ${reportData.period}.\n\n`;

    prompt += `FIELD DATA:\n`;
    prompt += `- Cluster: ${reportData.assemblyName}\n`;
    prompt += `- Period: ${reportData.period}\n`;
    prompt += `- Total Outreach Events (Opportunities): ${reportData.totalOutreaches}\n`;
    prompt += `- Souls Saved: ${reportData.totalSaved}\n`;
    prompt += `- Sick Prayed For: ${reportData.totalHealed}\n`;
    prompt += `- Evangelists: ${reportData.labourers ? reportData.labourers.length : 0}\n`;
    prompt += `- Locations Reached: ${reportData.locations ? reportData.locations.length : 0}\n\n`;

    if (reportData.locations && reportData.locations.length > 0) {
        prompt += `LOCATIONS PREACHED AT:\n`;
        prompt += reportData.locations.map(l => `- ${l}`).join('\n');
        prompt += '\n\n';
    }

    if (reportData.activityTypes && reportData.activityTypes.length > 0) {
        prompt += `ACTIVITY TYPES:\n`;
        prompt += reportData.activityTypes.map(t => `- ${t}`).join('\n');
        prompt += '\n\n';
    }

    if (reportData.labourers && reportData.labourers.length > 0) {
        prompt += `LABOURERS / EVANGELISTS:\n`;
        prompt += reportData.labourers.map(l => `- ${l}`).join('\n');
        prompt += '\n\n';
    }

    if (reportData.messageSummaries && reportData.messageSummaries.length > 0) {
        prompt += `MESSAGE SUMMARIES FROM FIELD REPORTS:\n`;
        reportData.messageSummaries.forEach((summary, i) => {
            prompt += `${i + 1}. ${summary}\n`;
        });
        prompt += '\n';
    }

    prompt += `REQUIRED SECTIONS — produce exactly these 6 sections in order, using these exact headers:\n\n`;

    prompt += `FROM THE FIELD:\n`;
    prompt += `Write 3–4 paragraphs in first person giving the month its character. Reference specific locations. Use actual names from the data where provided. Include the texture of the work: atmosphere, crowd response, encounters. Bold all statistical numbers in the body text using **number** format.\n\n`;

    prompt += `ENCOUNTERS FROM THE MONTH:\n`;
    prompt += `Write 2–4 specific encounter stories in first person. Default to "we" for all encounters — "We met...", "We prayed with...", "We saw...". Only switch to "I" when the encounter names the specific individual evangelist involved (e.g. "Tanaka Makuzo said, 'I approached her...'"). Never leave an unattributed "I" in the narrative. Draw from message summaries for detail. Honour the people encountered. Bold all statistical numbers.\n\n`;

    prompt += `WHAT WE PREACHED:\n`;
    prompt += `List 4–6 gospel themes actually carried that month (from the message summaries). For each theme write a short paragraph (2–3 sentences). Format: **Theme Name** on its own line, then the paragraph below it.\n\n`;

    prompt += `HONEST REFLECTION:\n`;
    prompt += `1–3 paragraphs. Plain and honest: What pushed back this month? What faced resistance? What could grow? What is unresolved? When noting refusals, record what happened — do not presume what follows after someone says no. Never soften difficulty. Never be discouraging. Simply honest.\n\n`;

    prompt += `CLOSING WORD:\n`;
    prompt += `1–2 paragraphs as a historical witness. Reflect on what the month reveals about the work, the field, and God's movement. Do NOT address evangelists by name. Do NOT say "well done" or "thank you". Do NOT add emotional commentary or reassurance. Close the account simply and plainly.\n\n`;

    prompt += `CLOSING SCRIPTURE:\n`;
    prompt += `One verse that resonates with the specific character of this month. Format exactly: Book Chapter:Verse — "verse text here"\n\n`;

    prompt += `FORMAT YOUR RESPONSE EXACTLY LIKE THIS (these exact headers, nothing else):\n`;
    prompt += `FROM THE FIELD:\n[3-4 paragraphs]\n\n`;
    prompt += `ENCOUNTERS FROM THE MONTH:\n[encounter stories]\n\n`;
    prompt += `WHAT WE PREACHED:\n[themes]\n\n`;
    prompt += `HONEST REFLECTION:\n[honest reflection]\n\n`;
    prompt += `CLOSING WORD:\n[1-2 paragraphs]\n\n`;
    prompt += `CLOSING SCRIPTURE:\n[reference — "verse text"]`;

    return prompt;
}

/**
 * Parse AI response into the 6 SMC Cluster Report sections
 */
function parseNarrativeResponse(response) {
    const sections = {
        fromTheField: '',
        encounters: '',
        whatWePreached: '',
        honestReflection: '',
        closingWord: '',
        closingScripture: ''
    };

    const sectionMap = [
        { pattern: /^FROM THE FIELD[:\s]*$/im,            key: 'fromTheField' },
        { pattern: /^ENCOUNTERS FROM THE MONTH[:\s]*$/im, key: 'encounters' },
        { pattern: /^WHAT WE PREACHED[:\s]*$/im,          key: 'whatWePreached' },
        { pattern: /^HONEST REFLECTION[:\s]*$/im,         key: 'honestReflection' },
        { pattern: /^CLOSING WORD[:\s]*$/im,              key: 'closingWord' },
        { pattern: /^CLOSING SCRIPTURE[:\s]*$/im,         key: 'closingScripture' }
    ];

    // Locate each section header in the response
    const positions = [];
    for (const { pattern, key } of sectionMap) {
        const match = pattern.exec(response);
        if (match) {
            positions.push({
                key,
                headerStart: match.index,
                contentStart: match.index + match[0].length
            });
        }
    }
    positions.sort((a, b) => a.headerStart - b.headerStart);

    // Extract content between each header and the next
    for (let i = 0; i < positions.length; i++) {
        const start = positions[i].contentStart;
        const end = i + 1 < positions.length
            ? positions[i + 1].headerStart
            : response.length;
        sections[positions[i].key] = response.slice(start, end).trim();
    }

    return sections;
}

/**
 * Apply fallback narrative content when AI is unavailable — all 6 SMC sections
 */
function applyFallbackNarrative(reportData) {
    const name = reportData.assemblyName;
    const period = reportData.period;
    const locs = reportData.locations && reportData.locations.length > 0
        ? reportData.locations.join(', ')
        : 'various locations';
    const saved = reportData.totalSaved || 0;
    const healed = reportData.totalHealed || 0;
    const evangelists = reportData.labourers ? reportData.labourers.length : 0;

    reportData.fromTheField =
        `In ${period}, we carried the Gospel through ${name}. ` +
        `We went out into ${locs}, taking the Word beyond church walls and into the daily flow of life. ` +
        `The work this month was not built on a single event — it was built on repeated, deliberate obedience.\n\n` +
        `The message we preached called people plainly to repentance and genuine freedom through Jesus Christ. ` +
        `We testified of our own deliverances — from addiction, from fear, from bitterness, from ancestral bondage. ` +
        `These testimonies were not performance; they were evidence.\n\n` +
        `Resistance arose in several places. Noise, disruption, and public indifference met us at times. ` +
        `But the Word did not stop. We continued with boldness. We prayed for **${healed}** who were sick. ` +
        `Hearts opened, and the message found space.\n\n` +
        `We recorded **${saved}** souls saved in ${period}. The seed has been sown. ` +
        `**${evangelists}** evangelists went out. We were faithful to show up.`;

    reportData.encounters =
        `We encountered people across various settings this month — markets, transport routes, streets, and open spaces. ` +
        `In one place, a group stopped to listen. The preaching was direct. Some walked away; others stayed. ` +
        `We offered prayer to those who remained.\n\n` +
        `In another place, we met a man who had not heard the Gospel in years. He listened through the full message. ` +
        `He did not refuse prayer. We gave him the opportunity and moved on. What he does with it is between him and God.`;

    reportData.whatWePreached =
        `**Repentance and Remission of Sins**\n` +
        `We called people plainly to turn — not to religion, but to a genuine break with the patterns of the old life. This message was specific, not general.\n\n` +
        `**Freedom Through Christ**\n` +
        `We testified that Jesus delivers from immorality, addiction, ancestral bondage, and spiritual oppression. The testimonies of those who preached gave weight to the message.\n\n` +
        `**The Holy Spirit as Evidence**\n` +
        `We declared that a transformed life is the proof of salvation. The presence and work of the Holy Spirit was central to what we preached.\n\n` +
        `**Judgement and Eternity**\n` +
        `We did not avoid the sobering reality of accountability before God. This was delivered plainly, without manipulation.\n\n` +
        `**The Call to Walk Differently**\n` +
        `We called people not only to a moment of decision, but to a life of genuine holiness and continued obedience to the Holy Spirit.`;

    reportData.honestReflection =
        `Some locations presented consistent resistance this month. Noise and disruption were used to drown out the message ` +
        `in at least one area. We note this plainly — not every location receives the Word with openness.\n\n` +
        `We also note that in certain areas, the number of evangelists was thin relative to the size of the field. ` +
        `This is not a complaint — it is an honest account of the work as it stands.`;

    reportData.closingWord =
        `${period} in ${name} was a month of faithful presence. ` +
        `The Gospel moved through streets, transport routes, and open spaces — not as a single event, but as repeated obedience.\n\n` +
        `The record stands: the cluster showed up. They presented the Gospel. ` +
        `They gave people the chance to respond. The fruit recorded — and the fruit not yet visible — ` +
        `belongs to the faithfulness of this work, and to the God who causes the growth.`;

    reportData.closingScripture =
        `Mark 16:15 — "Go into all the world and preach the gospel to every creature."`;

    // Legacy aliases
    reportData.narrative = reportData.fromTheField;
    reportData.messageEmphasis = reportData.whatWePreached;
    reportData.conclusion = reportData.closingWord;
}

// Keep backward compatibility - export old function name pointing to new logic
export { generateAssemblyReports as generateMonthlyReport };

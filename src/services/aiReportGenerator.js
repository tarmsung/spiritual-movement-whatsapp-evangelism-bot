import OpenAI from 'openai';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import {
    getMonthlyStats,
    getMonthlyStatsByAssembly,
    getActivityTypeBreakdown,
    getReportsByDateRange
} from '../database/db.js';
import { formatNumber, calculateConversionRate, getMonthName } from '../utils/helpers.js';
import { detectCommand, DEFAULT_COMMAND } from '../config/smc_reporting_commands.js';
import { generateLocationPlot } from './coordinateMapGenerator.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPORTS_DIR = join(__dirname, '../../reports');

/**
 * Generate AI-powered evangelism report with SMC framework
 * @param {string} startDate - Report start date (YYYY-MM-DD)
 * @param {string} endDate - Report end date (YYYY-MM-DD)
 * @param {Object} options - Report options
 * @param {string} [options.periodTitle] - Optional override for period title
 * @param {string} [options.clusterName] - Optional cluster/region name
 * @param {string} [options.command] - SMC command to use (defaults to [Executor Report])
 * @returns {Promise<Object>} Report data with SMC-formatted content
 */
export async function generateMonthlyReport(startDate, endDate, options = {}) {
    logger.info(`Generating SMC report for ${startDate} to ${endDate}`);

    // Detect SMC command
    const command = detectCommand(options.command || DEFAULT_COMMAND.name);
    logger.info(`Using SMC command: ${command.name}`);

    // Gather statistics
    const overallStats = await getMonthlyStats(startDate, endDate);
    const assemblyStats = await getMonthlyStatsByAssembly(startDate, endDate);
    const activityBreakdown = await getActivityTypeBreakdown(startDate, endDate);

    // Extract locations and labourers
    const locations = await extractLocationsFromReports(startDate, endDate);
    const labourers = await extractLabourersFromReports(startDate, endDate);

    logger.info(`Found ${locations.length} unique locations and ${labourers.length} labourers`);

    // Prepare base report data
    const reportData = {
        period: options.periodTitle || getMonthName(startDate),
        clusterName: options.clusterName || null,
        startDate,
        endDate,
        command: command.name,
        overall: {
            totalReports: overallStats.total_reports || 0,
            totalReached: overallStats.total_sick_prayed_for || 0,
            totalConversions: overallStats.total_converts || 0
        },
        assemblies: assemblyStats.map(a => ({
            name: a.assembly_name,
            reports: a.total_reports || 0,
            reached: a.total_sick_prayed_for || 0,
            conversions: a.total_converts || 0
        })),
        activityTypes: activityBreakdown.map(a => ({
            type: a.activity_type,
            count: a.count,
            reached: a.total_sick_prayed_for || 0,
            conversions: a.total_converts || 0
        })),
        locations,
        labourers
    };

    // Generate narrative using AI (executor voice)
    if (config.openaiApiKey) {
        try {
            const narrative = await generateNarrative(reportData, command);
            reportData.narrative = narrative.narrative;
            reportData.messageEmphasis = narrative.messageEmphasis;
            reportData.conclusion = narrative.conclusion;
        } catch (error) {
            logger.error('Error generating AI narrative:', error);
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

    // Generate map if multiple locations (for PDF embedding)
    if (locations.length > 1) {
        try {
            const mapPath = join(REPORTS_DIR, `map_${startDate}.png`);
            const title = `${reportData.clusterName || config.churchName} - ${reportData.period} Evangelism Locations`;
            await generateLocationPlot(locations, title, mapPath);
            reportData.mapImagePath = mapPath;
            logger.info(`Location map generated: ${mapPath}`);
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
 * Extract unique locations from reports
 */
async function extractLocationsFromReports(startDate, endDate) {
    const reports = await getReportsByDateRange(startDate, endDate);
    const uniqueLocations = [...new Set(reports.map(r => r.location).filter(Boolean))];
    return uniqueLocations.sort();
}

/**
 * Extract unique labourers from reports
 */
async function extractLabourersFromReports(startDate, endDate) {
    const reports = await getReportsByDateRange(startDate, endDate);
    const labourers = new Set();

    reports.forEach(r => {
        // Extract names from preachers_team (may be comma-separated)
        if (r.preachers_team) {
            const names = r.preachers_team.split(',').map(n => n.trim());
            names.forEach(name => labourers.add(name));
        }

        // Add reporter name if not already in preachers team
        if (r.reporter_name && !r.preachers_team?.includes(r.reporter_name)) {
            labourers.add(r.reporter_name);
        }
    });

    return Array.from(labourers).sort();
}

/**
 * Generate narrative report using OpenAI with SMC authority voice
 */
async function generateNarrative(reportData, command) {
    const openai = new OpenAI({ apiKey: config.openaiApiKey });
    const prompt = buildNarrativePrompt(reportData, command);

    logger.info(`Generating narrative with ${command.voice} voice`);

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
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
        max_tokens: 2500
    });

    const response = completion.choices[0].message.content;
    return parseNarrativeResponse(response);
}

/**
 * Build system prompt based on SMC command
 */
function buildSystemPrompt(command) {
    let systemPrompt = 'You are writing a monthly evangelism ministry report. ';

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

    systemPrompt += '\\n\\nTone: perseverance, courage, faithful proclamation, spiritual resistance overcome through prayer and boldness.';
    systemPrompt += '\\nStyle: formal but passionate, factual but faith-filled, sober but hopeful.';

    return systemPrompt;
}

/**
 * Build narrative prompt with statistics and context
 */
function buildNarrativePrompt(reportData, command) {
    let prompt = `Write a monthly evangelism report following this structure:\\n\\n`;

    prompt += `CONTEXT:\\n`;
    prompt += `- Period: ${reportData.period}\\n`;
    prompt += `- Cluster/Region: ${reportData.clusterName || config.churchName}\\n`;
    prompt += `- Reporting Command: ${command.name}\\n\\n`;

    prompt += `STATISTICS:\\n`;
    prompt += `- Total Evangelism Reports: ${reportData.overall.totalReports}\\n`;
    prompt += `- People Converted: ${reportData.overall.totalConversions}\\n`;
    prompt += `- Sick Prayed For: ${reportData.overall.totalReached}\\n\\n`;

    prompt += `LOCATIONS ENTERED: ${reportData.locations.join(', ')}\\n\\n`;

    prompt += `LABOURERS IN THE FIELD: ${reportData.labourers.join(', ')}\\n\\n`;

    if (reportData.activityTypes.length > 0) {
        prompt += `ACTIVITY TYPES:\\n`;
        reportData.activityTypes.forEach(a => {
            prompt += `- ${a.type}: ${a.count} times\\n`;
        });
        prompt += `\\n`;
    }

    prompt += `INSTRUCTIONS:\\n\\n`;
    prompt += `Write a NARRATIVE REPORT section (3-4 paragraphs):\\n`;
    prompt += `1. Opening: Describe how the Gospel was carried throughout the month\\n`;
    prompt += `   - Mention the variety of locations (commuter buses, marketplaces, streets, homes, schools, open spaces)\\n`;
    prompt += `   - Emphasize the message was not confined to church buildings but taken into daily life\\n\\n`;

    prompt += `2. Middle Paragraphs: Cover these themes\\n`;
    prompt += `   - The clarity and conviction of the preaching (call to repentance, freedom from sin)\\n`;
    prompt += `   - Evangelists testified of their own deliverance from specific sins/bondages\\n`;
    prompt += `   - Resistance encountered (interruptions, loud music, public objections, confrontation)\\n`;
    prompt += `   - The Word did not cease - it continued with persistence and boldness\\n`;
    prompt += `   - Some who initially mocked later listened in silence or continued conversations after the preaching\\n`;
    prompt += `   - Prayer for the sick (in transport, homes, streets) - hearts opened, space for salvation message\\n\\n`;

    prompt += `3. Closing: Summarize the month's work\\n`;
    prompt += `   - Steady obedience rather than isolated enthusiasm\\n`;
    prompt += `   - Gospel heard repeatedly across key areas\\n`;
    prompt += `   - Seed sown consistently\\n\\n`;

    prompt += `Then provide:\\n`;
    prompt += `MESSAGE EMPHASIS (5 bullet points):\\n`;
    prompt += `- List the theological themes emphasized in the preaching\\n`;
    prompt += `- Examples: Repentance and remission of sins, Holiness as evidence of salvation, Christ as only source of freedom, etc.\\n\\n`;

    prompt += `CONCLUSION (2-3 sentences):\\n`;
    prompt += `- Summarize the month with themes of perseverance, courage, faithful proclamation\\n`;
    prompt += `- Mention resistance in certain places, but the Word continued to be spoken\\n`;
    prompt += `- Note that Gospel moved through streets, transport, homes, marketplaces, into individual hearts\\n`;
    prompt += `- Emphasize sustained obedience and foundation laid for future growth\\n\\n`;

    prompt += `Format your response EXACTLY like this:\\n`;
    prompt += `NARRATIVE:\\n[3-4 paragraphs here]\\n\\n`;
    prompt += `MESSAGE EMPHASIS:\\n- [bullet 1]\\n- [bullet 2]\\n- [bullet 3]\\n- [bullet 4]\\n- [bullet 5]\\n\\n`;
    prompt += `CONCLUSION:\\n[2-3 sentences here]`;

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
    const emphasisMatch = response.match(/MESSAGE EMPHASIS[:\\s]+([\\s\\S]*?)(?=\\n\\nCONCLUSION|$)/i);
    if (emphasisMatch) {
        sections.messageEmphasis = emphasisMatch[1]
            .split('\\n')
            .filter(line => line.trim().match(/^[-•*]/))
            .map(line => line.replace(/^[-•*]\\s*/, '').trim())
            .filter(Boolean);
    }

    // Extract CONCLUSION section
    const conclusionMatch = response.match(/CONCLUSION[:\\s]+([\\s\\S]+?)$/i);
    if (conclusionMatch) {
        sections.conclusion = conclusionMatch[1].trim();
    }

    // Extract NARRATIVE (everything before MESSAGE EMPHASIS)
    const narrativeMatch = response.match(/NARRATIVE[:\\s]+([\\s\\S]*?)(?=\\n\\nMESSAGE EMPHASIS|$)/i);
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
    let narrative = `In ${reportData.period}, the Gospel was carried faithfully throughout ${reportData.clusterName || 'the region'}. `;
    narrative += `Day after day, the Word of God was proclaimed in commuter omnibuses, marketplaces, residential streets, workplaces, schools, and open spaces. `;
    narrative += `The message was not confined to church buildings but was taken into the ordinary flow of daily life.\\n\\n`;

    narrative += `The preaching throughout the month was marked by clarity and conviction. The call was not merely to religious affiliation, `;
    narrative += `but to repentance and true freedom from sin through Jesus Christ. Evangelists testified openly of their own deliverance from `;
    narrative += `immorality, ancestral practices, gossip, bitterness, drug abuse, and other forms of bondage. These testimonies became living proof `;
    narrative += `that the power of Christ is still able to transform lives.\\n\\n`;

    narrative += `In several places, resistance arose. There were interruptions, loud music intended to drown out the message, public objections, `;
    narrative += `and moments of confrontation. Yet the preaching did not cease. The Word continued to be declared with persistence and boldness. `;
    narrative += `In some instances, those who initially mocked later listened in silence. In others, conversations continued long after the `;
    narrative += `open-air preaching had ended.\\n\\n`;

    narrative += `Prayer for the sick accompanied the preaching of the Gospel. Individuals in pain and distress were prayed for in transport, `;
    narrative += `in homes, and along the streets. These moments of prayer opened hearts and created space for the message of salvation to be received. `;
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
    return `${reportData.period} in ${reportData.clusterName || 'the region'} was marked by perseverance, courage, and faithful proclamation. ` +
        `Though resistance arose in certain places, the Word continued to be spoken. The Gospel moved through streets and transport routes, ` +
        `through homes and marketplaces, and into individual hearts. The work was carried out not as a single event, but as sustained obedience. ` +
        `The fruit recorded reflects continued labour in the field and a foundation laid for future growth.`;
}

import Anthropic from '@anthropic-ai/sdk';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { getReportsForAssembly } from '../database/db.js';

// ─── Build the extraction prompt ────────────────────────────────────────────

function buildYouthConventionPrompt(assemblyName, period, reports) {
    const reportText = reports.map((r, i) => {
        const lines = [
            `--- Report ${i + 1} ---`,
            `Cluster: ${assemblyName}`,
            `Period: ${period}`,
            r.activity_date  ? `Date: ${r.activity_date}`          : null,
            r.location       ? `Location: ${r.location}`            : null,
            r.activity_type  ? `Activity Type: ${r.activity_type}`  : null,
            r.preachers_team ? `Evangelists: ${r.preachers_team}`   : null,
            r.saved   != null ? `Souls Saved: ${r.saved}`           : null,
            r.healed  != null ? `Sick Prayed For: ${r.healed}`      : null,
            r.message_summary ? `Field Report:\n${r.message_summary}` : null,
        ].filter(Boolean);
        return lines.join('\n');
    }).join('\n\n');

    return `SMC — FIELD EXAMPLE EXTRACTION

For: Youth Convention presentation — "Evangelism: Facing Rejection, Failure, Anxiety and Delay with God"

---

YOUR TASK

Read through the Spiritual Movement Crusaders monthly cluster field reports below. Extract real examples — not generalizations — that speak to four themes an evangelist faces in the field:

1. REJECTION — a person or group refusing prayer, refusing the Gospel, walking away, or responding with hostility. Look especially in "Encounters from the Month" and "Honest Reflection."
2. FAILURE — a plan that didn't work, a location with zero recorded salvations, doors that stayed closed, an outreach that produced no visible fruit. Look in "Honest Reflection" and the stats (Souls Saved / Opportunities gap).
3. ANXIETY — an evangelist's fear, nervousness, hesitation, or spiritual tension before or during an encounter — anything describing the internal, human cost of showing up.
4. DELAY — waiting for breakthrough, long engagement with a person or place without an answer yet, patience required, a story left open without resolution.

For each theme, find 2–4 concrete examples across the available reports.

---

FOR EACH EXAMPLE, GIVE ME:
- Cluster name, month, and year
- The evangelist's name if the report names them, otherwise note it's a "we" (collective) account
- What happened — a tight, honest summary in your own words (2–3 sentences)
- A short verbatim pull-quote from the report, in quotation marks, suitable to put on a slide
- One line connecting it to SMC's theology: we offer, we do not control the outcome; a refusal or a silence is "their story with God," not our unfinished assignment

---

IMPORTANT — PRESERVE THE HONESTY
- Do not soften, resolve, or add encouragement that isn't in the source report. If a report records a refusal or a zero, leave it as a refusal or a zero.
- Do not invent outcomes ("and later they returned") that the report doesn't state.
- If a report leaves an encounter unresolved, preserve that — it IS the point for the Delay section.
- If a theme is thin (fewer than 2 solid examples), tell me directly.

---

OUTPUT FORMAT

Organize your answer under four headings: REJECTION, FAILURE, ANXIETY, DELAY.
End with a short CROSS-CLUSTER OBSERVATION paragraph.

---

CONTEXT FOR ACCURACY
These reports follow SMC's honest, plain, biblical-narrative reporting standard — no embellishment, no promotional spin. Treat them as primary source testimony, not marketing copy.

---

FIELD REPORTS:

${reportText}

---

Please extract the examples now, following the OUTPUT FORMAT above exactly.`;
}

// ─── Claude API call ─────────────────────────────────────────────────────────

async function callClaudeForYouthExtraction(assemblyName, period, reports) {
    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    const prompt = buildYouthConventionPrompt(assemblyName, period, reports);

    logger.info(`[SMYouth] Sending ${reports.length} reports for "${assemblyName}" to Claude`);

    const completion = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: `You are a research assistant for Spiritual Movement Crusaders. Your job is to read raw field reports and extract concrete examples illustrating four themes for a Youth Convention presentation. Be precise, faithful to the source material, and do not invent or embellish. Where a report is honest about failure or silence, preserve that honesty exactly.`,
        messages: [{ role: 'user', content: prompt }],
    });

    return completion.content[0].text;
}

// ─── Section parser ──────────────────────────────────────────────────────────

function parseExtractionResponse(text) {
    const result = {
        rejection:    '',
        failure:      '',
        anxiety:      '',
        delay:        '',
        crossCluster: '',
    };

    const sectionMap = [
        { pattern: /^REJECTION[\s:]*$/im,                    key: 'rejection' },
        { pattern: /^FAILURE[\s:]*$/im,                      key: 'failure' },
        { pattern: /^ANXIETY[\s:]*$/im,                      key: 'anxiety' },
        { pattern: /^DELAY[\s:]*$/im,                        key: 'delay' },
        { pattern: /^CROSS[- ]CLUSTER OBSERVATION[\s:]*$/im, key: 'crossCluster' },
    ];

    const positions = [];
    for (const { pattern, key } of sectionMap) {
        const match = pattern.exec(text);
        if (match) {
            positions.push({
                key,
                headerStart:  match.index,
                contentStart: match.index + match[0].length,
            });
        }
    }
    positions.sort((a, b) => a.headerStart - b.headerStart);

    for (let i = 0; i < positions.length; i++) {
        const start = positions[i].contentStart;
        const end   = i + 1 < positions.length ? positions[i + 1].headerStart : text.length;
        result[positions[i].key] = text.slice(start, end).trim();
    }

    // Fallback: if nothing parsed, store raw text so content isn't lost
    if (!result.rejection && !result.failure && !result.anxiety && !result.delay) {
        result.rejection = text.trim();
    }

    return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate the SM Youth Convention extraction for one cluster and month.
 *
 * @param {Object} assembly  - { id, name }
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @param {string} period    - Human-readable label e.g. "July 2026"
 * @returns {Promise<Object>}
 */
export async function generateSmYouthReport(assembly, startDate, endDate, period) {
    logger.info(`[SMYouth] Fetching reports for "${assembly.name}" — ${period}`);

    const reports = await getReportsForAssembly(assembly.id, startDate, endDate);

    if (reports.length === 0) {
        return {
            assemblyName: assembly.name,
            period,
            startDate,
            endDate,
            totalReports: 0,
            rejection: '', failure: '', anxiety: '', delay: '', crossCluster: '',
            empty: true,
        };
    }

    let rawResponse;
    if (config.anthropicApiKey) {
        rawResponse = await callClaudeForYouthExtraction(assembly.name, period, reports);
    } else {
        logger.warn('[SMYouth] No Anthropic API key — returning placeholder extraction');
        rawResponse = [
            'REJECTION',
            'No Anthropic API key configured. Please add ANTHROPIC_API_KEY to your .env file.',
            'FAILURE',
            '(Anthropic API key required)',
            'ANXIETY',
            '(Anthropic API key required)',
            'DELAY',
            '(Anthropic API key required)',
            'CROSS-CLUSTER OBSERVATION',
            '(Anthropic API key required)',
        ].join('\n\n');
    }

    const sections = parseExtractionResponse(rawResponse);

    return {
        assemblyName: assembly.name,
        period,
        startDate,
        endDate,
        totalReports: reports.length,
        ...sections,
        empty: false,
    };
}

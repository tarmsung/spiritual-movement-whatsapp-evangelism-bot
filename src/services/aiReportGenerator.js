import OpenAI from 'openai';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import {
    getMonthlyStats,
    getMonthlyStatsByAssembly,
    getActivityTypeBreakdown
} from '../database/db.js';
import { formatNumber, calculateConversionRate, getMonthName } from '../utils/helpers.js';

/**
 * Generate AI-powered monthly evangelism report
 * @param {string} startDate - Report start date (YYYY-MM-DD)
 * @param {string} endDate - Report end date (YYYY-MM-DD)
 * @returns {Promise<Object>} Report data with AI analysis
 */
export async function generateMonthlyReport(startDate, endDate) {
    logger.info(`Generating monthly report for ${startDate} to ${endDate}`);

    // Gather statistics
    const overallStats = await getMonthlyStats(startDate, endDate);
    const assemblyStats = await getMonthlyStatsByAssembly(startDate, endDate);
    const activityBreakdown = await getActivityTypeBreakdown(startDate, endDate);

    // Calculate metrics
    const conversionRate = calculateConversionRate(
        overallStats.total_conversions || 0,
        overallStats.total_reached || 0
    );

    // Prepare report data
    const reportData = {
        period: getMonthName(startDate),
        startDate,
        endDate,
        overall: {
            totalReports: overallStats.total_reports || 0,
            totalReached: overallStats.total_reached || 0,
            totalConversions: overallStats.total_conversions || 0,
            conversionRate
        },
        assemblies: assemblyStats.map(a => ({
            name: a.assembly_name,
            reports: a.total_reports || 0,
            reached: a.total_reached || 0,
            conversions: a.total_conversions || 0,
            conversionRate: calculateConversionRate(a.total_conversions || 0, a.total_reached || 0)
        })),
        activityTypes: activityBreakdown.map(a => ({
            type: a.activity_type,
            count: a.count,
            reached: a.total_reached,
            conversions: a.total_conversions
        }))
    };

    // Generate AI analysis if API key is available
    if (config.openaiApiKey) {
        try {
            const aiAnalysis = await generateAIAnalysis(reportData);
            reportData.aiAnalysis = aiAnalysis;
        } catch (error) {
            logger.error('Error generating AI analysis:', error);
            reportData.aiAnalysis = generateBasicSummary(reportData);
        }
    } else {
        logger.info('No OpenAI API key - using basic summary');
        reportData.aiAnalysis = generateBasicSummary(reportData);
    }

    return reportData;
}

/**
 * Generate AI analysis using OpenAI
 */
async function generateAIAnalysis(reportData) {
    const openai = new OpenAI({
        apiKey: config.openaiApiKey
    });

    // Build prompt
    const prompt = buildAnalysisPrompt(reportData);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'You are an experienced church leader analyzing evangelism outreach data. Provide encouraging, actionable insights based on the statistics provided.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.7,
        max_tokens: 1000
    });

    return completion.choices[0].message.content;
}

/**
 * Build analysis prompt for OpenAI
 */
function buildAnalysisPrompt(reportData) {
    let prompt = `Analyze this month's evangelism report for ${config.churchName}:\n\n`;
    prompt += `PERIOD: ${reportData.period}\n\n`;
    prompt += `OVERALL STATISTICS:\n`;
    prompt += `- Total Reports: ${reportData.overall.totalReports}\n`;
    prompt += `- People Reached: ${formatNumber(reportData.overall.totalReached)}\n`;
    prompt += `- Conversions: ${formatNumber(reportData.overall.totalConversions)}\n`;
    prompt += `- Conversion Rate: ${reportData.overall.conversionRate}\n\n`;

    prompt += `CLUSTER PERFORMANCE:\n`;
    reportData.assemblies.forEach(a => {
        prompt += `- ${a.name}: ${a.reports} reports, ${formatNumber(a.reached)} reached, ${formatNumber(a.conversions)} conversions (${a.conversionRate})\n`;
    });

    prompt += `\nACTIVITY TYPES:\n`;
    reportData.activityTypes.forEach(a => {
        prompt += `- ${a.type}: ${a.count} activities, ${formatNumber(a.reached)} reached, ${formatNumber(a.conversions)} conversions\n`;
    });

    prompt += `\n\nProvide:\n`;
    prompt += `1. Executive Summary (2-3 sentences)\n`;
    prompt += `2. Key Highlights (3-4 bullet points)\n`;
    prompt += `3. Areas for Growth (2-3 bullet points)\n`;
    prompt += `4. Recommendations (2-3 actionable suggestions)\n`;
    prompt += `\nKeep the tone encouraging and pastoral.`;

    return prompt;
}

/**
 * Generate basic summary without AI
 */
function generateBasicSummary(reportData) {
    let summary = `EXECUTIVE SUMMARY\n\n`;
    summary += `During ${reportData.period}, our church submitted ${reportData.overall.totalReports} evangelism reports, `;
    summary += `reaching ${formatNumber(reportData.overall.totalReached)} people with the Gospel. `;
    summary += `We saw ${formatNumber(reportData.overall.totalConversions)} conversions, `;
    summary += `representing a ${reportData.overall.conversionRate} conversion rate.\n\n`;

    summary += `KEY HIGHLIGHTS\n\n`;

    // Top performing cluster
    if (reportData.assemblies.length > 0) {
        const topAssembly = reportData.assemblies.reduce((max, a) =>
            a.conversions > max.conversions ? a : max
        );
        summary += `- ${topAssembly.name} led with ${formatNumber(topAssembly.conversions)} conversions\n`;
    }

    // Most common activity
    if (reportData.activityTypes.length > 0) {
        const topActivity = reportData.activityTypes[0];
        summary += `- Most common activity: ${topActivity.type} (${topActivity.count} times)\n`;
    }

    summary += `- Total people reached: ${formatNumber(reportData.overall.totalReached)}\n`;
    summary += `- Total conversions: ${formatNumber(reportData.overall.totalConversions)}\n\n`;

    summary += `RECOMMENDATIONS\n\n`;
    summary += `- Continue evangelism efforts and maintain momentum\n`;
    summary += `- Share testimonies and success stories with the congregation\n`;
    summary += `- Provide follow-up support for new converts\n`;
    summary += `- Organize training sessions for more effective outreach\n`;

    return summary;
}

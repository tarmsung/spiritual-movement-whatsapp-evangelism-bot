import dotenv from 'dotenv';

dotenv.config();

const config = {
    // Church information
    churchName: process.env.CHURCH_NAME || 'Our Church',

    // Bot configuration
    wakePhrase: process.env.WAKE_PHRASE || '!evangelism',
    nodeEnv: process.env.NODE_ENV || 'development',

    // Admin configuration
    adminNumbers: process.env.ADMIN_NUMBERS
        ? process.env.ADMIN_NUMBERS.split(',').map(n => n.trim())
        : [],

    // OpenAI configuration
    openaiApiKey: process.env.OPENAI_API_KEY || null,

    // Report schedule (cron format)
    reportSchedule: process.env.REPORT_SCHEDULE || '0 9 1 * *',

    // Database (Supabase)
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',

    // Activity types
    activityTypes: [
        'Street Evangelism',
        'Door-to-Door',
        'Church Event',
        'Community Outreach',
        'School Visit',
        'Hospital Visit',
        'Prison Ministry',
        'Taxi Evangelism',
        'Other'
    ]
};

export default config;

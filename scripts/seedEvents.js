/**
 * Seed Events Script
 * Run once to populate the events table with all 2026 church events
 * Usage: node scripts/seedEvents.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const events = [
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-01-24' },
    { name: 'Youth Monthly', day_of_week: 'Saturday', event_date: '2026-01-31' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-02-28' },
    { name: 'Youth Monthly', day_of_week: 'Saturday', event_date: '2026-03-07' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-03-28' },
    { name: 'Easter Convention', day_of_week: 'Friday', event_date: '2026-04-03' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-04-25' },
    { name: 'Youth Monthly', day_of_week: 'Saturday', event_date: '2026-05-02' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-05-30' },
    { name: 'Youth Monthly', day_of_week: 'Saturday', event_date: '2026-06-06' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-06-27' },
    { name: 'Quarterly Convention', day_of_week: 'Friday', event_date: '2026-07-03' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-07-25' },
    { name: 'Youth Monthly', day_of_week: 'Saturday', event_date: '2026-08-01' },
    { name: 'Youth Convention', day_of_week: 'Saturday', event_date: '2026-08-08' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-08-29' },
    { name: 'Youth Monthly', day_of_week: 'Saturday', event_date: '2026-09-05' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-09-26' },
    { name: 'Quarterly Convention', day_of_week: 'Friday', event_date: '2026-10-02' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-10-24' },
    { name: 'Youth Monthly', day_of_week: 'Saturday', event_date: '2026-10-31' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-11-21' },
    { name: 'Christmas Party', day_of_week: 'Saturday', event_date: '2026-11-28' },
    { name: 'Sunday School Party', day_of_week: 'Saturday', event_date: '2026-12-05' },
    { name: 'Mothers Monthly', day_of_week: 'Saturday', event_date: '2026-12-19' },
    { name: 'Christmas Convention', day_of_week: 'Tuesday', event_date: '2026-12-22' },
];

async function seedEvents() {
    console.log(`Seeding ${events.length} events...`);

    const { data, error } = await supabase
        .from('events')
        .insert(events)
        .select();

    if (error) {
        console.error('Error seeding events:', error.message);
        process.exit(1);
    }

    console.log(`✅ Successfully seeded ${data.length} events.`);
    process.exit(0);
}

seedEvents();

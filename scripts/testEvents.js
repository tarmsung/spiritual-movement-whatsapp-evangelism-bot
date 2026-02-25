/**
 * Test Events Script
 * Creates dummy events 1 day, 3 days, and 7 days from now
 * Run: node scripts/testEvents.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function getFutureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

const testEvents = [
    { name: 'TEST EVENT: 1 Day Away', day_of_week: 'Thursday', event_date: getFutureDate(1) },
    { name: 'TEST EVENT: 3 Days Away', day_of_week: 'Saturday', event_date: getFutureDate(3) },
    { name: 'TEST EVENT: 7 Days Away', day_of_week: 'Wednesday', event_date: getFutureDate(7) }
];

async function seedTestEvents() {
    console.log(`Inserting test events...`);

    const { data, error } = await supabase
        .from('events')
        .insert(testEvents)
        .select();

    if (error) {
        console.error('Error inserting test events:', error.message);
        process.exit(1);
    }

    console.log(`✅ Successfully inserted ${data.length} test events.`);
    process.exit(0);
}

seedTestEvents();

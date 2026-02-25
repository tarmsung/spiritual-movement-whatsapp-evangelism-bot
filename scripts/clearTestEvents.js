/**
 * Clear Test Events Script
 * Deletes any event in the database that starts with "TEST EVENT"
 * Run: node scripts/clearTestEvents.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function clearTestEvents() {
    console.log(`Deleting all test events...`);

    const { data, error } = await supabase
        .from('events')
        .delete()
        .like('name', 'TEST EVENT%')
        .select();

    if (error) {
        console.error('Error deleting test events:', error.message);
        process.exit(1);
    }

    console.log(`✅ Successfully deleted ${data ? data.length : 0} test events from Supabase.`);
    process.exit(0);
}

clearTestEvents();

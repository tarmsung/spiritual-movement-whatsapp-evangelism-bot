/**
 * seed-admins.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time script to insert the admin phone numbers from ADMIN_NUMBERS (.env)
 * into the Supabase `admins` table.
 *
 * This gives the bot a DB fallback so it can still recognise admins even if
 * the .env file is missing or ADMIN_NUMBERS is removed.
 *
 * Usage:
 *   node scripts/seed-admins.js
 *
 * Safe to run multiple times — uses upsert so existing entries are not
 * duplicated (matches on phone_number).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function seedAdmins() {
    const raw = process.env.ADMIN_NUMBERS || '';
    if (!raw.trim()) {
        console.error('❌ ADMIN_NUMBERS is empty in .env — nothing to seed.');
        return;
    }

    const numbers = raw.split(',').map(n => n.trim()).filter(Boolean);
    console.log(`📋 Found ${numbers.length} admin number(s) in .env:`, numbers);

    const rows = numbers.map(phone => ({
        phone_number: phone,
        name: `Admin ${phone}`,   // placeholder name — update in Supabase dashboard
        role: 'admin'
    }));

    // Upsert on phone_number so it's safe to run multiple times
    const { data, error } = await supabase
        .from('admins')
        .upsert(rows, { onConflict: 'phone_number' })
        .select();

    if (error) {
        console.error('❌ Failed to seed admins:', error.message);
        return;
    }

    console.log(`✅ Successfully seeded ${data.length} admin(s) into the database.`);
    data.forEach(a => console.log(`   • ${a.phone_number} (${a.name})`));
}

seedAdmins();

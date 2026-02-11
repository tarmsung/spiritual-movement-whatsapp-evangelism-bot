import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ASSEMBLIES = [
    { name: 'Marondera', group_id: 'pending_marondera' },
    { name: 'Mutare', group_id: 'pending_mutare' },
    { name: 'Harare', group_id: 'pending_harare' },
    { name: 'Damofalls', group_id: 'pending_damofalls' },
    { name: 'Hwedza', group_id: 'pending_hwedza' },
    { name: 'Masomera', group_id: 'pending_masomera' },
    { name: 'Bulawayo', group_id: 'pending_bulawayo' }
];

async function seedAssemblies() {
    console.log('🌱 Seeding assemblies...');

    for (const assembly of ASSEMBLIES) {
        // Check if exists
        const { data: existing } = await supabase
            .from('assemblies')
            .select('*')
            .eq('name', assembly.name)
            .single();

        if (existing) {
            console.log(`⚠️  Assembly "${assembly.name}" already exists. Skipping.`);
            continue;
        }

        const { error } = await supabase
            .from('assemblies')
            .insert([
                {
                    name: assembly.name,
                    whatsapp_group_id: assembly.group_id
                }
            ]);

        if (error) {
            console.error(`❌ Failed to insert "${assembly.name}":`, error.message);
        } else {
            console.log(`✅ Added assembly: ${assembly.name}`);
        }
    }

    console.log('\n✨ Seeding complete!');
    console.log('NOTE: The WhatsApp Group IDs are set to placeholders (e.g., "pending_marondera").');
    console.log('You will need to update them with actual Group IDs for the reports to be posted correctly.');
}

seedAssemblies().catch(console.error);

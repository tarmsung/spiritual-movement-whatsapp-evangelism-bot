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

async function checkBulawayo() {
    console.log('🔍 Checking Bulawayo Assembly Configuration...\n');

    const { data: assembly, error } = await supabase
        .from('assemblies')
        .select('*')
        .ilike('name', '%Bulawayo%') // Case-insensitive search
        .single();

    if (error) {
        if (error.code === 'PGRST116') { // No rows returned
            console.log('❌ Bulawayo assembly not found in database.');
        } else {
            console.error('❌ Error fetching assembly:', error);
        }
    } else {
        console.log(`✅ Assembly Found: ${assembly.name}`);
        console.log(`   ID: ${assembly.id}`);
        console.log(`   WhatsApp Group ID: ${assembly.whatsapp_group_id || 'NOT SET ❌'}`);

        if (assembly.whatsapp_group_id) {
            console.log('\nDeployment Status: READY ✅');
        } else {
            console.log('\nDeployment Status: MISSING GROUP ID ⚠️');
        }
    }
}

checkBulawayo();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkMarondera() {
    console.log('🔍 Checking Marondera configuration...');

    const { data, error } = await supabase
        .from('assemblies')
        .select('*')
        .ilike('name', 'Marondera')
        .single();

    if (error) {
        console.error('❌ Error fetching Marondera:', error.message);
    } else if (!data) {
        console.log('NOT_FOUND');
    } else {
        console.log(`MARONDERA_ID: ${data.whatsapp_group_id || 'PENDING'}`);
    }
}

checkMarondera();

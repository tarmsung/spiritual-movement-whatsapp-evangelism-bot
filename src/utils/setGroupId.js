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

async function setAssemblyGroupId() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node src/utils/setGroupId.js <Assembly Name> <Group ID>');
        console.log('Example: node src/utils/setGroupId.js "Harare" "120363024508779999@g.us"');
        process.exit(1);
    }

    const name = args[0];
    const groupId = args[1];

    console.log(`🔍 Updating "${name}" with Group ID: ${groupId}...`);

    const { data: assembly, error: fetchError } = await supabase
        .from('assemblies')
        .select('*')
        .ilike('name', name) // Case-insensitive match
        .single();

    if (fetchError || !assembly) {
        console.error(`❌ Assembly "${name}" not found.`);
        process.exit(1);
    }

    const { error: updateError } = await supabase
        .from('assemblies')
        .update({ whatsapp_group_id: groupId })
        .eq('id', assembly.id);

    if (updateError) {
        console.error('❌ Error updating assembly:', updateError.message);
    } else {
        console.log(`✅ Successfully updated ${assembly.name} (ID: ${assembly.id})`);
        console.log(`   New Group ID: ${groupId}`);
    }
}

setAssemblyGroupId().catch(console.error);

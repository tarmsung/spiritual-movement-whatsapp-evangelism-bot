/**
 * scripts/import-members.js
 *
 * One-time seed script: inserts all 126 Spiritual Movement members
 * into the Supabase `members` table.
 *
 * Usage:
 *   node scripts/import-members.js
 *
 * Prerequisites:
 *   - Run scripts/create-members-table.sql in Supabase first
 *   - .env must have SUPABASE_URL and SUPABASE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ── Member data ──────────────────────────────────────────────────────────────
const MEMBERS = [
    // Bulawayo
    { member_id: 1000, gender: 'Female', first_name: 'Chengeto',        surname: 'Magamu',          cluster: 'Bulawayo' },
    { member_id: 1001, gender: 'Male',   first_name: 'Tanaka',           surname: 'Mujaji',          cluster: 'Bulawayo' },
    { member_id: 1002, gender: 'Male',   first_name: 'Mwarianesu',       surname: 'Magamu',          cluster: 'Bulawayo' },
    { member_id: 1003, gender: 'Female', first_name: 'Vimbai',           surname: 'Nyika',           cluster: 'Bulawayo' },
    { member_id: 1004, gender: 'Male',   first_name: 'Tadiwanashe',      surname: 'Muronda',         cluster: 'Bulawayo' },
    { member_id: 1005, gender: 'Male',   first_name: 'Prince',           surname: 'Nyahwema',        cluster: 'Bulawayo' },
    { member_id: 1006, gender: 'Female', first_name: 'Vimbai',           surname: 'Mujaji',          cluster: 'Bulawayo' },
    { member_id: 1007, gender: 'Male',   first_name: 'Tendai',           surname: 'Magamu',          cluster: 'Bulawayo' },
    { member_id: 1008, gender: 'Male',   first_name: 'Vanoshamisa',      surname: 'Magamu',          cluster: 'Bulawayo' },
    // Damofalls
    { member_id: 1009, gender: 'Female', first_name: 'Hope',             surname: 'Chigede',         cluster: 'Damofalls' },
    { member_id: 1010, gender: 'Female', first_name: 'Prudence',         surname: 'Chipfupi',        cluster: 'Damofalls' },
    { member_id: 1011, gender: 'Female', first_name: 'Chipo',            surname: 'Chiwade',         cluster: 'Damofalls' },
    { member_id: 1012, gender: 'Female', first_name: 'Goodness',         surname: 'Mhlanga',         cluster: 'Damofalls' },
    { member_id: 1013, gender: 'Male',   first_name: 'Theophilous',      surname: 'Chiwade',         cluster: 'Damofalls' },
    { member_id: 1014, gender: 'Male',   first_name: 'Tinashe',          surname: 'Chipfupi',        cluster: 'Damofalls' },
    { member_id: 1015, gender: 'Female', first_name: 'Nyarai',           surname: 'Chiwade',         cluster: 'Damofalls' },
    { member_id: 1016, gender: 'Male',   first_name: 'Kumbirai',         surname: 'Mhlanga',         cluster: 'Damofalls' },
    { member_id: 1017, gender: 'Male',   first_name: 'Tasimudzwa',       surname: 'Chipfupi',        cluster: 'Damofalls' },
    { member_id: 1018, gender: 'Female', first_name: 'Tichakushumirai',  surname: 'Mhlanga',         cluster: 'Damofalls' },
    // Harare
    { member_id: 1019, gender: 'Male',   first_name: 'Lenon',            surname: 'Bonyongwa',       cluster: 'Harare' },
    { member_id: 1020, gender: 'Male',   first_name: 'Trust',            surname: 'Muronda',         cluster: 'Harare' },
    { member_id: 1021, gender: 'Male',   first_name: 'Kudzanai',         surname: 'Chivasa',         cluster: 'Harare' },
    { member_id: 1022, gender: 'Female', first_name: 'Martha',           surname: 'Kuambembe',       cluster: 'Harare' },
    { member_id: 1023, gender: 'Male',   first_name: 'Learmore',         surname: 'Kaumbembe',       cluster: 'Harare' },
    { member_id: 1024, gender: 'Female', first_name: 'Portia',           surname: 'Kapondoro',       cluster: 'Harare' },
    { member_id: 1025, gender: 'Male',   first_name: 'Takudzwa',         surname: 'Machingura',      cluster: 'Harare' },
    { member_id: 1026, gender: 'Male',   first_name: 'Anesu',            surname: 'Takunyai',        cluster: 'Harare' },
    { member_id: 1027, gender: 'Male',   first_name: 'Desire',           surname: 'Chinyanga',       cluster: 'Harare' },
    { member_id: 1028, gender: 'Male',   first_name: 'Tinaye',           surname: 'Magorimbo',       cluster: 'Harare' },
    { member_id: 1029, gender: 'Male',   first_name: 'Linton',           surname: 'Takunayi',        cluster: 'Harare' },
    { member_id: 1030, gender: 'Male',   first_name: 'Matthew',          surname: 'Kaumbembe',       cluster: 'Harare' },
    { member_id: 1031, gender: 'Female', first_name: 'Atipamufaro',      surname: 'Kaumbembe',       cluster: 'Harare' },
    { member_id: 1032, gender: 'Female', first_name: 'Courtney',         surname: 'John',            cluster: 'Harare' },
    // Hwedza
    { member_id: 1033, gender: 'Male',   first_name: 'Canan',            surname: 'Chigede',         cluster: 'Hwedza' },
    { member_id: 1034, gender: 'Female', first_name: 'Taizivei',         surname: 'Chigede',         cluster: 'Hwedza' },
    { member_id: 1035, gender: 'Male',   first_name: 'Last',             surname: 'Nyamutakwa',      cluster: 'Hwedza' },
    { member_id: 1036, gender: 'Male',   first_name: 'Anotida',          surname: 'Nyamutakwa',      cluster: 'Hwedza' },
    { member_id: 1037, gender: 'Female', first_name: 'Virginia',         surname: 'Nyamutakwa',      cluster: 'Hwedza' },
    { member_id: 1038, gender: 'Male',   first_name: 'Anopa',            surname: 'Nyamutakwa',      cluster: 'Hwedza' },
    { member_id: 1039, gender: 'Male',   first_name: 'Ngaakudzwe',       surname: 'Nyamutakwa',      cluster: 'Hwedza' },
    { member_id: 1040, gender: 'Male',   first_name: 'Comfort',          surname: 'Chigede',         cluster: 'Hwedza' },
    { member_id: 1041, gender: 'Male',   first_name: 'Tamuka',           surname: 'Nyamutakwa',      cluster: 'Hwedza' },
    { member_id: 1042, gender: 'Female', first_name: 'Tavimbanashe',     surname: 'Nyamutakwa',      cluster: 'Hwedza' },
    { member_id: 1043, gender: 'Female', first_name: 'Matishongedza',    surname: 'Nyamutakwa',      cluster: 'Hwedza' },
    // Marondera
    { member_id: 1044, gender: 'Female', first_name: 'Jessica',          surname: 'Maisiri',         cluster: 'Marondera' },
    { member_id: 1045, gender: 'Female', first_name: 'Pamhidzai',        surname: 'Nyanga',          cluster: 'Marondera' },
    { member_id: 1046, gender: 'Female', first_name: 'Nyasha',           surname: 'Maisiri',         cluster: 'Marondera' },
    { member_id: 1047, gender: 'Female', first_name: 'Rumbidzayi',       surname: 'Makuzo',          cluster: 'Marondera' },
    { member_id: 1048, gender: 'Male',   first_name: 'Francis',          surname: 'Makuzo',          cluster: 'Marondera' },
    { member_id: 1049, gender: 'Male',   first_name: 'Vincent',          surname: 'Mushonga',        cluster: 'Marondera' },
    { member_id: 1050, gender: 'Male',   first_name: 'Tadiwanashe',      surname: 'Mutisi',          cluster: 'Marondera' },
    { member_id: 1051, gender: 'Male',   first_name: 'Blessed',          surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1052, gender: 'Female', first_name: 'Lucy',             surname: 'Makwindi',        cluster: 'Marondera' },
    { member_id: 1053, gender: 'Female', first_name: 'Deniwe',           surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1054, gender: 'Male',   first_name: 'Luckymore',        surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1055, gender: 'Female', first_name: 'Ropa',             surname: 'Gwata',           cluster: 'Marondera' },
    { member_id: 1056, gender: 'Female', first_name: 'Future',           surname: 'Simango',         cluster: 'Marondera' },
    { member_id: 1057, gender: 'Female', first_name: 'Delight',          surname: 'Chigede',         cluster: 'Marondera' },
    { member_id: 1058, gender: 'Female', first_name: 'Nokutenda',        surname: 'Maisiri',         cluster: 'Marondera' },
    { member_id: 1059, gender: 'Female', first_name: 'Irene',            surname: 'Masaira',         cluster: 'Marondera' },
    { member_id: 1060, gender: 'Female', first_name: 'Sarah',            surname: 'Chigede',         cluster: 'Marondera' },
    { member_id: 1061, gender: 'Female', first_name: 'Edith',            surname: 'Ferume',          cluster: 'Marondera' },
    { member_id: 1062, gender: 'Male',   first_name: 'David',            surname: 'Makwindi',        cluster: 'Marondera' },
    { member_id: 1063, gender: 'Female', first_name: 'Nokutenda',        surname: 'Muyengwa',        cluster: 'Marondera' },
    { member_id: 1064, gender: 'Female', first_name: 'Bridget',          surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1065, gender: 'Female', first_name: 'Joyline',          surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1066, gender: 'Male',   first_name: 'Tamirira',         surname: 'Chiwade',         cluster: 'Marondera' },
    { member_id: 1067, gender: 'Male',   first_name: 'Munopa',           surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1068, gender: 'Male',   first_name: 'Presage',          surname: 'Maisiri',         cluster: 'Marondera' },
    { member_id: 1069, gender: 'Female', first_name: 'Otilia',           surname: 'Fore',            cluster: 'Marondera' },
    { member_id: 1070, gender: 'Male',   first_name: 'Ngoni',            surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1071, gender: 'Female', first_name: 'Kestina',          surname: 'Mushonga',        cluster: 'Marondera' },
    { member_id: 1072, gender: 'Female', first_name: 'Elizabeth',        surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1073, gender: 'Female', first_name: 'Peculiar',         surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1074, gender: 'Female', first_name: 'Nokuizvashe',      surname: 'Maisiiri',        cluster: 'Marondera' },
    { member_id: 1075, gender: 'Female', first_name: 'Felistas',         surname: 'Musengeyi',       cluster: 'Marondera' },
    { member_id: 1076, gender: 'Female', first_name: 'Sibongile',        surname: 'Machado',         cluster: 'Marondera' },
    { member_id: 1077, gender: 'Male',   first_name: 'Farai',            surname: 'Maisiri',         cluster: 'Marondera' },
    { member_id: 1078, gender: 'Male',   first_name: 'Gamuchirai',       surname: 'Muganiwa',        cluster: 'Marondera' },
    { member_id: 1079, gender: 'Female', first_name: 'Kupakwashe',       surname: 'Magamu',          cluster: 'Marondera' },
    { member_id: 1080, gender: 'Male',   first_name: 'Tapiwa',           surname: 'Musuka',          cluster: 'Marondera' },
    { member_id: 1081, gender: 'Female', first_name: 'Martha',           surname: 'Chimanya',        cluster: 'Marondera' },
    { member_id: 1082, gender: 'Female', first_name: 'Memory',           surname: 'Gwerere',         cluster: 'Marondera' },
    { member_id: 1083, gender: 'Female', first_name: 'Tabitha',          surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1084, gender: 'Male',   first_name: 'Tanaka',           surname: 'Makuzo',          cluster: 'Marondera' },
    { member_id: 1085, gender: 'Male',   first_name: 'Jared',            surname: 'Makuzo',          cluster: 'Marondera' },
    { member_id: 1086, gender: 'Female', first_name: 'Anouyaishe',       surname: 'Nyanga',          cluster: 'Marondera' },
    { member_id: 1087, gender: 'Female', first_name: 'Munorapa',         surname: 'Nyanga',          cluster: 'Marondera' },
    { member_id: 1088, gender: 'Male',   first_name: 'Taropafadzwa',     surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1089, gender: 'Female', first_name: 'Tichafaranashe',   surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1090, gender: 'Male',   first_name: 'Murikoishe',       surname: 'Zinyama',         cluster: 'Marondera' },
    { member_id: 1091, gender: 'Male',   first_name: 'Anenyasha',        surname: 'Maisiri',         cluster: 'Marondera' },
    { member_id: 1092, gender: 'Male',   first_name: 'Hillel',           surname: 'Makuzo',          cluster: 'Marondera' },
    { member_id: 1093, gender: 'Female', first_name: 'Nokuvonga',        surname: 'Maisiri',         cluster: 'Marondera' },
    { member_id: 1094, gender: 'Female', first_name: 'Viviane',          surname: 'Mushonga',        cluster: 'Marondera' },
    { member_id: 1095, gender: 'Male',   first_name: 'Munogona',         surname: 'Maisiri',         cluster: 'Marondera' },
    { member_id: 1096, gender: 'Male',   first_name: 'Kudakwashe',       surname: 'Manuwere',        cluster: 'Marondera' },
    { member_id: 1097, gender: 'Male',   first_name: 'Stallon',          surname: 'Chakasvipa',      cluster: 'Marondera' },
    { member_id: 1098, gender: 'Male',   first_name: 'Righteous',        surname: 'Nyanga',          cluster: 'Marondera' },
    { member_id: 1099, gender: 'Male',   first_name: 'Tapiwa',           surname: 'Musuka',          cluster: 'Marondera' },
    // Masomera
    { member_id: 1100, gender: 'Female', first_name: 'Permuly',          surname: 'Mukonowoshuro',   cluster: 'Masomera' },
    { member_id: 1101, gender: 'Male',   first_name: 'Stanley',          surname: 'Mukonowoshuro',   cluster: 'Masomera' },
    { member_id: 1102, gender: 'Male',   first_name: 'Tonnet',           surname: 'Musuka',          cluster: 'Masomera' },
    { member_id: 1103, gender: 'Female', first_name: 'Praise',           surname: 'Muberekwa',       cluster: 'Masomera' },
    { member_id: 1104, gender: 'Male',   first_name: 'Hilton',           surname: 'Mhlanga',         cluster: 'Masomera' },
    // Mutare
    { member_id: 1105, gender: 'Female', first_name: 'Previous',         surname: 'Matingwina',      cluster: 'Mutare' },
    { member_id: 1106, gender: 'Female', first_name: 'Patience',         surname: 'Masaira',         cluster: 'Mutare' },
    { member_id: 1107, gender: 'Male',   first_name: 'Bright',           surname: 'Takunyai',        cluster: 'Mutare' },
    { member_id: 1108, gender: 'Male',   first_name: 'Tavonga',          surname: 'Chiwade',         cluster: 'Mutare' },
    { member_id: 1109, gender: 'Male',   first_name: 'Tapiwanashe',      surname: 'Matingwina',      cluster: 'Mutare' },
    { member_id: 1110, gender: 'Male',   first_name: 'Blessing',         surname: 'Tapambwa',        cluster: 'Mutare' },
    { member_id: 1111, gender: 'Female', first_name: 'Torence',          surname: 'Takunyai',        cluster: 'Mutare' },
    { member_id: 1112, gender: 'Female', first_name: 'Elizabeth',        surname: 'Garudzo',         cluster: 'Mutare' },
    { member_id: 1113, gender: 'Male',   first_name: 'Nickson',          surname: 'Takunyai',        cluster: 'Mutare' },
    { member_id: 1114, gender: 'Female', first_name: 'Tsitsi',           surname: 'Tapammbwa',       cluster: 'Mutare' },
    { member_id: 1115, gender: 'Female', first_name: 'Matiponesa',       surname: 'Matingwina',      cluster: 'Mutare' },
    { member_id: 1116, gender: 'Female', first_name: 'Chloe',            surname: 'Masaira',         cluster: 'Mutare' },
    { member_id: 1117, gender: 'Male',   first_name: 'Elton',            surname: 'Musuka',          cluster: 'Mutare' },
    { member_id: 1118, gender: 'Male',   first_name: 'Tatenda',          surname: 'Takunyai',        cluster: 'Mutare' },
    { member_id: 1119, gender: 'Male',   first_name: 'Kumbirai',         surname: 'Musuka',          cluster: 'Mutare' },
    { member_id: 1120, gender: 'Female', first_name: 'Shumirai',         surname: 'Takunyai',        cluster: 'Mutare' },
    { member_id: 1121, gender: 'Male',   first_name: 'Ryan',             surname: 'Masaira',         cluster: 'Mutare' },
    { member_id: 1122, gender: 'Male',   first_name: 'Candid',           surname: 'Takunyai',        cluster: 'Mutare' },
    // Poland
    { member_id: 1123, gender: 'Female', first_name: 'Berthany',         surname: 'Moyo',            cluster: 'Poland' },
    { member_id: 1124, gender: 'Male',   first_name: 'Ngonidzashe',      surname: 'Moyo',            cluster: 'Poland' },
    { member_id: 1125, gender: 'Female', first_name: 'MunotidaIshe',     surname: 'Moyo',            cluster: 'Poland' },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function importMembers() {
    console.log('🚀 Starting member import...\n');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
        process.exit(1);
    }

    // Build rows with pre-computed full_name
    const rows = MEMBERS.map(m => ({
        member_id:  m.member_id,
        first_name: m.first_name,
        surname:    m.surname,
        full_name:  `${m.first_name} ${m.surname}`,
        gender:     m.gender,
        cluster:    m.cluster,
    }));

    console.log(`📋 Total members to insert: ${rows.length}`);

    // Upsert in batches of 10 to be safer on Windows/Node 24
    const BATCH_SIZE = 10;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);

        const { error } = await supabase
            .from('members')
            .upsert(batch, { onConflict: 'member_id' });

        if (error) {
            console.error(`❌ Error inserting batch starting at index ${i}:`, error.message);
            process.exit(1);
        }

        inserted += batch.length;
        console.log(`  ✅ Inserted ${inserted}/${rows.length} members...`);
        
        // Short delay to avoid Node 24 Windows async glue bugs
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n✅ All ${rows.length} members imported successfully!`);

    // Quick verification
    const { data, error: verifyError } = await supabase
        .from('members')
        .select('member_id, full_name, cluster', { count: 'exact' });

    if (verifyError) {
        console.error('⚠️  Could not verify — check Supabase manually:', verifyError.message);
    } else {
        console.log(`\n📊 Verification — total rows in members table: ${data.length}`);
        const clusterCounts = data.reduce((acc, m) => {
            acc[m.cluster] = (acc[m.cluster] || 0) + 1;
            return acc;
        }, {});
        console.log('\nMembers per cluster:');
        Object.entries(clusterCounts).sort().forEach(([cluster, count]) => {
            console.log(`  ${cluster}: ${count}`);
        });
    }
}

importMembers().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});

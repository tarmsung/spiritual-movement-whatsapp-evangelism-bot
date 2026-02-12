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

async function viewDatabase() {
  console.log('📊 DATABASE CONTENTS\n');
  console.log('='.repeat(80));

  // Count reports by source
  console.log('\n📈 REPORTS BY SOURCE:');
  const { data: countBySource, error: countError } = await supabase
    .from('reports')
    .select('source');

  if (countError) {
    console.error('Error fetching reports:', countError);
  } else {
    const counts = {};
    countBySource.forEach(r => {
      const source = r.source || 'unknown';
      counts[source] = (counts[source] || 0) + 1;
    });

    Object.entries(counts).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} report(s)`);
    });
  }

  // Show all reports
  console.log('\n📋 ALL REPORTS (Latest 10):');
  console.log('='.repeat(80));

  const { data: allReports, error: reportsError } = await supabase
    .from('reports')
    .select(`
            id,
            activity_date,
            location,
            activity_type,
            converts,
            source,
            reporter_name,
            assemblies (name)
        `)
    .order('id', { ascending: false })
    .limit(10);

  if (reportsError) {
    console.error('Error fetching reports:', reportsError);
  } else if (allReports.length === 0) {
    console.log('   No reports found in database.');
  } else {
    allReports.forEach(report => {
      console.log(`\n   ID: ${report.id}`);
      console.log(`   Date: ${report.activity_date}`);
      console.log(`   Location: ${report.location}`);
      console.log(`   Activity: ${report.activity_type}`);
      console.log(`   Converts: ${report.converts}`);
      console.log(`   Reporter: ${report.reporter_name}`);
      console.log(`   Assembly: ${report.assemblies ? report.assemblies.name : 'N/A'}`);
      console.log(`   Source: ${report.source}`);
      console.log(`   ${'-'.repeat(76)}`);
    });
  }

  // Show group-sourced reports specifically
  console.log('\n\n📱 GROUP MESSAGE REPORTS:');
  console.log('='.repeat(80));

  const { data: groupReports, error: groupError } = await supabase
    .from('reports')
    .select(`
            *,
            assemblies (name)
        `)
    .eq('source', 'group_message')
    .order('created_at', { ascending: false });

  if (groupError) {
    console.error('Error fetching group reports:', groupError);
  } else if (groupReports.length === 0) {
    console.log('   No group message reports yet. Try posting one in a group!');
  } else {
    groupReports.forEach(report => {
      console.log(`\n   ID: ${report.id}`);
      console.log(`   Date: ${report.activity_date}`);
      console.log(`   Location: ${report.location}`);
      console.log(`   Activity: ${report.activity_type}`);
      console.log(`   Preachers Team: ${report.preachers_team}`);
      console.log(`   Message Summary: ${report.message_summary ? report.message_summary.substring(0, 60) + '...' : ''}`);
      console.log(`   Converts: ${report.converts}`);
      console.log(`   Sick Prayed For: ${report.sick_prayed_for}`);
      console.log(`   Reporter: ${report.reporter_name}`);
      console.log(`   Assembly: ${report.assemblies ? report.assemblies.name : 'N/A'}`);
      console.log(`   Created: ${report.created_at}`);
      console.log(`   ${'-'.repeat(76)}`);
    });
  }

  // Show clusters
  console.log('\n\n🏛️  CONFIGURED CLUSTERS:');
  console.log('='.repeat(80));

  const { data: assemblies, error: assembliesError } = await supabase
    .from('assemblies')
    .select('*');

  if (assembliesError) {
    console.error('Error fetching clusters:', assembliesError);
  } else if (assemblies.length === 0) {
    console.log('   No clusters configured.');
  } else {
    assemblies.forEach(assembly => {
      console.log(`   ${assembly.id}. ${assembly.name}`);
      console.log(`      Group ID: ${assembly.whatsapp_group_id}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Query complete!\n');
}

viewDatabase().catch(console.error);

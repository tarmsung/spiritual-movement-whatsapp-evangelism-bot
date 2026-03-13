import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { getCleanPhone } from '../utils/helpers.js';

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseKey);

/**
 * Initialize database connection check
 */
export async function initializeDatabase() {
  logger.info('Checking Supabase connection...');
  const { error } = await supabase.from('assemblies').select('count', { count: 'exact', head: true });

  if (error) {
    logger.error('Failed to connect to Supabase:', error.message);
    throw error;
  }

  logger.info('Supabase connection successful');
}

/**
 * ASSEMBLIES - CRUD Operations
 */

export async function createAssembly(name, whatsappGroupId) {
  const { data, error } = await supabase
    .from('assemblies')
    .insert([{ name, whatsapp_group_id: whatsappGroupId }])
    .select();

  if (error) throw error;
  return { lastInsertRowid: data[0].id }; // Maintain compatibility with SQLite return shape
}

export async function getAssembly(id) {
  const { data, error } = await supabase
    .from('assemblies')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "Row not found"
  return data;
}

export async function getAllAssemblies() {
  const { data, error } = await supabase
    .from('assemblies')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function updateAssembly(id, name, whatsappGroupId) {
  const { error } = await supabase
    .from('assemblies')
    .update({ name, whatsapp_group_id: whatsappGroupId })
    .eq('id', id);

  if (error) throw error;
  return { changes: 1 };
}

export async function deleteAssembly(id) {
  const { error } = await supabase
    .from('assemblies')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { changes: 1 };
}

/**
 * Get assembly by WhatsApp group JID
 * @param {string} groupJid - WhatsApp group JID
 * @returns {Promise<Object|undefined>} Assembly object or undefined
 */
export async function getAssemblyByGroupJid(groupJid) {
  const { data, error } = await supabase
    .from('assemblies')
    .select('*')
    .eq('whatsapp_group_id', groupJid)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || undefined;
}


/**
 * ADMINS - CRUD Operations
 */

/**
 * Check if a number is an admin (either in config or in DB)
 * @param {string} phone - User phone number
 * @returns {Promise<boolean>}
 */
export async function isAdmin(phone) {
  const cleanPhone = getCleanPhone(phone);
  
  // Check config first (faster)
  if (config.adminNumbers.map(n => getCleanPhone(n)).includes(cleanPhone)) {
    return true;
  }

  // Check database
  const { data, error } = await supabase
    .from('admins')
    .select('id')
    .eq('phone_number', cleanPhone)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error(`Error checking admin status for ${phone}:`, error.message);
    return false;
  }

  return !!data;
}

/**
 * Get all admins from the database
 * @returns {Promise<Array>}
 */
export async function getAllAdmins() {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

/**
 * Add a new admin to the database
 * @param {string} phone 
 * @param {string} name 
 * @param {string} role 
 */
export async function addAdmin(phone, name, role = 'executor') {
  const { data, error } = await supabase
    .from('admins')
    .insert([{ phone_number: phone, name, role }])
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Remove an admin from the database
 * @param {string} phone 
 */
export async function removeAdmin(phone) {
  const { error } = await supabase
    .from('admins')
    .delete()
    .eq('phone_number', phone);

  if (error) throw error;
  return { changes: 1 };
}

/**
 * SUPERVISORS (Church Members) - CRUD Operations
 */

/**
 * Check if a number is a supervisor
 * @param {string} phone - User phone number
 * @returns {Promise<boolean>}
 */
export async function isSupervisor(phone) {
  const cleanPhone = getCleanPhone(phone);
  const { data, error } = await supabase
    .from('supervisors')
    .select('id')
    .eq('phone_number', cleanPhone)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error(`Error checking supervisor status for ${phone}:`, error.message);
    return false;
  }

  return !!data;
}

/**
 * Get all supervisors from the database
 * @returns {Promise<Array>}
 */
export async function getAllSupervisors() {
  const { data, error } = await supabase
    .from('supervisors')
    .select('*')
    .order('name');

  if (error) {
    logger.error('Error fetching supervisors:', error.message);
    return [];
  }
  return data;
}

/**
 * Add a new supervisor
 * @param {string} phone 
 * @param {string} name 
 * @param {string} branch 
 */
export async function addSupervisor(phone, name, branch) {
  const { data, error } = await supabase
    .from('supervisors')
    .insert([{ phone_number: phone, name, branch }])
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Remove a supervisor
 * @param {string} phone 
 */
export async function removeSupervisor(phone) {
  const { error } = await supabase
    .from('supervisors')
    .delete()
    .eq('phone_number', phone);

  if (error) throw error;
  return { changes: 1 };
}

/**
 * REPORTS - CRUD Operations
 */

export async function createReport(reportData) {
  const { data, error } = await supabase
    .from('reports')
    .insert([{
      assembly_id: reportData.assembly_id,
      activity_date: reportData.activity_date,
      location: reportData.location,
      area: reportData.area || null,
      city: reportData.city || null,
      activity_type: reportData.activity_type,
      preachers_team: reportData.preachers_team,
      message_summary: reportData.message_summary,
      response_moments: reportData.response_moments || null,
      saved: reportData.saved ?? reportData.converts ?? 0,
      healed: reportData.healed ?? reportData.sick_prayed_for ?? 0,
      reporter_name: reportData.reporter_name,
      reporter_phone: reportData.reporter_phone,
      source: reportData.source || 'form'
    }])
    .select();

  if (error) throw error;
  return { lastInsertRowid: data[0].id };
}

/**
 * Create report from group message
 * @param {number} assemblyId
 * @param {Object} reportData
 * @param {string} senderPhone
 * @param {string} waMessageId - WhatsApp message ID (for deletion tracking)
 */
export async function createGroupReport(assemblyId, reportData, senderPhone, waMessageId = null) {
  const insertData = {
    assembly_id: assemblyId,
    activity_date: reportData.activity_date,
    location: reportData.location,
    area: reportData.area || null,
    city: reportData.city || null,
    activity_type: reportData.activity_type,
    preachers_team: reportData.preachers_team || reportData.reporter_name,
    message_summary: reportData.message_summary,
    response_moments: reportData.response_moments || null,
    saved: reportData.saved ?? reportData.converts ?? 0,
    healed: reportData.healed ?? reportData.sick_prayed_for ?? 0,
    reporter_name: reportData.reporter_name,
    reporter_phone: senderPhone,
    source: 'group_message',
    posted_to_group: true,
  };

  // Include wa_message_id if provided (column may not exist yet — fall back if needed)
  if (waMessageId) insertData.wa_message_id = waMessageId;

  const { data, error } = await supabase
    .from('reports')
    .insert([insertData])
    .select();

  if (error) {
    // If wa_message_id column doesn't exist yet, retry without it
    if (waMessageId && (error.code === '42703' || error.message?.includes('wa_message_id'))) {
      logger.warn('[DB] wa_message_id column not found, saving report without it. Add the column to enable deletion tracking.');
      delete insertData.wa_message_id;
      const { data: data2, error: error2 } = await supabase
        .from('reports')
        .insert([insertData])
        .select();
      if (error2) throw error2;
      return { lastInsertRowid: data2[0].id };
    }
    throw error;
  }

  return { lastInsertRowid: data[0].id };
}

/**
 * Delete a report by WhatsApp message ID (used when reporter deletes their message)
 * @param {string} waMessageId - WhatsApp message ID
 * @returns {Promise<Object|null>} Deleted report data or null if not found
 */
export async function deleteReportByMessageId(waMessageId) {
  // First fetch the report (with assembly info) so we can include it in the group notification
  const { data: report, error: fetchError } = await supabase
    .from('reports')
    .select(`
      id,
      reporter_name,
      activity_date,
      location,
      assemblies (
        name,
        whatsapp_group_id
      )
    `)
    .eq('wa_message_id', waMessageId)
    .single();

  if (fetchError && fetchError.code === 'PGRST116') return null; // Not found — not a tracked report
  if (fetchError) throw fetchError;

  // Now delete it
  const { error: deleteError } = await supabase
    .from('reports')
    .delete()
    .eq('wa_message_id', waMessageId);

  if (deleteError) throw deleteError;

  return {
    id: report.id,
    reporter_name: report.reporter_name,
    activity_date: report.activity_date,
    location: report.location,
    assembly_name: report.assemblies?.name,
    whatsapp_group_id: report.assemblies?.whatsapp_group_id
  };
}

export async function getReport(id) {
  // Join with assemblies to get name and group id
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      assemblies (
        name,
        whatsapp_group_id
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;

  // Flatten the structure to match SQLite return
  if (data && data.assemblies) {
    data.assembly_name = data.assemblies.name;
    data.whatsapp_group_id = data.assemblies.whatsapp_group_id;
    delete data.assemblies;
  }

  return data;
}

export async function getReportsByDateRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      assemblies (
        name
      )
    `)
    .gte('activity_date', startDate)
    .lte('activity_date', endDate)
    .order('activity_date', { ascending: false });

  if (error) throw error;

  // Flatten
  return data.map(r => {
    if (r.assemblies) {
      r.assembly_name = r.assemblies.name;
      delete r.assemblies;
    }
    return r;
  });
}

export async function getReportsByAssembly(assemblyId) {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('assembly_id', assemblyId)
    .order('activity_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function markReportAsPosted(reportId) {
  const { error } = await supabase
    .from('reports')
    .update({ posted_to_group: true })
    .eq('id', reportId);

  if (error) throw error;
  return { changes: 1 };
}

/**
 * USERS - Form State Management
 */

export async function getUserFormState(phone) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || undefined;
}

export async function saveUserFormState(phone, step, formData) {
  const { error } = await supabase
    .from('users')
    .upsert({
      phone,
      current_form_step: step,
      form_data: formData, // Supabase handles JSONB automatically
      updated_at: new Date()
    });

  if (error) throw error;
  return { changes: 1 };
}

export async function clearUserFormState(phone) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('phone', phone);

  if (error) throw error;
  return { changes: 1 };
}

/**
 * STATISTICS - Aggregation Queries (Performed in JS)
 */

export async function getMonthlyStatsByAssembly(startDate, endDate) {
  // 1. Get all assemblies
  const assemblies = await getAllAssemblies();

  // 2. Get all reports in range
  const { data: reports, error } = await supabase
    .from('reports')
    .select('assembly_id, saved, healed')
    .gte('activity_date', startDate)
    .lte('activity_date', endDate);

  if (error) throw error;

  // 3. Aggregate
  const stats = assemblies.map(assembly => {
    const assemblyReports = reports.filter(r => r.assembly_id === assembly.id);
    return {
      assembly_id: assembly.id,
      assembly_name: assembly.name,
      total_reports: assemblyReports.length,
      total_saved: assemblyReports.reduce((sum, r) => sum + (r.saved || 0), 0),
      total_healed: assemblyReports.reduce((sum, r) => sum + (r.healed || 0), 0)
    };
  });

  return stats.sort((a, b) => b.total_reports - a.total_reports);
}

export async function getMonthlyStats(startDate, endDate) {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('saved, healed')
    .gte('activity_date', startDate)
    .lte('activity_date', endDate);

  if (error) throw error;

  return {
    total_reports: reports.length,
    total_saved: reports.reduce((sum, r) => sum + (r.saved || 0), 0),
    total_healed: reports.reduce((sum, r) => sum + (r.healed || 0), 0)
  };
}

export async function getActivityTypeBreakdown(startDate, endDate) {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('activity_type, saved, healed')
    .gte('activity_date', startDate)
    .lte('activity_date', endDate);

  if (error) throw error;

  // Group by activity_type
  const groups = {};

  reports.forEach(r => {
    if (!groups[r.activity_type]) {
      groups[r.activity_type] = {
        activity_type: r.activity_type,
        count: 0,
        total_saved: 0,
        total_healed: 0
      };
    }

    groups[r.activity_type].count++;
    groups[r.activity_type].total_saved += (r.saved || 0);
    groups[r.activity_type].total_healed += (r.healed || 0);
  });

  return Object.values(groups).sort((a, b) => b.count - a.count);
}

/**
 * Get reports for a specific assembly within a date range (only fields needed for AI report)
 * @param {number} assemblyId - Assembly ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Reports with selected fields only
 */
export async function getReportsForAssembly(assemblyId, startDate, endDate) {
  const { data, error } = await supabase
    .from('reports')
    .select('activity_date, location, area, city, activity_type, preachers_team, message_summary, saved, healed')
    .eq('assembly_id', assemblyId)
    .gte('activity_date', startDate)
    .lte('activity_date', endDate)
    .order('activity_date', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * EVENTS - Calendar Operations
 */

/**
 * Get upcoming events from today onwards, optionally filtered by month
 * @param {number} limit - Max number of events to return (default 10)
 * @param {string} [monthName] - Optional month name (e.g. 'march', 'mar')
 */
export async function getUpcomingEvents(limit = 10, monthName = null) {
  let query = supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true });

  if (monthName) {
    // If a month is requested, find the exact month number
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    const monthLower = monthName.toLowerCase();
    let monthIndex = months.findIndex(m => m.startsWith(monthLower));

    if (monthIndex === -1) {
      monthIndex = shortMonths.findIndex(m => m.startsWith(monthLower));
    }

    if (monthIndex !== -1) {
      // We found a valid month. Filter events for that month (in the current year)
      const year = new Date().getFullYear();
      const monthNumStr = String(monthIndex + 1).padStart(2, '0');

      // Start and end of the requested month
      const startOfMonth = `${year}-${monthNumStr}-01`;

      const endDate = new Date(year, monthIndex + 1, 0);
      const endOfMonth = endDate.toISOString().split('T')[0];

      query = query.gte('event_date', startOfMonth).lte('event_date', endOfMonth);
    } else {
      // Fallback to "upcoming from today" if month is invalid
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('event_date', today).limit(limit);
    }
  } else {
    // No month specified, just get upcoming from today
    const today = new Date().toISOString().split('T')[0];
    query = query.gte('event_date', today).limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Get the single next upcoming event
 */
export async function getNextEvent() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/**
 * Get events happening exactly N days from today (for reminders)
 * @param {number} daysFromNow - Number of days from today
 */
export async function getEventsInDays(daysFromNow) {
  const target = new Date();
  target.setDate(target.getDate() + daysFromNow);
  const targetStr = target.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_date', targetStr)
    .not('name', 'like', 'TEST EVENT%');

  if (error) throw error;
  return data;
}

export default supabase;


import logger from '../utils/logger.js';
import { handleGroupMessage } from './groupMessageHandler.js';
import { extractPhone } from '../utils/helpers.js';
import { getUpcomingEvents, getNextEvent, isAdmin, isSupervisor } from '../database/db.js';
import { formatCalendarDate } from '../utils/helpers.js';
import { lidToPhone } from './connection.js';


/**
 * Main message handler - entry point for all incoming messages
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {string} messageText - Message text content
 */
export async function handleMessage(sock, msg, messageText) {
    const remoteJid = msg.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');

    // Route group messages to dedicated group handler
    if (isGroup) {
        await handleGroupMessage(sock, msg, messageText);
        return;
    }

    // --- DM Handling ---
    // If the sender is a LID (@lid), resolve it to the real phone JID using our contact cache.
    // If cache misses, also try msg.key.remoteJidAlt which WhatsApp sometimes provides directly.
    let senderJid = remoteJid;
    if (senderJid.endsWith('@lid')) {
        const cached = lidToPhone[senderJid];
        const alt = msg.key.remoteJidAlt;

        if (cached) {
            logger.info(`[DM] Resolved LID ${senderJid} → ${cached} (cache)`);
            senderJid = cached;
        } else if (alt) {
            logger.info(`[DM] Resolved LID ${senderJid} → ${alt} (remoteJidAlt)`);
            senderJid = alt;
            // Populate cache so future messages are instant
            lidToPhone[senderJid] = alt;
        } else {
            logger.warn(`[DM] Unresolved LID: ${senderJid} — contact not synced yet, treating as non-admin`);
        }
    }

    const phone = extractPhone(senderJid);

    // --- Authorization: env takes priority, Supabase admins table is the fallback ---
    let adminAccess = false;
    try {
        adminAccess = await isAdmin(phone); // checks ADMIN_NUMBERS env first, then DB
    } catch (err) {
        logger.warn(`[DM] isAdmin check failed for ${phone}, defaulting to false:`, err.message);
    }

    logger.info(`[DM] Message from ${phone} (admin: ${adminAccess}): ${messageText}`);

    if (adminAccess) {
        await handleAdminDm(sock, senderJid, messageText);
        return;
    }

    // --- Supervisor fallback ---
    let supervisorAccess = false;
    try {
        supervisorAccess = await isSupervisor(phone);
    } catch (err) {
        logger.warn(`[DM] isSupervisor check failed for ${phone}, defaulting to false:`, err.message);
    }

    if (supervisorAccess) {
        await handleSupervisorDm(sock, senderJid, messageText);
        return;
    }

    await handlePublicDm(sock, senderJid, messageText);
}

/**
 * Handle DM from an admin user (listed in ADMIN_NUMBERS)
 */
async function handleAdminDm(sock, jid, messageText) {
    const text = messageText.trim().toLowerCase();

    // Wake word to open admin menu
    if (text === 'admin') {
        await sock.sendMessage(jid, {
            text: `🛡️ *ADMIN MENU*\n\nPlease choose an option:\n\n1️⃣ Fetch Data\n2️⃣ Add Member\n3️⃣ Disable Member\n4️⃣ View Cluster\n\n_Reply with a number (1-4)_`
        });
        return;
    }

    // Handle menu choices
    if (text === '1') {
        await sock.sendMessage(jid, { text: '🔄 *Fetch Data* — Coming soon...' });
        return;
    }
    if (text === '2') {
        await sock.sendMessage(jid, { text: '➕ *Add Member* — Coming soon...' });
        return;
    }
    if (text === '3') {
        await sock.sendMessage(jid, { text: '🚫 *Disable Member* — Coming soon...' });
        return;
    }
    if (text === '4') {
        await sock.sendMessage(jid, { text: '🏘️ *View Cluster* — Coming soon...' });
        return;
    }

    // Unrecognized input — prompt them to use the wake word
    await sock.sendMessage(jid, {
        text: `Type *Admin* to open the admin menu.`
    });
}

/**
 * Handle DM from a supervisor — supervisors get the same admin menu access
 */
async function handleSupervisorDm(sock, jid, messageText) {
    await handleAdminDm(sock, jid, messageText);
}

/**
 * Handle DM from a non-admin user
 */
async function handlePublicDm(sock, jid, messageText) {
    const text = messageText.trim().toLowerCase();

    // TODO: Add public member menu here
    await sock.sendMessage(jid, {
        text: `👋 Hello!\n\nThis bot is used for managing church evangelism reports.\n\nPlease use the group to submit your report. 🙏`
    });
}

/**
 * Send upcoming events list for a specific month
 */
export async function sendUpcomingEvents(sock, jid, monthArg = null) {
    try {
        if (!monthArg) {
            await sock.sendMessage(jid, {
                text: '📅 Please specify a month to view events.\n\n*Example:* `!events March` or `!events 3`'
            });
            return;
        }

        const events = await getUpcomingEvents(15, monthArg);
        if (!events || events.length === 0) {
            const timeFrame = monthArg ? `in ${monthArg.toUpperCase()}` : 'upcoming';
            await sock.sendMessage(jid, { text: `📅 No ${timeFrame} events found.` });
            return;
        }

        const headerTitle = monthArg ? `UPCOMING CHURCH EVENTS — ${monthArg.toUpperCase()}` : 'UPCOMING CHURCH EVENTS';

        let msg = `🗓️ *${headerTitle}*\n`;
        msg += '────────────────────\n\n';

        for (const event of events) {
            msg += `*${event.name}*\n`;
            msg += `🔸 ${formatCalendarDate(event.event_date)}\n\n`;
        }

        msg += '────────────────────\n';
        msg += '_God bless your attendance!_ 🙏';

        await sock.sendMessage(jid, { text: msg });
    } catch (error) {
        await sock.sendMessage(jid, { text: '❌ Could not load events. Please try again later.' });
    }
}

/**
 * Send next single event
 */
export async function sendNextEvent(sock, jid) {
    try {
        const event = await getNextEvent();
        if (!event) {
            await sock.sendMessage(jid, { text: '📅 No upcoming events found.' });
            return;
        }

        let msg = '🗓️ *NEXT UPCOMING EVENT*\n';
        msg += '────────────────────\n\n';
        msg += `*${event.name}*\n`;
        msg += `🔸 ${formatCalendarDate(event.event_date)}\n\n`;
        msg += '────────────────────\n';
        msg += '_God bless your attendance!_ 🙏';

        await sock.sendMessage(jid, { text: msg });
    } catch (error) {
        await sock.sendMessage(jid, { text: '❌ Could not load the next event. Please try again later.' });
    }
}

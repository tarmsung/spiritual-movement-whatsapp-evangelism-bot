import logger from '../utils/logger.js';
import { handleGroupMessage } from './groupMessageHandler.js';
import { extractPhone } from '../utils/helpers.js';
import { getUpcomingEvents, getNextEvent, isAdmin, isSupervisor } from '../database/db.js';
import { formatCalendarDate } from '../utils/helpers.js';
import { lidToPhone, isSavedContact, rememberLidMapping } from './connection.js';
import { handleDmMenu } from './menus/dmMenuHandler.js';


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
    // If the sender is a LID (@lid), resolve it to the real phone JID.
    // Sources, in order of preference:
    //   1. our persisted LID cache (populated from contact syncs and live traffic)
    //   2. msg.key.senderPn — the real phone JID WhatsApp attaches to the message
    //      itself (sender_pn stanza attr). Authoritative and needs no contact sync.
    let senderJid = remoteJid;
    if (senderJid.endsWith('@lid')) {
        const lid = senderJid;                  // keep the original LID as the cache key
        const cached = lidToPhone[lid];
        const senderPn = msg.key.senderPn;

        if (cached) {
            logger.info(`[DM] Resolved LID ${lid} → ${cached} (cache)`);
            senderJid = cached;
        } else if (senderPn) {
            logger.info(`[DM] Resolved LID ${lid} → ${senderPn} (senderPn)`);
            senderJid = senderPn;
            rememberLidMapping(lid, senderPn);  // persist so future messages are instant
        } else {
            logger.warn(`[DM] Unresolved LID: ${lid} — treating as non-admin. If this is an admin, add ${extractPhone(lid)} to ADMIN_LIDS in .env`);
        }
    }

    const phone = extractPhone(senderJid);
    
    // --- Authorization: Parallelize checks for performance ---
    let adminAccess = false;
    let supervisorAccess = false;
    
    try {
        const [isAdminResult, isSupervisorResult] = await Promise.all([
            isAdmin(phone),
            isSupervisor(phone)
        ]);
        adminAccess = isAdminResult;
        supervisorAccess = isSupervisorResult;
    } catch (err) {
        logger.warn(`[DM] Authorization check failed for ${phone}:`, err.message);
    }
    
    logger.info(`[DM] Message from ${phone} (admin: ${adminAccess}, supervisor: ${supervisorAccess}): ${messageText}`);

    // --- Saved Contact Validation ---
    if (!adminAccess && !supervisorAccess) {
        if (!isSavedContact(senderJid)) {
            logger.info(`[DM] Ignoring message from unsaved, non-admin contact: ${phone}`);
            try {
                // Send a brief decline message
                await sock.sendMessage(senderJid, {
                    text: `👋 *Hello!*\n\nSorry, I am currently configured to only interact with saved contacts. Have a blessed day! 🙏`
                });
            } catch (err) {
               logger.error(`[DM] Failed to send decline message to ${phone}: ${err.message}`);
            }
            return;
        }
    }

    const normalizedText = messageText.trim().toLowerCase();

    // Admins/supervisors always go through the DM menu handler
    if (adminAccess || supervisorAccess) {
        await handleDmMenu(sock, msg, senderJid, messageText, adminAccess);
        return;
    }

    // Any user can open the member menu by typing "menu"
    if (normalizedText === 'menu') {
        await handleDmMenu(sock, msg, senderJid, messageText, false);
        return;
    }

    // Check if the user has an active session (mid-menu flow) and route them back
    // This is handled inside handleDmMenu via getUserFormState, so just route them in
    try {
        const { getUserFormState } = await import('../database/db.js');
        const state = await getUserFormState(phone);
        if (state) {
            await handleDmMenu(sock, msg, senderJid, messageText, false);
            return;
        }
    } catch (_) { /* fall through */ }

    await handlePublicDm(sock, senderJid, messageText);
}

/**
 * Handle DM from an admin user (LEGACY - now routed through handleDmMenu)
 */
async function handleAdminDm(sock, jid, messageText) {
    // This is now handled by handleDmMenu -> handleExecutorMenu
}

/**
 * Handle DM from a supervisor (LEGACY - now routed through handleDmMenu)
 */
async function handleSupervisorDm(sock, jid, messageText) {
    // This is now handled by handleDmMenu -> handleExecutorMenu
}

/**
 * Handle DM from a non-admin, non-menu user — prompt them to type "Menu"
 */
async function handlePublicDm(sock, jid, messageText) {
    await sock.sendMessage(jid, {
        text: `👋 *Hello!*\n\nWelcome to *Spiritual Movement Church* 🙏\n\nType *Menu* to see what's available.`
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

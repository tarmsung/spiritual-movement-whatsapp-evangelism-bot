import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import logger from '../utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { handleMessageDelete } from './messageDeleteHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const authFolder = join(__dirname, '../../auth_info_baileys');
const lidCacheFile = join(authFolder, 'lid_cache.json');
const savedContactsFile = join(authFolder, 'saved_contacts.json');

// Lightweight LID → phone JID mapping (persisted to file)
export const lidToPhone = {};
// Saved contacts cache (persisted to file)
export const savedContacts = {};

// Load from file on startup
try {
    if (fs.existsSync(lidCacheFile)) {
        Object.assign(lidToPhone, JSON.parse(fs.readFileSync(lidCacheFile, 'utf8')));
        logger.info(`LID cache loaded (${Object.keys(lidToPhone).length} entries)`);
    }
} catch (e) {
    logger.warn('LID cache load failed, starting fresh:', e.message);
}

try {
    if (fs.existsSync(savedContactsFile)) {
        Object.assign(savedContacts, JSON.parse(fs.readFileSync(savedContactsFile, 'utf8')));
        logger.info(`Saved contacts cache loaded (${Object.keys(savedContacts).length} entries)`);
    }
} catch (e) {
    logger.warn('Saved contacts cache load failed, starting fresh:', e.message);
}

function saveLidCache() {
    try { fs.writeFileSync(lidCacheFile, JSON.stringify(lidToPhone, null, 2)); } catch (e) { /* ignore */ }
}

function saveSavedContacts() {
    try { fs.writeFileSync(savedContactsFile, JSON.stringify(savedContacts, null, 2)); } catch (e) { /* ignore */ }
}

/**
 * Learn a LID → phone JID mapping and persist it to disk.
 * Always use this instead of mutating lidToPhone directly, otherwise the
 * mapping is lost on restart.
 * @param {string} lid - The @lid JID (cache key)
 * @param {string} phoneJid - The real phone JID (@s.whatsapp.net)
 */
export function rememberLidMapping(lid, phoneJid) {
    if (!lid || !phoneJid) return;
    if (!lid.endsWith('@lid')) return;          // guard against phone→phone self-mappings
    if (lidToPhone[lid] === phoneJid) return;   // already known, skip the disk write
    lidToPhone[lid] = phoneJid;
    saveLidCache();
    logger.info(`[CONNECTION] Learned LID mapping ${lid} → ${phoneJid}`);
}

/**
 * Harvest LID → phone mappings that WhatsApp attaches to incoming message keys.
 * DMs carry senderLid/senderPn; group messages carry participantLid/participantPn
 * (from the sender_pn / participant_pn stanza attributes). This warms the cache
 * from live traffic, so resolution no longer depends on a contact sync landing.
 * @param {Object} key - msg.key
 */
function captureLidFromKey(key) {
    if (!key) return;

    // DM: remoteJid is the LID when the chat is LID-addressed
    const dmLid = key.senderLid || (key.remoteJid?.endsWith('@lid') ? key.remoteJid : null);
    rememberLidMapping(dmLid, key.senderPn);

    // Group: participant is the LID when the group is LID-addressed
    const groupLid = key.participantLid || (key.participant?.endsWith('@lid') ? key.participant : null);
    rememberLidMapping(groupLid, key.participantPn);
}

/**
 * Check if a JID is saved in our contact list
 * @param {string} jid 
 * @returns {boolean}
 */
export function isSavedContact(jid) {
    if (!jid) return false;
    const phone = jid.split('@')[0];
    return !!savedContacts[phone];
}


let sock = null;

// ─── Connection watchdog ──────────────────────────────────────────────────
// Baileys' 'close' event does not always fire when the underlying WebSocket
// dies silently (dropped TCP connection, VPS NAT/firewall timeout, network
// blip). When that happens the socket just hangs forever with no error and
// no reconnect — the process looks "online" in PM2 but never receives
// another message. This watchdog periodically probes the live connection
// with a cheap presence update; if it doesn't complete in time, we force-close
// the socket ourselves so the existing 'close' handler's reconnect logic runs.
let watchdogInterval = null;
const WATCHDOG_CHECK_INTERVAL_MS = 3 * 60 * 1000; // probe every 3 minutes
const WATCHDOG_PROBE_TIMEOUT_MS = 20 * 1000;       // consider dead if no response in 20s

function startWatchdog(currentSock, messageHandler) {
    stopWatchdog();
    watchdogInterval = setInterval(async () => {
        try {
            await Promise.race([
                currentSock.sendPresenceUpdate('available'),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('watchdog probe timed out')), WATCHDOG_PROBE_TIMEOUT_MS)
                )
            ]);
        } catch (err) {
            logger.error(`[WATCHDOG] Connection appears dead (${err.message}) — forcing reconnect.`);
            stopWatchdog();
            try { currentSock.ws?.close(); } catch (_) { /* ignore */ }
            try { currentSock.end(new Error('watchdog forced close')); } catch (_) { /* ignore */ }
            // Safety net: if forcing the socket closed doesn't trigger Baileys'
            // own 'close' → reconnect path within 10s, restart directly.
            setTimeout(() => {
                if (sock === currentSock) {
                    logger.warn('[WATCHDOG] No reconnect observed after forced close — restarting connection directly.');
                    startWhatsAppConnection(messageHandler);
                }
            }, 10000);
        }
    }, WATCHDOG_CHECK_INTERVAL_MS);
}

function stopWatchdog() {
    if (watchdogInterval) {
        clearInterval(watchdogInterval);
        watchdogInterval = null;
    }
}

// Deduplication: track processed message IDs to prevent retry-replay loops
// Baileys sends retry receipts when decryption fails, causing the same message
// to be delivered multiple times — this cache prevents duplicate bot responses.
const processedMsgIds = new Set();
const PROCESSED_MSG_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Stale message threshold: ignore messages older than this on delivery
const STALE_MSG_THRESHOLD_MS = 60 * 1000; // 60 seconds

/**
 * Start WhatsApp connection
 * @param {Function} messageHandler - Function to handle incoming messages
 * @returns {Promise<Object>} WhatsApp socket instance
 */
export async function startWhatsAppConnection(messageHandler) {
    const authFolder = join(__dirname, '../../auth_info_baileys');

    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    // Get latest version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    // Create socket
    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: logger.child({ module: 'baileys' }),
        browser: ['Evangelism Bot', 'Chrome', '1.0.0']
    });

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds);

    // Build LID → phone mapping from contact syncs
    sock.ev.on('contacts.upsert', (contacts) => {
        let changed = false;
        let authChanged = false;
        for (const c of contacts) {
            if (c.lid && c.id) {
                lidToPhone[c.lid] = c.id;
                changed = true;
            }
            if (c.id && c.name) {
                savedContacts[c.id.split('@')[0]] = c.name;
                authChanged = true;
            }
        }
        if (changed) saveLidCache();
        if (authChanged) saveSavedContacts();
    });
    sock.ev.on('contacts.update', (updates) => {
        let changed = false;
        let authChanged = false;
        for (const c of updates) {
            if (c.lid && c.id) {
                lidToPhone[c.lid] = c.id;
                changed = true;
            }
            if (c.id && c.name) {
                savedContacts[c.id.split('@')[0]] = c.name;
                authChanged = true;
            }
        }
        if (changed) saveLidCache();
        if (authChanged) saveSavedContacts();
    });

    // Bulk history sync (Initial load on link/restore)
    sock.ev.on('messaging-history.set', ({ contacts }) => {
        if (!contacts || contacts.length === 0) return;

        let changed = false;
        for (const c of contacts) {
            if (c.id && c.name) {
                savedContacts[c.id.split('@')[0]] = c.name;
                changed = true;
            }
        }
        if (changed) {
            logger.info(`[CONNECTION] Loaded bulk contacts from history sync.`);
            saveSavedContacts();
        }
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Display QR code
        if (qr) {
            logger.info('Scan this QR code with your WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        // Handle connection states
        if (connection === 'close') {
            stopWatchdog();

            const statusCode = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode
                : undefined;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            logger.warn(
                `Connection closed — statusCode=${statusCode} reason=${DisconnectReason[statusCode] || 'unknown'} shouldReconnect=${shouldReconnect}`,
                lastDisconnect?.error?.message || lastDisconnect?.error
            );

            if (shouldReconnect) {
                logger.info('Reconnecting...');
                setTimeout(() => startWhatsAppConnection(messageHandler), 5000);
            } else {
                logger.error('Logged out — delete auth_info_baileys/ and re-scan the QR code to relink.');
            }
        } else if (connection === 'open') {
            logger.info('WhatsApp connection established successfully! ✅');
            startWatchdog(sock, messageHandler);
        }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        logger.info(`[CONNECTION] messages.upsert event - type: ${type}, count: ${messages.length}`);
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                const remoteJid = msg.key.remoteJid;
                const isGroup = remoteJid?.endsWith('@g.us');

                // Learn any LID → phone mapping this message carries, before any
                // early-continue below can skip it.
                captureLidFromKey(msg.key);

                // Check for "Delete for Everyone" — Baileys delivers this as a protocolMessage type 0 (REVOKE)
                if (msg.message?.protocolMessage?.type === 0 && isGroup) {
                    const revokedKey = msg.message.protocolMessage.key;
                    if (revokedKey) {
                        logger.info(`[CONNECTION] Protocol REVOKE detected — revoking key: ${JSON.stringify(revokedKey)}`);
                        // Use the participant from the outer message (who deleted it)
                        revokedKey.remoteJid = revokedKey.remoteJid || remoteJid;
                        await handleMessageDelete(sock, [revokedKey]);
                    }
                    continue;
                }

                // Ignore messages from self
                if (msg.key.fromMe) {
                    logger.debug(`[CONNECTION] Ignoring message from self (fromMe=true)`);
                    continue;
                }

                // Deduplication check — skip if this message ID was already processed
                const msgId = msg.key.id;
                if (msgId && processedMsgIds.has(msgId)) {
                    logger.warn(`[CONNECTION] Duplicate message detected (id: ${msgId}), skipping retry replay.`);
                    continue;
                }

                // Stale message check — skip messages older than 60s (e.g. queued while bot was offline)
                const msgTimestamp = msg.messageTimestamp
                    ? Number(msg.messageTimestamp) * 1000
                    : null;
                if (msgTimestamp && (Date.now() - msgTimestamp) > STALE_MSG_THRESHOLD_MS) {
                    logger.warn(`[CONNECTION] Stale message skipped (id: ${msgId}, age: ${Math.round((Date.now() - msgTimestamp) / 1000)}s)`);
                    continue;
                }

                logger.info(`[CONNECTION] Message from: ${remoteJid} (group: ${isGroup})`);

                // Extract message text from different message types
                let messageText = '';

                // Regular text message
                if (msg.message?.conversation) {
                    messageText = msg.message.conversation;
                }
                // Extended text message
                else if (msg.message?.extendedTextMessage?.text) {
                    messageText = msg.message.extendedTextMessage.text;
                }
                // Button response
                else if (msg.message?.buttonsResponseMessage) {
                    messageText = msg.message.buttonsResponseMessage.selectedButtonId;
                }
                // List response
                else if (msg.message?.listResponseMessage) {
                    messageText = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
                }
                // Template button response
                else if (msg.message?.templateButtonReplyMessage) {
                    messageText = msg.message.templateButtonReplyMessage.selectedId;
                }

                // Ignore if no text extracted
                if (!messageText) {
                    logger.info(`[CONNECTION] No text extracted from message, skipping.`);
                    continue;
                }

                logger.info(`[CONNECTION] Extracted text (first 50 chars): ${messageText.substring(0, 50)}`);

                // Mark message as processed BEFORE handling to prevent race conditions
                if (msgId) {
                    processedMsgIds.add(msgId);
                    // Auto-expire the ID from the cache after TTL to prevent memory growth
                    setTimeout(() => processedMsgIds.delete(msgId), PROCESSED_MSG_TTL_MS);
                }

                // Process message
                await messageHandler(sock, msg, messageText);
            } catch (error) {
                logger.error('Error processing message:', error);
            }
        }
    });


    // Handle message deletions (reporter deletes their own report message)
    sock.ev.on('messages.delete', async ({ keys }) => {
        try {
            if (keys && keys.length > 0) {
                logger.info(`[CONNECTION] messages.delete event - ${keys.length} message(s) deleted`);
                await handleMessageDelete(sock, keys);
            }
        } catch (error) {
            logger.error('[CONNECTION] Error handling message deletion:', error);
        }
    });

    return sock;
}

/**
 * Send text message
 * @param {string} jid - WhatsApp JID (phone@s.whatsapp.net or group@g.us)
 * @param {string} text - Message text
 */
export async function sendMessage(jid, text) {
    if (!sock) {
        throw new Error('WhatsApp not connected');
    }

    try {
        await sock.sendMessage(jid, { text });
        logger.debug(`Message sent to ${jid}`);
    } catch (error) {
        logger.error(`Failed to send message to ${jid}:`, error);
        throw error;
    }
}

/**
 * Get WhatsApp socket instance
 * @returns {Object|null}
 */
export function getSocket() {
    return sock;
}

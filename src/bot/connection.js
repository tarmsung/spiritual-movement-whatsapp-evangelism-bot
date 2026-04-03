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
        printQRInTerminal: false,
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
            const shouldReconnect =
                (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                    : true;

            logger.warn('Connection closed', { shouldReconnect });

            if (shouldReconnect) {
                logger.info('Reconnecting...');
                setTimeout(() => startWhatsAppConnection(messageHandler), 5000);
            }
        } else if (connection === 'open') {
            logger.info('WhatsApp connection established successfully! ✅');
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

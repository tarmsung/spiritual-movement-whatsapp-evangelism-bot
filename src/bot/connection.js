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
import { handleMessageDelete } from './messageDeleteHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let sock = null;

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

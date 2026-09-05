import logger from './utils/logger.js';
import { initializeDatabase } from './database/db.js';
import { startWhatsAppConnection } from './bot/connection.js';
import { handleMessage } from './bot/messageHandler.js';
import { startScheduler } from './services/scheduler.js';
import config from './config/config.js';

/**
 * Main application entry point
 */
async function main() {
    try {
        logger.info('╔═══════════════════════════════════════════╗');
        logger.info('║   WhatsApp Evangelism Reporter Bot       ║');
        logger.info('╚═══════════════════════════════════════════╝');
        logger.info('');
        logger.info(`Church: ${config.churchName}`);
        logger.info(`Wake phrase: ${config.wakePhrase}`);
        logger.info('');

        // Initialize database
        logger.info('Initializing database...');
        await initializeDatabase();
        logger.info('✓ Database ready');

        // Start WhatsApp connection
        logger.info('Starting WhatsApp connection...');
        logger.info('Please scan the QR code with your WhatsApp');
        await startWhatsAppConnection(handleMessage);

        // Start scheduler for monthly reports
        logger.info('Starting monthly report scheduler...');
        startScheduler();
        logger.info('✓ Scheduler active');

        logger.info('');
        logger.info('✓ Bot is running and ready to receive messages!');
        logger.info('');
        logger.info(`Send "${config.wakePhrase}" to the bot in a private chat to start.`);
        logger.info('');

    } catch (error) {
        logger.error('Fatal error starting bot:', error);
        process.exit(1);
    }
}

// Graceful shutdown — Baileys' useMultiFileAuthState persists creds/prekeys/
// sessions with async fs writes (see its own reference to
// https://github.com/WhiskeySockets/Baileys/issues/794). Calling process.exit()
// immediately on signal can kill the process mid-write, leaving auth_info_baileys/
// out of sync with what WhatsApp's server already recorded — this reproduced in
// production as "PreKeyError: Invalid PreKey ID" immediately after nearly every
// PM2 restart, cascading into "Bad MAC" / "No matching sessions found" for
// whichever contact was mid-handshake at that moment. Waiting briefly before
// exiting gives any in-flight write time to flush. PM2 must be configured with a
// kill_timeout longer than this delay (see ecosystem.config.json) or it will
// SIGKILL before the delay completes, defeating the point entirely.
const SHUTDOWN_GRACE_MS = 2000;
async function gracefulShutdown(signal) {
    logger.info('');
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await new Promise((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_MS));
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
main();

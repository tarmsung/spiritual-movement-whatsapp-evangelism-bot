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

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('');
    logger.info('Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('');
    logger.info('Shutting down gracefully...');
    process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
main();

import { saveUserFormState, clearUserFormState } from '../../database/db.js';
import { extractPhone } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { sendUpcomingEvents, sendNextEvent } from '../messageHandler.js';
import { MENU_STEPS, CANCEL_MESSAGE } from '../../utils/constants.js';

const NAV_FOOTER = '\n\n────────────────────\n_Type *Menu* to go back or *Cancel* to exit._';

/**
 * Handle Member Menu logic.
 * Triggered when any user DMs the bot with "Menu".
 *
 * @param {Object} sock - WhatsApp socket
 * @param {string} userJid - User's JID
 * @param {string} messageText - The message sent
 * @param {number} currentStep - The current state step (Integer)
 * @param {Object} formData - Any data being carried through the state
 */
export async function handleMemberMenu(sock, userJid, messageText, currentStep, formData) {
    const phone = extractPhone(userJid);
    const normalizedMessage = messageText.trim().toLowerCase();

    try {
        // Global cancel
        if (normalizedMessage === 'cancel' || normalizedMessage === 'exit') {
            await clearUserFormState(phone);
            await sock.sendMessage(userJid, { text: CANCEL_MESSAGE });
            return;
        }

        switch (currentStep) {

            // ── SHOW MAIN MENU ────────────────────────────────────────────────
            case MENU_STEPS.MEMBER_MAIN:
                await sendMemberMainMenu(sock, userJid);
                await saveUserFormState(phone, MENU_STEPS.MEMBER_WAIT, formData);
                break;

            // ── HANDLE CHOICE ─────────────────────────────────────────────────
            case MENU_STEPS.MEMBER_WAIT:
                switch (normalizedMessage) {

                    case '1': // 🗓️ Events
                        await sendUpcomingEvents(sock, userJid, getCurrentMonth());
                        await sock.sendMessage(userJid, { text: NAV_FOOTER });
                        await clearUserFormState(phone);
                        break;

                    case '2': // 📥 Download Evangelism Reports
                        await sock.sendMessage(userJid, {
                            text: `📥 *Download Evangelism Reports*\n\n_This feature is coming soon!_\n\nYou will be able to download monthly evangelism reports directly from this menu.${NAV_FOOTER}`
                        });
                        await clearUserFormState(phone);
                        break;

                    case '3': // 📅 Calendar
                        await sendNextEvent(sock, userJid);
                        await sock.sendMessage(userJid, { text: NAV_FOOTER });
                        await clearUserFormState(phone);
                        break;

                    case '4': // 📰 Newspaper Articles
                        await sock.sendMessage(userJid, {
                            text: `📰 *Newspaper Articles*\n\n_This feature is coming soon!_\n\nYou will be able to read the latest church newsletter and bulletin articles here.${NAV_FOOTER}`
                        });
                        await clearUserFormState(phone);
                        break;

                    case '5': // 📚 Library
                        await sock.sendMessage(userJid, {
                            text: `📚 *Library*\n\n_This feature is coming soon!_\n\nYou will be able to browse and download sermons, devotionals, and other resources.${NAV_FOOTER}`
                        });
                        await clearUserFormState(phone);
                        break;

                    case '6': // 💰 Make Payment
                        await sock.sendMessage(userJid, {
                            text: `💰 *Make Payment*\n\n_This feature is coming soon!_\n\nYou will be able to make church contributions and tithes directly through this menu.${NAV_FOOTER}`
                        });
                        await clearUserFormState(phone);
                        break;

                    default:
                        await sock.sendMessage(userJid, {
                            text: `❌ Invalid choice. Please reply with a number from *1 to 6*.\n\nType *Menu* to see the options again.`
                        });
                        break;
                }
                break;

            // ── DEFAULT ───────────────────────────────────────────────────────
            default:
                await clearUserFormState(phone);
                await sendMemberMainMenu(sock, userJid);
                await saveUserFormState(phone, MENU_STEPS.MEMBER_WAIT, {});
                break;
        }
    } catch (error) {
        logger.error(`Error in Member Menu for ${phone}:`, error);
        // Reply and cleanup are independently guarded — see handleDmMenu for why.
        try {
            await sock.sendMessage(userJid, { text: '❌ An error occurred. Please type *Menu* to try again.' });
        } catch (sendError) {
            logger.error(`Failed to send error reply to ${phone}:`, sendError);
        }
        try {
            await clearUserFormState(phone);
        } catch (clearError) {
            logger.error(`Failed to clear form state for ${phone} during error recovery:`, clearError);
        }
    }
}

/**
 * Send the main Member menu with 6 options
 */
async function sendMemberMainMenu(sock, userJid) {
    const menuText =
        `🙏 *SPIRITUAL MOVEMENT CHURCH*\n` +
        `────────────────────\n\n` +
        `Welcome! Please choose an option:\n\n` +
        `1️⃣  🗓️  Events\n` +
        `2️⃣  📥  Download Evangelism Reports\n` +
        `3️⃣  📅  Calendar\n` +
        `4️⃣  📰  Newspaper Articles\n` +
        `5️⃣  📚  Library\n` +
        `6️⃣  💰  Make Payment\n\n` +
        `────────────────────\n` +
        `_Reply with a number (1–6)._\n` +
        `_Type "cancel" to close._`;

    await sock.sendMessage(userJid, { text: menuText });
}

/**
 * Get the current month name (e.g. "March") for event filtering
 */
function getCurrentMonth() {
    return new Date().toLocaleString('en-US', { month: 'long' });
}

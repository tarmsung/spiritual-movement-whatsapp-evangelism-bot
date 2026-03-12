import { saveUserFormState, clearUserFormState } from '../../database/db.js';
import logger from '../../utils/logger.js';
import { sendUpcomingEvents, sendNextEvent } from '../messageHandler.js';
import { startTestReport } from '../testReportHandler.js';

/**
 * Handle Member Menu logic
 * @param {Object} sock - WhatsApp socket
 * @param {string} userJid - User's JID
 * @param {string} messageText - The message sent
 * @param {string} currentStep - The current state step
 * @param {Object} formData - Any data being carried through the state
 */
export async function handleMemberMenu(sock, userJid, messageText, currentStep, formData) {
    const phone = extractPhone(userJid);
    const normalizedMessage = messageText.trim().toLowerCase();

    try {
        switch (currentStep) {
            case 'member_menu_main':
                await sendMemberMainMenu(sock, userJid);
                await saveUserFormState(phone, 'member_menu_wait_for_choice', formData);
                break;

            case 'member_menu_wait_for_choice':
                switch (normalizedMessage) {
                    case '1':
                        await sendUpcomingEvents(sock, userJid);
                        await clearUserFormState(phone);
                        break;
                    case '2':
                        await sendNextEvent(sock, userJid);
                        await clearUserFormState(phone);
                        break;
                    case '3':
                        await startTestReport(sock, userJid);
                        // startTestReport manages its own state, so we just clear the menu state
                        await clearUserFormState(phone);
                        break;
                    default:
                        await sock.sendMessage(userJid, { text: '❌ Invalid choice. Please reply with 1, 2, or 3.' });
                        break;
                }
                break;

            default:
                await clearUserFormState(phone);
                await sock.sendMessage(userJid, { text: '🔄 Session reset. Please send any message to start again.' });
                break;
        }
    } catch (error) {
        logger.error(`Error in Member Menu for ${phone}:`, error);
        await clearUserFormState(phone);
        await sock.sendMessage(userJid, { text: '❌ An error occurred. Session has been reset.' });
    }
}

/**
 * Send the main Member menu
 */
async function sendMemberMainMenu(sock, userJid) {
    let menuText = `🙏 *CHURCH MEMBER MENU*\n`;
    menuText += `────────────────────\n\n`;
    menuText += `Please reply with the number of your choice:\n\n`;
    menuText += `1️⃣ View Upcoming Events\n`;
    menuText += `2️⃣ View Next Event\n`;
    menuText += `3️⃣ Test Report Menu\n\n`;
    menuText += `_Reply "cancel" at any time to exit._`;

    await sock.sendMessage(userJid, { text: menuText });
}

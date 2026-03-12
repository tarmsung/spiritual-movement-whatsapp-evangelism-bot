import { saveUserFormState, clearUserFormState } from '../../database/db.js';
import { extractPhone } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

/**
 * Handle Executor Menu logic
 * @param {Object} sock - WhatsApp socket
 * @param {string} userJid - User's JID
 * @param {string} messageText - The message sent
 * @param {string} currentStep - The current state step
 * @param {Object} formData - Any data being carried through the state
 */
export async function handleExecutorMenu(sock, userJid, messageText, currentStep, formData) {
    const phone = extractPhone(userJid);
    const normalizedMessage = messageText.trim().toLowerCase();

    try {
        switch (currentStep) {
            case 'executor_menu_main':
                await sendExecutorMainMenu(sock, userJid);
                await saveUserFormState(phone, 'executor_menu_wait_for_choice', formData);
                break;

            case 'executor_menu_wait_for_choice':
                switch (normalizedMessage) {
                    case '1':
                        await sock.sendMessage(userJid, { text: '📊 *Fetch Data* functionality coming soon!' });
                        await clearUserFormState(phone);
                        break;
                    case '2':
                        await sock.sendMessage(userJid, { text: '➕ *Add Member* functionality coming soon!' });
                        await clearUserFormState(phone);
                        break;
                    case '3':
                        await sock.sendMessage(userJid, { text: '🚫 *Disable Member* functionality coming soon!' });
                        await clearUserFormState(phone);
                        break;
                    case '4':
                        await sock.sendMessage(userJid, { text: '⛪ *View Cluster* functionality coming soon!' });
                        await clearUserFormState(phone);
                        break;
                    default:
                        await sock.sendMessage(userJid, { text: '❌ Invalid choice. Please reply with 1, 2, 3, or 4.' });
                        break;
                }
                break;

            default:
                await clearUserFormState(phone);
                await sock.sendMessage(userJid, { text: '🔄 Session reset. Please type *Admin* to start again.' });
                break;
        }
    } catch (error) {
        logger.error(`Error in Executor Menu for ${phone}:`, error);
        await clearUserFormState(phone);
        await sock.sendMessage(userJid, { text: '❌ An error occurred. Session has been reset.' });
    }
}

/**
 * Send the main Executor menu
 */
async function sendExecutorMainMenu(sock, userJid) {
    let menuText = `👑 *EXECUTOR MENU*\n`;
    menuText += `────────────────────\n\n`;
    menuText += `Please reply with the number of your choice:\n\n`;
    menuText += `1️⃣ Fetch Data\n`;
    menuText += `2️⃣ Add Member\n`;
    menuText += `3️⃣ Disable Member\n`;
    menuText += `4️⃣ View Cluster\n\n`;
    menuText += `_Reply "cancel" at any time to exit._`;

    await sock.sendMessage(userJid, { text: menuText });
}

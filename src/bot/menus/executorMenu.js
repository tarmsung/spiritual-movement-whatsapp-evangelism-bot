import { saveUserFormState, clearUserFormState, getAllAssemblies } from '../../database/db.js';
import { extractPhone } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { MENU_STEPS } from '../../utils/constants.js';
import { getStatesReport, getReportsSummary } from '../../services/adminReportService.js';

/**
 * Handle Executor Menu logic
 * @param {Object} sock - WhatsApp socket
 * @param {string} userJid - User's JID
 * @param {string} messageText - The message sent
 * @param {number} currentStep - The current state step (Integer)
 * @param {Object} formData - Any data being carried through the state
 */
export async function handleExecutorMenu(sock, userJid, messageText, currentStep, formData) {
    const phone = extractPhone(userJid);
    const normalizedMessage = messageText.trim().toLowerCase();

    try {
        switch (currentStep) {
            case MENU_STEPS.EXECUTOR_MAIN:
                await sendExecutorMainMenu(sock, userJid);
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_WAIT, formData);
                break;

            case MENU_STEPS.EXECUTOR_WAIT:
                switch (normalizedMessage) {
                    case '1':
                        await sendFetchDataSubMenu(sock, userJid);
                        await saveUserFormState(phone, MENU_STEPS.EXECUTOR_FETCH_DATA, formData);
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

            case MENU_STEPS.EXECUTOR_FETCH_DATA:
                if (normalizedMessage === '1') {
                    await sendClusterSelection(sock, userJid, 'Get States');
                    await saveUserFormState(phone, MENU_STEPS.EXECUTOR_FETCH_DATA_GET_STATES_CLUSTER, formData);
                } else if (normalizedMessage === '2') {
                    await sendClusterSelection(sock, userJid, 'Reports Summary');
                    await saveUserFormState(phone, MENU_STEPS.EXECUTOR_FETCH_DATA_REPORTS_SUMMARY_CLUSTER, formData);
                } else {
                    await sock.sendMessage(userJid, { text: '❌ Invalid choice. Please reply with 1 or 2.' });
                }
                break;

            case MENU_STEPS.EXECUTOR_FETCH_DATA_GET_STATES_CLUSTER:
            case MENU_STEPS.EXECUTOR_FETCH_DATA_REPORTS_SUMMARY_CLUSTER:
                const assemblies = await getAllAssemblies();
                const choice = parseInt(normalizedMessage);
                
                if (isNaN(choice) || choice < 1 || choice > assemblies.length) {
                    await sock.sendMessage(userJid, { text: `❌ Invalid choice. Please reply with a number between 1 and ${assemblies.length}.` });
                    return;
                }

                const selectedAssembly = assemblies[choice - 1];
                await sock.sendMessage(userJid, { text: `🔄 Generating report for *${selectedAssembly.name}*...` });

                // Date range: Current Month
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

                let report;
                if (currentStep === MENU_STEPS.EXECUTOR_FETCH_DATA_GET_STATES_CLUSTER) {
                    report = await getStatesReport(selectedAssembly, startOfMonth, endOfMonth);
                } else {
                    report = await getReportsSummary(selectedAssembly, startOfMonth, endOfMonth);
                }

                await sock.sendMessage(userJid, { text: report });
                await clearUserFormState(phone);
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

/**
 * Send the Fetch Data sub-menu
 */
async function sendFetchDataSubMenu(sock, userJid) {
    let menuText = `🔄 *FETCH DATA*\n`;
    menuText += `────────────────────\n\n`;
    menuText += `Please choose an option:\n\n`;
    menuText += `1️⃣ Get states\n`;
    menuText += `2️⃣ Reports summary\n\n`;
    menuText += `_Reply with 1 or 2._`;

    await sock.sendMessage(userJid, { text: menuText });
}

/**
 * Send cluster selection list
 */
async function sendClusterSelection(sock, userJid, reportType) {
    const assemblies = await getAllAssemblies();
    
    let menuText = `📋 *SELECT CLUSTER* (${reportType})\n`;
    menuText += `────────────────────\n\n`;
    menuText += `Choose the cluster you want to get the states from:\n\n`;
    
    assemblies.forEach((a, index) => {
        menuText += `${index + 1}. ${a.name}\n`;
    });
    
    menuText += `\n_Reply with the cluster number (1-${assemblies.length})._`;

    await sock.sendMessage(userJid, { text: menuText });
}

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
                const clusterChoice = parseInt(normalizedMessage);
                
                if (isNaN(clusterChoice) || clusterChoice < 1 || clusterChoice > assemblies.length) {
                    await sock.sendMessage(userJid, { text: `❌ Invalid choice. Please reply with a number between 1 and ${assemblies.length}.` });
                    return;
                }

                const selectedAssembly = assemblies[clusterChoice - 1];
                
                // Save selection and transition to month selection
                formData.assemblyId = selectedAssembly.id;
                formData.assemblyName = selectedAssembly.name;
                formData.reportType = (currentStep === MENU_STEPS.EXECUTOR_FETCH_DATA_GET_STATES_CLUSTER) ? 'states' : 'summary';
                
                await sendMonthSelection(sock, userJid);
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_FETCH_DATA_MONTH, formData);
                break;

            case MENU_STEPS.EXECUTOR_FETCH_DATA_MONTH:
                const monthChoice = parseInt(normalizedMessage);
                const months = getRecentMonths(6);
                
                if (isNaN(monthChoice) || monthChoice < 1 || monthChoice > months.length) {
                    await sock.sendMessage(userJid, { text: `❌ Invalid choice. Please reply with a number between 1 and ${months.length}.` });
                    return;
                }

                const selectedMonth = months[monthChoice - 1];
                await sock.sendMessage(userJid, { text: `🔄 Generating report for *${formData.assemblyName}* (${selectedMonth.label})...` });

                const start = selectedMonth.start;
                const end = selectedMonth.end;
                const assemblyObj = { id: formData.assemblyId, name: formData.assemblyName };

                let report;
                if (formData.reportType === 'states') {
                    report = await getStatesReport(assemblyObj, start, end);
                } else {
                    report = await getReportsSummary(assemblyObj, start, end);
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

/**
 * Send the month selection menu
 */
async function sendMonthSelection(sock, userJid) {
    const months = getRecentMonths(6);
    
    let menuText = `📅 *SELECT MONTH*\n`;
    menuText += `────────────────────\n\n`;
    menuText += `Please choose the month you want to fetch the data from:\n\n`;
    
    months.forEach((m, index) => {
        menuText += `${index + 1}. ${m.label}\n`;
    });
    
    menuText += `\n_Reply with the number (1-${months.length})._`;

    await sock.sendMessage(userJid, { text: menuText });
}

/**
 * Generate a list of recent months (cycles)
 * @param {number} count - Number of months to return
 */
function getRecentMonths(count) {
    const months = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
        // Calculate the target month and year
        let year = now.getFullYear();
        let month = now.getMonth() - i;
        
        // Handle negative month values for previous years
        while (month < 0) {
            month += 12;
            year--;
        }
        
        // Start of the month: 1st
        const startDate = new Date(year, month, 1);
        // End of the month: 0th day of the NEXT month gives the last day of THIS month
        const endDate = new Date(year, month + 1, 0);
        
        const label = endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const formatStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        months.push({
            label: label,
            start: formatStr(year, month, 1),
            end: formatStr(year, month, endDate.getDate())
        });
    }
    
    return months;
}

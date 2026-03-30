import {
    saveUserFormState,
    clearUserFormState,
    getAllAssemblies,
    getMemberById,
    getNextMemberId,
    addMember,
    disableMember,
    getMembersByCluster
} from '../../database/db.js';
import { extractPhone } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { MENU_STEPS } from '../../utils/constants.js';
import { getStatesReport, getReportsSummary } from '../../services/adminReportService.js';

const ADMIN_NAV_FOOTER = '\n\n────────────────────\n_Type *Admin* to go back or *Cancel* to exit._';

/**
 * Handle Executor Menu logic
 */
export async function handleExecutorMenu(sock, userJid, messageText, currentStep, formData) {
    const phone = extractPhone(userJid);
    const msg = messageText.trim();
    const normalizedMessage = msg.toLowerCase();

    // Global cancel
    if (normalizedMessage === 'cancel') {
        await clearUserFormState(phone);
        await sock.sendMessage(userJid, { text: '❌ Session cancelled. Type *Admin* to return to the menu.' });
        return;
    }

    try {
        switch (currentStep) {

            // ── MAIN MENU ─────────────────────────────────────────────────────
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
                        await sock.sendMessage(userJid, { text: '👤 *ADD MEMBER*\n────────────────────\n\n⚧️ Is the new member *Male* or *Female*?\n\nReply with *Male* or *Female*.\n\n_Type "cancel" anytime to exit._' });
                        await saveUserFormState(phone, MENU_STEPS.EXECUTOR_ADD_MEMBER_GENDER, {});
                        break;
                    case '3':
                        await sock.sendMessage(userJid, { text: '🚫 *DISABLE MEMBER*\n────────────────────\n\nEnter the *Member ID* of the member you want to disable:\n\n_Type "cancel" to exit._' });
                        await saveUserFormState(phone, MENU_STEPS.EXECUTOR_DISABLE_MEMBER_ID, {});
                        break;
                    case '4':
                        await sendClusterSelection(sock, userJid, 'View Cluster');
                        await saveUserFormState(phone, MENU_STEPS.EXECUTOR_VIEW_CLUSTER_SELECT, formData);
                        break;
                    default:
                        await sock.sendMessage(userJid, { text: '❌ Invalid choice. Please reply with 1, 2, 3, or 4.' });
                        break;
                }
                break;

            // ── FETCH DATA ────────────────────────────────────────────────────
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
            case MENU_STEPS.EXECUTOR_FETCH_DATA_REPORTS_SUMMARY_CLUSTER: {
                const assemblies = await getAllAssemblies();
                const clusterChoice = parseInt(normalizedMessage);
                if (isNaN(clusterChoice) || clusterChoice < 1 || clusterChoice > assemblies.length) {
                    await sock.sendMessage(userJid, { text: `❌ Invalid choice. Please reply with a number between 1 and ${assemblies.length}.` });
                    return;
                }
                const selectedAssembly = assemblies[clusterChoice - 1];
                formData.assemblyId = selectedAssembly.id;
                formData.assemblyName = selectedAssembly.name;
                formData.reportType = (currentStep === MENU_STEPS.EXECUTOR_FETCH_DATA_GET_STATES_CLUSTER) ? 'states' : 'summary';
                await sendMonthSelection(sock, userJid);
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_FETCH_DATA_MONTH, formData);
                break;
            }

            case MENU_STEPS.EXECUTOR_FETCH_DATA_MONTH: {
                const monthChoice = parseInt(normalizedMessage);
                const months = getRecentMonths(6);
                if (isNaN(monthChoice) || monthChoice < 1 || monthChoice > months.length) {
                    await sock.sendMessage(userJid, { text: `❌ Invalid choice. Please reply with a number between 1 and ${months.length}.` });
                    return;
                }
                const selectedMonth = months[monthChoice - 1];
                await sock.sendMessage(userJid, { text: `🔄 Generating report for *${formData.assemblyName}* (${selectedMonth.label})...` });
                const assemblyObj = { id: formData.assemblyId, name: formData.assemblyName };
                let report;
                if (formData.reportType === 'states') {
                    report = await getStatesReport(assemblyObj, selectedMonth.start, selectedMonth.end);
                } else {
                    report = await getReportsSummary(assemblyObj, selectedMonth.start, selectedMonth.end);
                }
                await sock.sendMessage(userJid, { text: report });
                await sock.sendMessage(userJid, { text: ADMIN_NAV_FOOTER });
                await clearUserFormState(phone);
                break;
            }

            // ── ADD MEMBER ────────────────────────────────────────────────────
            case MENU_STEPS.EXECUTOR_ADD_MEMBER_GENDER: {
                if (normalizedMessage !== 'male' && normalizedMessage !== 'female') {
                    await sock.sendMessage(userJid, { text: '❌ Please reply with *Male* or *Female*.' });
                    return;
                }
                const gender = msg.charAt(0).toUpperCase() + msg.slice(1).toLowerCase();
                formData.gender = gender;
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_ADD_MEMBER_FNAME, formData);
                await sock.sendMessage(userJid, { text: `✅ Gender: *${gender}*\n\n📝 Enter the member's *First Name*:` });
                break;
            }

            case MENU_STEPS.EXECUTOR_ADD_MEMBER_FNAME: {
                if (msg.length < 2) {
                    await sock.sendMessage(userJid, { text: '❌ First name must be at least 2 characters.' });
                    return;
                }
                formData.first_name = msg.trim();
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_ADD_MEMBER_SURNAME, formData);
                await sock.sendMessage(userJid, { text: `✅ First name: *${formData.first_name}*\n\n📝 Enter the member's *Surname*:` });
                break;
            }

            case MENU_STEPS.EXECUTOR_ADD_MEMBER_SURNAME: {
                if (msg.length < 2) {
                    await sock.sendMessage(userJid, { text: '❌ Surname must be at least 2 characters.' });
                    return;
                }
                formData.surname = msg.trim();
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_ADD_MEMBER_CLUSTER, formData);
                await sendClusterSelection(sock, userJid, 'Select Cluster for New Member');
                break;
            }

            case MENU_STEPS.EXECUTOR_ADD_MEMBER_CLUSTER: {
                const assemblies = await getAllAssemblies();
                const choice = parseInt(normalizedMessage);
                if (isNaN(choice) || choice < 1 || choice > assemblies.length) {
                    await sock.sendMessage(userJid, { text: `❌ Please reply with a number between 1 and ${assemblies.length}.` });
                    return;
                }
                formData.cluster = assemblies[choice - 1].name;
                // Suggest next available ID
                const nextId = await getNextMemberId();
                formData.suggested_id = nextId;
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_ADD_MEMBER_ID, formData);
                await sock.sendMessage(userJid, {
                    text: `✅ Cluster: *${formData.cluster}*\n\n🔢 *Member ID*\n\nSuggested ID: *${nextId}*\n\nReply with *${nextId}* to accept, or type a different ID number:`
                });
                break;
            }

            case MENU_STEPS.EXECUTOR_ADD_MEMBER_ID: {
                const idInput = parseInt(normalizedMessage);
                if (isNaN(idInput) || idInput < 1000) {
                    await sock.sendMessage(userJid, { text: `❌ Please enter a valid 4-digit or higher Member ID (minimum 1000).` });
                    return;
                }
                // Check for ID conflict
                const existing = await getMemberById(idInput);
                if (existing) {
                    await sock.sendMessage(userJid, {
                        text: `❌ ID *${idInput}* is already taken by *${existing.full_name}*.\n\nPlease enter a different ID:`
                    });
                    return;
                }
                formData.member_id = idInput;
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_ADD_MEMBER_CONFIRM, formData);

                // Show summary for confirmation
                const summary =
                    `👤 *NEW MEMBER SUMMARY*\n` +
                    `────────────────────\n` +
                    `🔢 ID: *${formData.member_id}*\n` +
                    `👤 Name: *${formData.first_name} ${formData.surname}*\n` +
                    `⚧️ Gender: *${formData.gender}*\n` +
                    `⛪ Cluster: *${formData.cluster}*\n` +
                    `────────────────────\n\n` +
                    `Reply *yes* to save or *no* to cancel.`;
                await sock.sendMessage(userJid, { text: summary });
                break;
            }

            case MENU_STEPS.EXECUTOR_ADD_MEMBER_CONFIRM: {
                if (normalizedMessage === 'yes' || normalizedMessage === 'y') {
                    await addMember({
                        member_id:  formData.member_id,
                        first_name: formData.first_name,
                        surname:    formData.surname,
                        gender:     formData.gender,
                        cluster:    formData.cluster
                    });
                    await sock.sendMessage(userJid, {
                        text: `✅ *Member Added Successfully!*\n\n` +
                              `🔢 ID: *${formData.member_id}*\n` +
                              `👤 Name: *${formData.first_name} ${formData.surname}*\n\n` +
                              `They can now use ID *${formData.member_id}* when entering the team field in reports.${ADMIN_NAV_FOOTER}`
                    });
                } else if (normalizedMessage === 'no' || normalizedMessage === 'n') {
                    await clearUserFormState(phone);
                    await sock.sendMessage(userJid, { text: `❌ Cancelled. No member was added.${ADMIN_NAV_FOOTER}` });
                } else {
                    await sock.sendMessage(userJid, { text: '❌ Please reply with *yes* or *no*.' });
                }
                break;
            }

            // ── DISABLE MEMBER ────────────────────────────────────────────────
            case MENU_STEPS.EXECUTOR_DISABLE_MEMBER_ID: {
                const idInput = parseInt(normalizedMessage);
                if (isNaN(idInput)) {
                    await sock.sendMessage(userJid, { text: '❌ Please enter a valid numeric Member ID.' });
                    return;
                }
                const member = await getMemberById(idInput);
                if (!member) {
                    await sock.sendMessage(userJid, { text: `❌ No member found with ID *${idInput}*.\n\nPlease check the ID and try again.` });
                    return;
                }
                if (!member.is_active) {
                    await clearUserFormState(phone);
                    await sock.sendMessage(userJid, { text: `⚠️ Member *${member.full_name}* (ID: ${idInput}) is already disabled.` });
                    return;
                }
                formData.disable_id = idInput;
                formData.disable_name = member.full_name;
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_DISABLE_MEMBER_CONFIRM, formData);
                await sock.sendMessage(userJid, {
                    text: `⚠️ *CONFIRM DISABLE*\n\n` +
                          `Are you sure you want to disable:\n` +
                          `👤 *${member.full_name}* (ID: ${idInput})\n` +
                          `⛪ Cluster: *${member.cluster}*\n\n` +
                          `This member will no longer be able to use their ID in reports.\n\n` +
                          `Reply *yes* to disable or *no* to cancel.`
                });
                break;
            }

            case MENU_STEPS.EXECUTOR_DISABLE_MEMBER_CONFIRM: {
                if (normalizedMessage === 'yes' || normalizedMessage === 'y') {
                    await disableMember(formData.disable_id);
                    await sock.sendMessage(userJid, {
                        text: `✅ *Member Disabled*\n\n` +
                              `👤 *${formData.disable_name}* (ID: ${formData.disable_id}) has been disabled.\n\n` +
                              `Their ID will no longer be accepted in evangelism reports.${ADMIN_NAV_FOOTER}`
                    });
                } else if (normalizedMessage === 'no' || normalizedMessage === 'n') {
                    await clearUserFormState(phone);
                    await sock.sendMessage(userJid, { text: `❌ Cancelled. No changes were made.${ADMIN_NAV_FOOTER}` });
                } else {
                    await sock.sendMessage(userJid, { text: '❌ Please reply with *yes* or *no*.' });
                }
                break;
            }

            // ── VIEW CLUSTER ──────────────────────────────────────────────────
            case MENU_STEPS.EXECUTOR_VIEW_CLUSTER_SELECT: {
                const assemblies = await getAllAssemblies();
                const choice = parseInt(normalizedMessage);
                if (isNaN(choice) || choice < 1 || choice > assemblies.length) {
                    await sock.sendMessage(userJid, { text: `❌ Please reply with a number between 1 and ${assemblies.length}.` });
                    return;
                }
                const cluster = assemblies[choice - 1].name;
                const members = await getMembersByCluster(cluster);

                if (members.length === 0) {
                    await sock.sendMessage(userJid, { text: `ℹ️ No active members found in *${cluster}*.${ADMIN_NAV_FOOTER}` });
                    await clearUserFormState(phone);
                    return;
                }

                let listText = `👥 *${cluster.toUpperCase()} MEMBERS* (${members.length})\n`;
                listText += `────────────────────\n\n`;

                members.forEach(m => {
                    const genderIcon = m.gender === 'Male' ? '♂️' : '♀️';
                    listText += `${genderIcon} [${m.member_id}] ${m.full_name}\n`;
                });

                listText += `\n_${members.length} active member(s)_`;

                await sock.sendMessage(userJid, { text: listText + ADMIN_NAV_FOOTER });
                await clearUserFormState(phone);
                break;
            }

            // ── DEFAULT ───────────────────────────────────────────────────────
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

// ── Helper UI Functions ────────────────────────────────────────────────────────

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

async function sendFetchDataSubMenu(sock, userJid) {
    let menuText = `🔄 *FETCH DATA*\n`;
    menuText += `────────────────────\n\n`;
    menuText += `Please choose an option:\n\n`;
    menuText += `1️⃣ Get states\n`;
    menuText += `2️⃣ Reports summary\n\n`;
    menuText += `_Reply with 1 or 2._`;
    await sock.sendMessage(userJid, { text: menuText });
}

async function sendClusterSelection(sock, userJid, title) {
    const assemblies = await getAllAssemblies();
    let menuText = `📋 *${title.toUpperCase()}*\n`;
    menuText += `────────────────────\n\n`;
    assemblies.forEach((a, index) => {
        menuText += `${index + 1}. ${a.name}\n`;
    });
    menuText += `\n_Reply with the cluster number (1-${assemblies.length})._`;
    await sock.sendMessage(userJid, { text: menuText });
}

async function sendMonthSelection(sock, userJid) {
    const months = getRecentMonths(6);
    let menuText = `📅 *SELECT MONTH*\n`;
    menuText += `────────────────────\n\n`;
    months.forEach((m, index) => {
        menuText += `${index + 1}. ${m.label}\n`;
    });
    menuText += `\n_Reply with the number (1-${months.length})._`;
    await sock.sendMessage(userJid, { text: menuText });
}

function getRecentMonths(count) {
    const months = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
        let year = now.getFullYear();
        let month = now.getMonth() - i;
        while (month < 0) { month += 12; year--; }
        const startDate = new Date(year, month, 1);
        const endDate   = new Date(year, month + 1, 0);
        const label = endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const fmt = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        months.push({ label, start: fmt(year, month, 1), end: fmt(year, month, endDate.getDate()) });
    }
    return months;
}

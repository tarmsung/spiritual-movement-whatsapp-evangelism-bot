import {
    getAllAssemblies,
    createReport,
    getUserFormState,
    saveUserFormState,
    clearUserFormState
} from '../database/db.js';
import {
    validateAssemblySelection,
    validateDate,
    validateLocation,
    validateNumber,
    validateActivityType,
    validateTeam,
    validateMessageSummary,
    validateResponseMoments,
    validateName,
    validateConfirmation
} from './formValidator.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { formatDate } from '../utils/helpers.js';
import { postReportToGroup } from '../services/groupPoster.js';

// Form steps
const STEPS = {
    ASSEMBLY: 0,
    DATE: 1,
    LOCATION: 2,
    ACTIVITY_TYPE: 3,
    CUSTOM_ACTIVITY_TYPE: 4,
    PREACHERS_TEAM: 5,
    MESSAGE_SUMMARY: 6,
    RESPONSE_MOMENTS: 7,
    CONVERTS: 8,
    SICK_PRAYED_FOR: 9,
    REPORTER_NAME: 10,
    CONFIRMATION: 11
};

/**
 * Start a new evangelism report form
 * @param {Object} sock - WhatsApp socket
 * @param {string} userJid - User's WhatsApp JID
 */
export async function startReportForm(sock, userJid) {
    logger.info(`Starting new report form for ${userJid}`);

    // Clear any existing form state
    await clearUserFormState(userJid);

    // Initialize form data
    const formData = {
        reporter_phone: userJid
    };

    // Save initial state
    await saveUserFormState(userJid, STEPS.ASSEMBLY, formData);

    // Send assembly selection prompt
    await sendAssemblyPrompt(sock, userJid);
}

/**
 * Process user response in active form
 * @param {Object} sock - WhatsApp socket
 * @param {string} userJid - User's WhatsApp JID
 * @param {string} message - User's message
 */
export async function processFormResponse(sock, userJid, message) {
    // Check for cancel command
    if (message.trim().toLowerCase() === 'cancel') {
        await clearUserFormState(userJid);
        await sock.sendMessage(userJid, {
            text: '❌ Form cancelled. Send "evangelism" to start a new report.'
        });
        return;
    }

    // Get current form state
    const userState = await getUserFormState(userJid);
    if (!userState) {
        logger.warn(`No form state found for ${userJid}`);
        return;
    }

    const currentStep = userState.current_form_step;
    const formData = userState.form_data; // JSON already parsed by db.js

    // Process based on current step
    switch (currentStep) {
        case STEPS.ASSEMBLY:
            await processAssemblyStep(sock, userJid, message, formData);
            break;
        case STEPS.DATE:
            await processDateStep(sock, userJid, message, formData);
            break;
        case STEPS.LOCATION:
            await processLocationStep(sock, userJid, message, formData);
            break;
        case STEPS.ACTIVITY_TYPE:
            await processActivityTypeStep(sock, userJid, message, formData);
            break;
        case STEPS.CUSTOM_ACTIVITY_TYPE:
            await processCustomActivityTypeStep(sock, userJid, message, formData);
            break;
        case STEPS.PREACHERS_TEAM:
            await processPreachersTeamStep(sock, userJid, message, formData);
            break;
        case STEPS.MESSAGE_SUMMARY:
            await processMessageSummaryStep(sock, userJid, message, formData);
            break;
        case STEPS.RESPONSE_MOMENTS:
            await processResponseMomentsStep(sock, userJid, message, formData);
            break;
        case STEPS.CONVERTS:
            await processConvertsStep(sock, userJid, message, formData);
            break;
        case STEPS.SICK_PRAYED_FOR:
            await processSickPrayedForStep(sock, userJid, message, formData);
            break;
        case STEPS.REPORTER_NAME:
            await processReporterNameStep(sock, userJid, message, formData);
            break;
        case STEPS.CONFIRMATION:
            await processConfirmationStep(sock, userJid, message, formData);
            break;
    }
}

/**
 * Send assembly selection prompt
 */
async function sendAssemblyPrompt(sock, userJid) {
    const assemblies = await getAllAssemblies();

    if (assemblies.length === 0) {
        await sock.sendMessage(userJid, {
            text: '❌ No assemblies configured. Please contact the administrator.'
        });
        await clearUserFormState(userJid);
        return;
    }

    let message = '📋 *EVANGELISM REPORT FORM*\n\n';
    message += '🏛️ *Select your assembly:*\n\n';

    assemblies.forEach((assembly, index) => {
        message += `▪️ ${index + 1}. ${assembly.name}\n`;
    });

    message += '\n🔢 Reply with the number of your assembly';
    message += '\n\n_Type "cancel" anytime to cancel._';

    await sock.sendMessage(userJid, { text: message });
}

/**
 * Process assembly selection
 */
async function processAssemblyStep(sock, userJid, message, formData) {
    const assemblies = await getAllAssemblies();
    const validation = validateAssemblySelection(message, assemblies.length);

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    const selectedAssembly = assemblies[validation.value - 1];
    if (!selectedAssembly) {
        await sock.sendMessage(userJid, { text: '❌ Invalid assembly selection.' });
        return;
    }

    formData.assembly_id = selectedAssembly.id;
    formData.assembly_name = selectedAssembly.name;

    // Move to next step
    await saveUserFormState(userJid, STEPS.DATE, formData);

    let response = `✅ Assembly: *${selectedAssembly.name}*\n\n`;
    response += '📅 *When did this evangelism activity take place?*\n';
    response += '(Enter date as DD/MM/YYYY, or type "today" or "yesterday")';

    await sock.sendMessage(userJid, { text: response });
}

/**
 * Process date input
 */
async function processDateStep(sock, userJid, message, formData) {
    const validation = validateDate(message);

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    formData.activity_date = validation.value;

    // Move to next step
    await saveUserFormState(userJid, STEPS.LOCATION, formData);

    let response = `✅ Date: ${formatDate(validation.value)}\n\n`;
    response += '📍 Where did this activity take place?\n';
    response += '(Enter location/area name)';

    await sock.sendMessage(userJid, { text: response });
}

/**
 * Process location input
 */
async function processLocationStep(sock, userJid, message, formData) {
    const validation = validateLocation(message);

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    formData.location = validation.value;

    // Move to next step
    await saveUserFormState(userJid, STEPS.ACTIVITY_TYPE, formData);

    let response = `✅ Location: *${validation.value}*\n\n`;
    response += '📋 *What type of evangelism activity was this?*\n\n';

    config.activityTypes.forEach((type, index) => {
        response += `▪️ ${index + 1}. ${type}\n`;
    });

    response += '\n🔢 Reply with the number:';

    await sock.sendMessage(userJid, { text: response });
}

/**
 * Process activity type input
 */
async function processActivityTypeStep(sock, userJid, message, formData) {
    const validation = validateActivityType(message, config.activityTypes.length);

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    const selectedType = config.activityTypes[validation.value - 1];

    // Check if "Other" was selected
    if (selectedType === 'Other') {
        // Store that they selected "Other" and ask for custom type
        formData.selected_other = true;
        await saveUserFormState(userJid, STEPS.CUSTOM_ACTIVITY_TYPE, formData);

        let response = '✅ Activity Type: *Other*\n\n';
        response += '📝 *Please specify the type of evangelism activity:*\n';
        response += '(Enter the activity type in your own words, e.g., "Bus Evangelism", "Market Outreach")';

        await sock.sendMessage(userJid, { text: response });
    } else {
        // Standard activity type selected, move to preachers team
        formData.activity_type = selectedType;
        await saveUserFormState(userJid, STEPS.PREACHERS_TEAM, formData);

        let response = `✅ Activity Type: *${selectedType}*\n\n`;
        response += '👥 *Who were the preachers/team members involved?*\n';
        response += '(Enter names, e.g., "John, Mary, Peter")';

        await sock.sendMessage(userJid, { text: response });
    }
}

/**
 * Process custom activity type input (when "Other" is selected)
 */
async function processCustomActivityTypeStep(sock, userJid, message, formData) {
    const customType = message.trim();

    // Validate custom activity type
    if (customType.length < 3) {
        await sock.sendMessage(userJid, {
            text: '❌ Activity type must be at least 3 characters long.'
        });
        return;
    }

    if (customType.length > 100) {
        await sock.sendMessage(userJid, {
            text: '❌ Activity type is too long (max 100 characters).'
        });
        return;
    }

    // Store the custom activity type
    formData.activity_type = customType;
    delete formData.selected_other; // Clean up temporary flag

    // Move to next step
    await saveUserFormState(userJid, STEPS.PREACHERS_TEAM, formData);

    let response = `✅ Activity Type: ${customType}\n\n`;
    response += '👥 Who were the preachers/team members involved?\n';
    response += '(Enter names, e.g., "John, Mary, Peter")';

    await sock.sendMessage(userJid, { text: response });
}

/**
 * Process preachers team input
 */
async function processPreachersTeamStep(sock, userJid, message, formData) {
    const validation = validateTeam(message);

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    formData.preachers_team = validation.value;

    // Move to next step
    await saveUserFormState(userJid, STEPS.MESSAGE_SUMMARY, formData);

    let response = `✅ Preachers/Team: ${validation.value}\n\n`;
    response += '📖 Please provide a summary of what happened during the activity:\n';
    response += '(Describe the message, events, etc. - minimum 10 characters)';

    await sock.sendMessage(userJid, { text: response });
}

/**
 * Process message summary input
 */
async function processMessageSummaryStep(sock, userJid, message, formData) {
    const validation = validateMessageSummary(message);

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    formData.message_summary = validation.value;

    // Move to next step
    await saveUserFormState(userJid, STEPS.RESPONSE_MOMENTS, formData);

    let response = `✅ Summary recorded\n\n`;
    response += '✨ Any notable responses or moments?\n';
    response += '(Describe memorable moments, testimonies, etc., or type "none" to skip)';

    await sock.sendMessage(userJid, { text: response });
}

/**
 * Process response/notable moments input
 */
async function processResponseMomentsStep(sock, userJid, message, formData) {
    const validation = validateResponseMoments(message);

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    formData.response_moments = validation.value;

    // Move to next step
    await saveUserFormState(userJid, STEPS.CONVERTS, formData);

    let response = validation.value ? '✅ Notable moments recorded\n\n' : '— No notable moments\n\n';
    response += '✝️ How many people made decisions/conversions?\n';
    response += '(Enter a number, or 0 if none)';

    await sock.sendMessage(userJid, { text: response });
}

/**
 * Process converts input
 */
async function processConvertsStep(sock, userJid, message, formData) {
    const validation = validateNumber(message, 'Converts');

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    formData.converts = validation.value;

    // Move to next step
    await saveUserFormState(userJid, STEPS.SICK_PRAYED_FOR, formData);

    let response = `✅ Converts: ${validation.value}\n\n`;
    response += '🙏 How many sick people were prayed for?\n';
    response += '(Enter a number, or 0 if none)';

    await sock.sendMessage(userJid, { text: response });
}

/**
 * Process sick prayed for input
 */
async function processSickPrayedForStep(sock, userJid, message, formData) {
    const validation = validateNumber(message, 'Sick prayed for');

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    formData.sick_prayed_for = validation.value;

    // Move to next step
    await saveUserFormState(userJid, STEPS.REPORTER_NAME, formData);

    let response = `✅ Sick Prayed For: ${validation.value}\n\n`;
    response += '📝 Finally, please enter your full name (reporter):';

    await sock.sendMessage(userJid, { text: response });
}

/**
 * Process reporter name input
 */
async function processReporterNameStep(sock, userJid, message, formData) {
    const validation = validateName(message);

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    formData.reporter_name = validation.value;

    // Move to confirmation step
    await saveUserFormState(userJid, STEPS.CONFIRMATION, formData);

    // Send summary for confirmation
    let summary = '📖 REPORT SUMMARY 📖\n';
    summary += '━━━━━━━━━━━━━━━━━━━━\n';
    summary += `🏛️ Assembly: ${formData.assembly_name}\n`;
    summary += `📅 Date: ${formatDate(formData.activity_date)}\n`;
    summary += `📍 Location: ${formData.location}\n`;
    summary += `📋 Activity Type: ${formData.activity_type}\n`;
    summary += `👥 Preachers/Team: ${formData.preachers_team}\n`;
    summary += `📖 Summary: ${formData.message_summary.substring(0, 100)}${formData.message_summary.length > 100 ? '...' : ''}\n`;
    if (formData.response_moments) {
        summary += `✨ Notable Moments: ${formData.response_moments.substring(0, 100)}${formData.response_moments.length > 100 ? '...' : ''}\n`;
    }
    summary += `✝️ Converts: ${formData.converts}\n`;
    summary += `🙏 Sick Prayed For: ${formData.sick_prayed_for}\n`;
    summary += `📝 Reporter: ${formData.reporter_name}\n`;
    summary += '━━━━━━━━━━━━━━━━━━━━\n\n';
    summary += '✅ Reply with *"yes"* to submit\n';
    summary += '❌ Reply with *"no"* to cancel';

    await sock.sendMessage(userJid, { text: summary });
}

/**
 * Process confirmation
 */
async function processConfirmationStep(sock, userJid, message, formData) {
    const validation = validateConfirmation(message);

    if (!validation.valid) {
        await sock.sendMessage(userJid, { text: `❌ ${validation.error}` });
        return;
    }

    if (!validation.value) {
        // User said no
        await clearUserFormState(userJid);
        await sock.sendMessage(userJid, {
            text: '❌ Report cancelled. Send "evangelism" to start a new report.'
        });
        return;
    }

    // User confirmed - save report
    try {
        const result = await createReport(formData);
        logger.info(`Report created with ID: ${result.lastInsertRowid}`);

        // Clear form state
        await clearUserFormState(userJid);

        // Send success message
        await sock.sendMessage(userJid, {
            text: '✅ Report submitted successfully!\n\nYour evangelism report has been saved and will be posted to your assembly group.\n\nThank you for your faithfulness! 🙏'
        });

        // Post to group
        await postReportToGroup(sock, result.lastInsertRowid);

    } catch (error) {
        logger.error('Error saving report:', error);
        await sock.sendMessage(userJid, {
            text: '❌ Error saving report. Please try again later or contact the administrator.'
        });
        await clearUserFormState(userJid);
    }
}

/**
 * Check if user has active form
 * @param {string} userJid
 * @returns {Promise<boolean>}
 */
export async function hasActiveForm(userJid) {
    const state = await getUserFormState(userJid);
    return state !== undefined;
}

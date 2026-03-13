import { getUserFormState, saveUserFormState, clearUserFormState } from '../../database/db.js';
import { extractPhone } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { handleExecutorMenu } from './executorMenu.js';
import { handleMemberMenu } from './memberMenu.js';
import { MENU_STEPS } from '../../utils/constants.js';

/**
 * Handle direct messages based on user state
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - WhatsApp message
 * @param {string} userJid - User's JID
 * @param {string} messageText - The message sent
 * @param {boolean} isUserAdmin - Whether the user has admin privileges
 */
export async function handleDmMenu(sock, msg, userJid, messageText, isUserAdmin) {
    const phone = extractPhone(userJid);
    const normalizedMessage = messageText.trim().toLowerCase();

    // Check if the user wants to cancel out of any menu
    if (normalizedMessage === 'cancel' || normalizedMessage === 'exit') {
        await clearUserFormState(phone);
        await sock.sendMessage(userJid, { text: '❌ Menu exited. Send any message to open the menu again, or type *Admin* if you are an Executor.' });
        return;
    }

    // Try to get existing state
    let state = await getUserFormState(phone);

    // If no state, we initialize based on what they typed
    if (!state) {
        if (normalizedMessage === 'admin') {
            if (isUserAdmin) {
                // Initialize Executor menu state
                await saveUserFormState(phone, MENU_STEPS.EXECUTOR_MAIN, {});
                await handleExecutorMenu(sock, userJid, messageText, MENU_STEPS.EXECUTOR_MAIN, {});
            } else {
                await sock.sendMessage(userJid, { text: '🚫 Access Denied: You do not have Executor privileges.' });
            }
        } else {
            // Default to Member menu
            await saveUserFormState(phone, MENU_STEPS.MEMBER_MAIN, {});
            await handleMemberMenu(sock, userJid, messageText, MENU_STEPS.MEMBER_MAIN, {});
        }
        return;
    }

    // Route to appropriate handler based on current state step
    const currentStep = Number(state.current_form_step);
    const formData = state.form_data || {};

    try {
        if (currentStep >= MENU_STEPS.EXECUTOR_MAIN) {
            // Steps 110 and above are Executor flow
            // Double-check admin privileges just in case
            if (!isUserAdmin) {
                await clearUserFormState(phone);
                await sock.sendMessage(userJid, { text: '🚫 Access Revoked.' });
                return;
            }
            await handleExecutorMenu(sock, userJid, messageText, currentStep, formData);
        } else if (currentStep === MENU_STEPS.MEMBER_MAIN || currentStep === MENU_STEPS.MEMBER_WAIT) {
            await handleMemberMenu(sock, userJid, messageText, currentStep, formData);
        } else {
            // Unknown state... clear it
            await clearUserFormState(phone);
            await sock.sendMessage(userJid, { text: '🔄 Session reset. Please try again.' });
        }
    } catch (error) {
        logger.error(`Error in DM menu handler for ${phone}:`, error);
        await clearUserFormState(phone);
        await sock.sendMessage(userJid, { text: '❌ An error occurred. Session has been reset.' });
    }
}

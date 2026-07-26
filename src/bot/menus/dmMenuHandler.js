import { getUserFormState, saveUserFormState, clearUserFormState } from '../../database/db.js';
import { extractPhone } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { handleExecutorMenu } from './executorMenu.js';
import { handleMemberMenu } from './memberMenu.js';
import { MENU_STEPS, CANCEL_MESSAGE } from '../../utils/constants.js';

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

    try {
        // 1. Check for global session reset / entry points FIRST
        // Handle cancel command
        if (normalizedMessage === 'cancel') {
            await clearUserFormState(phone);
            await sock.sendMessage(userJid, { text: CANCEL_MESSAGE });
            return;
        }

        // This allows users to type "Menu" or "Admin" at ANY stage to reset.
        if (normalizedMessage === 'menu') {
            await clearUserFormState(phone);
            await handleMemberMenu(sock, userJid, messageText, MENU_STEPS.MEMBER_MAIN, {});
            return;
        }

        if (normalizedMessage === 'admin') {
            if (isUserAdmin) {
                await clearUserFormState(phone);
                await handleExecutorMenu(sock, userJid, messageText, MENU_STEPS.EXECUTOR_MAIN, {});
            } else {
                await sock.sendMessage(userJid, { text: '🚫 Access Denied: You do not have Executor privileges.' });
            }
            return;
        }

        // 2. Try to get existing state
        const state = await getUserFormState(phone);

        // 3. If no state and no entry keyword was used, prompt them correctly
        if (!state) {
            await sock.sendMessage(userJid, {
                text: `👋 *Welcome!*\n\nType *Menu* to open the Member Menu.\n${isUserAdmin ? '\nType *Admin* to open the Executor Menu.' : ''}\n\n_Type "cancel" at any time to exit._`
            });
            return;
        }

        // Route to appropriate handler based on current state step
        const currentStep = Number(state.current_form_step);
        const formData = state.form_data || {};

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
        // Reply and cleanup are independently guarded: a second throw here
        // (e.g. the DB is still down) must not escape uncaught, otherwise it's
        // swallowed by connection.js's top-level catch with no reply ever
        // reaching the user — the exact silent-failure this wrapper closes.
        try {
            await sock.sendMessage(userJid, { text: '❌ An error occurred. Please try again, or contact the administrator if this continues.' });
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

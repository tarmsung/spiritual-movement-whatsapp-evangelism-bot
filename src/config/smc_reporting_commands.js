/**
 * Standard Ministry Commands (SMC) - Reporting Authority Framework
 * 
 * This file defines the standard reporting commands that control:
 * - Who has authority to report (executor vs compiler)
 * - What narrative voice to use (first person vs third person)
 * - How to handle editing and compilation
 */

export const SMC_COMMANDS = {
    EXECUTOR_REPORT: {
        name: '[Executor Report]',
        authority: 'executor',
        voice: 'first_person',
        description: 'Writer was physically present with first-hand authority',
        guidelines: [
            'Use first person ("we", "our", "the team")',
            'Authority remains eyewitness (executor)',
            'Luke-style narrative: authoritative yet descriptive',
            'First-person or collective witness voice',
            'Allows reflection, resistance, and interpretation',
            'No false "I" statements if evidence or collective narrative'
        ]
    },

    EXECUTOR_REPORT_EDIT_FOR_PUBLICATION: {
        name: '[Executor Report - Edit for Publication]',
        authority: 'executor',
        voice: 'first_person',
        description: 'Executor wrote the report, executor was present, needs polishing',
        guidelines: [
            'Preserves executor\'s voice',
            'Improves clarity, flow, and faith tone',
            'No change to meaning or facts',
            'Maintains first-person authority'
        ]
    },

    EDIT_EXECUTOR_PRESENT: {
        name: '[Edit - Executor Present]',
        authority: 'executor',
        voice: 'neutral_third_person',
        description: 'Another person wrote the report, the executor was physically present',
        guidelines: [
            'Authority remains eyewitness (executor)',
            'Removes false First person claims by writer',
            'Uses neutral or collective narrative voice',
            'Maintains executor\'s testimony accuracy'
        ]
    },

    COMPILED_FROM_EXECUTOR_PODCAST: {
        name: '[Compiled from Executor Podcast]',
        authority: 'testimony',
        voice: 'luke_style_third_person',
        description: 'Audio testimony and Keynoters were present, writer was NOT present',
        guidelines: [
            'Third person / narrative voice',
            'No invented details',
            'Faithful to spoken testimony',
            'Luke 1:1-2 style compilation',
            'Recommended attribution: "Compiled from eyewitness testimony and published accounts."'
        ]
    },

    EDIT_FOR_PUBLICATION_FIELD_REPORTS: {
        name: '[Edit for Publication - Field Reports]',
        authority: 'compilation',
        voice: 'neutral',
        description: 'Reports come from evangelists (WhatsApp)',
        guidelines: [
            'Language is raw and unstructured',
            'Simplifies to basic English',
            'Preserves original testimony',
            'Strengthens faith and clarity',
            'Does NOT overwrite evangelist voice'
        ]
    },

    CLUSTER_COMPILATION: {
        name: '[Cluster Compilation]',
        authority: 'compilation',
        voice: 'third_person',
        description: 'Multiple evangelists, filters noise, selects key moments',
        guidelines: [
            'Combines reports from multiple evangelists',
            'Filters unnecessary noise',
            'Highlights most significant moments',
            'Third-person collective narrative'
        ]
    }
};

// Default command when none is specified
export const DEFAULT_COMMAND = SMC_COMMANDS.EXECUTOR_REPORT;

/**
 * Get command by name
 * @param {string} commandName - Command name (e.g., '[Executor Report]')
 * @returns {Object} Command configuration
 */
export function getCommandByName(commandName) {
    const command = Object.values(SMC_COMMANDS).find(
        c => c.name.toLowerCase() === commandName.toLowerCase()
    );
    return command || DEFAULT_COMMAND;
}

/**
 * Detect command from options or text
 * @param {Object|string} input - Options object with command property or command string
 * @returns {Object} Command configuration
 */
export function detectCommand(input) {
    if (!input) return DEFAULT_COMMAND;

    const commandName = typeof input === 'string' ? input : input.command;
    if (!commandName) return DEFAULT_COMMAND;

    return getCommandByName(commandName);
}

// Form validation functions

/**
 * Validate cluster selection
 * @param {string} input
 * @param {number} maxOptions
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
export function validateAssemblySelection(input, maxOptions) {
    const num = parseInt(input.trim());

    if (isNaN(num)) {
        return { valid: false, error: 'Please enter a valid number.' };
    }

    if (num < 1 || num > maxOptions) {
        return { valid: false, error: `Please enter a number between 1 and ${maxOptions}.` };
    }

    return { valid: true, value: num };
}

/**
 * Validate name input
 * @param {string} input
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validateName(input) {
    const name = input.trim();

    if (name.length < 2) {
        return { valid: false, error: 'Name must be at least 2 characters long.' };
    }

    if (name.length > 100) {
        return { valid: false, error: 'Name is too long (max 100 characters).' };
    }

    return { valid: true, value: name };
}

/**
 * Validate date input
 * @param {string} input
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validateDate(input) {
    const trimmed = input.trim().toLowerCase();

    // Handle shortcuts
    if (trimmed === 'today') {
        const today = new Date();
        return { valid: true, value: today.toISOString().split('T')[0] };
    }

    if (trimmed === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return { valid: true, value: yesterday.toISOString().split('T')[0] };
    }

    // Try to parse date - support both YYYY-MM-DD and DD/MM/YYYY
    let dateObj;

    // Check for DD/MM/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input.trim())) {
        const [day, month, year] = input.trim().split('/');
        dateObj = new Date(year, month - 1, day);
    } else {
        // Try YYYY-MM-DD format
        dateObj = new Date(input.trim());
    }

    if (isNaN(dateObj.getTime())) {
        return {
            valid: false,
            error: 'Invalid date format. Please use DD/MM/YYYY, "today", or "yesterday".'
        };
    }

    // Check if date is not in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (dateObj > today) {
        return { valid: false, error: 'Activity date cannot be in the future.' };
    }

    // Return in YYYY-MM-DD format for database
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return { valid: true, value: `${year}-${month}-${day}` };
}

/**
 * Validate location input
 * @param {string} input
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validateLocation(input) {
    const location = input.trim();

    if (location.length < 2) {
        return { valid: false, error: 'Location must be at least 2 characters long.' };
    }

    if (location.length > 200) {
        return { valid: false, error: 'Location is too long (max 200 characters).' };
    }

    return { valid: true, value: location };
}

/**
 * Validate area input
 * @param {string} input
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validateArea(input) {
    const area = input.trim();

    if (area.length < 2) {
        return { valid: false, error: 'Area must be at least 2 characters long.' };
    }

    if (area.length > 200) {
        return { valid: false, error: 'Area is too long (max 200 characters).' };
    }

    return { valid: true, value: area };
}

/**
 * Validate city input
 * @param {string} input
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validateCity(input) {
    const city = input.trim();

    if (city.length < 2) {
        return { valid: false, error: 'City must be at least 2 characters long.' };
    }

    if (city.length > 200) {
        return { valid: false, error: 'City is too long (max 200 characters).' };
    }

    return { valid: true, value: city };
}

/**
 * Validate number input (for people reached/conversions)
 * @param {string} input
 * @param {string} fieldName
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
export function validateNumber(input, fieldName = 'Number') {
    const num = parseInt(input.trim());

    if (isNaN(num)) {
        return { valid: false, error: `${fieldName} must be a valid number.` };
    }

    if (num < 0) {
        return { valid: false, error: `${fieldName} cannot be negative.` };
    }

    if (num > 1000000) {
        return { valid: false, error: `${fieldName} seems too large. Please verify.` };
    }

    return { valid: true, value: num };
}

/**
 * Validate activity type selection
 * @param {string} input
 * @param {number} maxOptions
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
export function validateActivityType(input, maxOptions) {
    const num = parseInt(input.trim());

    if (isNaN(num)) {
        return { valid: false, error: 'Please enter a valid number.' };
    }

    if (num < 1 || num > maxOptions) {
        return { valid: false, error: `Please enter a number between 1 and ${maxOptions}.` };
    }

    return { valid: true, value: num };
}

/**
 * Validate preachers team input
 * @param {string} input
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validateTeam(input) {
    const team = input.trim();

    if (team.length < 2) {
        return { valid: false, error: 'Preachers team must be at least 2 characters long.' };
    }

    if (team.length > 200) {
        return { valid: false, error: 'Preachers team is too long (max 200 characters).' };
    }

    return { valid: true, value: team };
}

/**
 * Validate message summary input
 * @param {string} input
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validateMessageSummary(input) {
    const summary = input.trim();

    if (summary.length < 10) {
        return { valid: false, error: 'Message summary must be at least 10 characters long.' };
    }

    if (summary.length > 1000) {
        return { valid: false, error: 'Message summary is too long (max 1000 characters).' };
    }

    return { valid: true, value: summary };
}

/**
 * Validate response/notable moments input (optional)
 * @param {string} input
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validateResponseMoments(input) {
    const response = input.trim().toLowerCase();

    // "none" or "skip" means no response moments
    if (response === 'none' || response === 'skip' || response === '') {
        return { valid: true, value: null };
    }

    if (input.trim().length > 1000) {
        return { valid: false, error: 'Response/moments are too long (max 1000 characters).' };
    }

    return { valid: true, value: input.trim() };
}

/**
 * Validate notes input (optional)
 * @param {string} input
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
export function validateNotes(input) {
    const notes = input.trim().toLowerCase();

    // "none" or "skip" means no notes
    if (notes === 'none' || notes === 'skip' || notes === '') {
        return { valid: true, value: null };
    }

    if (input.trim().length > 1000) {
        return { valid: false, error: 'Notes are too long (max 1000 characters).' };
    }

    return { valid: true, value: input.trim() };
}

/**
 * Validate yes/no confirmation
 * @param {string} input
 * @returns {{valid: boolean, value?: boolean, error?: string}}
 */
export function validateConfirmation(input) {
    const response = input.trim().toLowerCase();

    if (response === 'yes' || response === 'y') {
        return { valid: true, value: true };
    }

    if (response === 'no' || response === 'n') {
        return { valid: true, value: false };
    }

    return { valid: false, error: 'Please reply with "yes" or "no".' };
}

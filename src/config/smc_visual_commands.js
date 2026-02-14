/**
 * Standard Ministry Commands (SMC) - Visual Reporting Configuration
 * 
 * This file defines visual generation commands and configuration
 * for creating maps, charts, and other visual elements in reports
 */

export const VISUAL_COMMANDS = {
    GENERATE_MAP: '[Generate Colorful Pinned Map]'
};

export const MAP_CONFIG = {
    // Canvas dimensions
    width: 800,
    height: 600,

    // Styling
    backgroundColor: '#ffffff',
    gridColor: '#e0e0e0',
    axisColor: '#000000',

    // Pin colors (cycle through these for multiple locations)
    pinColors: ['#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#9c27b0', '#00bcd4', '#ff6f00'],

    // Typography
    fontSize: 11,
    titleFontSize: 14,
    axisFontSize: 10,

    // Features
    showGrid: true,
    showAxes: true,
    autoGenerate: true, // Auto-generate map when multiple locations detected

    // Layout
    padding: 60,
    titleSpace: 40,

    // Pin styling
    pinRadius: 5,
    labelOffset: 8
};

/**
 * Check if visual command is present in text or options
 * @param {string|Object} input - Command string or options object
 * @returns {boolean}
 */
export function shouldGenerateMap(input) {
    if (!input) return MAP_CONFIG.autoGenerate;

    const text = typeof input === 'string' ? input : (input.visualCommand || '');
    return text.includes(VISUAL_COMMANDS.GENERATE_MAP) || MAP_CONFIG.autoGenerate;
}

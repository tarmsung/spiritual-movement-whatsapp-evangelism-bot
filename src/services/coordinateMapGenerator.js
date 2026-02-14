/**
 * Coordinate Map Generator
 * 
 * Generates scatter plot maps showing evangelism locations by coordinate
 * This creates simple geometric plots like the example PDF, not geographic maps
 */

import { createCanvas } from 'canvas';
import { MAP_CONFIG } from '../config/smc_visual_commands.js';
import logger from '../utils/logger.js';
import { join } from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPORTS_DIR = join(__dirname, '../../reports');

// Ensure reports directory exists
if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Zimbabwe location coordinates (latitude, longitude)
 * Expanding this as we discover more locations
 */
const ZIMBABWE_COORDINATES = {
    'Mutare': [-18.9707, 32.6700],
    'Mutare (Chikabvumbwa)': [-18.97, 32.64],
    'Dangamvura': [-18.9667, 32.6833],
    'Mutare CBD': [-18.9667, 32.6667],
    'Chikanga': [-18.9833, 32.6833],
    'Sakubva': [-18.9833, 32.6500],
    'Hobhouse': [-18.9500, 32.7000],
    'Penhalonga': [-18.8667, 32.7000],
    'Nyanga Terminus': [-18.2167, 32.7500],
    'Odzi': [-18.9667, 32.4167],
    'Marange': [-19.5000, 32.3333],
    'Bocha': [-19.0000, 32.5000],
    'Chitenderano (Nyazura)': [-18.7167, 32.1833],
    'Katsuro Market': [-18.8833, 32.5167],
    'Mutanda': [-19.0333, 32.6333],
    'Rusape': [-18.5333, 32.1333],
    'Marondera': [-18.1851, 31.5519],
    'Bulawayo': [-20.1500, 28.5833],
    'Harare': [-17.8292, 31.0522],
    'Gweru': [-19.4500, 29.8167],
    'Kwekwe': [-18.9281, 29.8144],
    'Kadoma': [-18.3328, 29.9150],
    'Chinhoyi': [-17.3667, 30.2000]
};

/**
 * Generate coordinate scatter plot for locations
 * @param {string[]} locations - Array of location names
 * @param {string} title - Title for the map
 * @param {string} outputPath - Path to save the image
 * @returns {Promise<string|null>} Path to generated image or null if failed
 */
export async function generateLocationPlot(locations, title, outputPath) {
    try {
        logger.info(`Generating location plot for ${locations.length} locations`);

        // Get coordinates for locations
        const points = locations
            .map(loc => {
                // Try exact match first
                let coords = ZIMBABWE_COORDINATES[loc];

                // If not found, try case-insensitive match
                if (!coords) {
                    const key = Object.keys(ZIMBABWE_COORDINATES).find(
                        k => k.toLowerCase() === loc.toLowerCase()
                    );
                    coords = key ? ZIMBABWE_COORDINATES[key] : null;
                }

                if (!coords) {
                    logger.warn(`No coordinates found for location: ${loc}`);
                    return null;
                }

                return { name: loc, lat: coords[0], lon: coords[1] };
            })
            .filter(Boolean);

        if (points.length === 0) {
            logger.warn('No valid coordinates found for any location');
            return null;
        }

        logger.info(`Found coordinates for ${points.length} locations`);

        // Create canvas
        const canvas = createCanvas(MAP_CONFIG.width, MAP_CONFIG.height);
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = MAP_CONFIG.backgroundColor;
        ctx.fillRect(0, 0, MAP_CONFIG.width, MAP_CONFIG.height);

        // Calculate bounds
        const lats = points.map(p => p.lat);
        const lons = points.map(p => p.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        // Add padding to ranges
        const latRange = (maxLat - minLat) || 1;
        const lonRange = (maxLon - minLon) || 1;
        const latPadding = latRange * 0.1;
        const lonPadding = lonRange * 0.1;

        const plotMinLat = minLat - latPadding;
        const plotMaxLat = maxLat + latPadding;
        const plotMinLon = minLon - lonPadding;
        const plotMaxLon = maxLon + lonPadding;

        const plotLatRange = plotMaxLat - plotMinLat;
        const plotLonRange = plotMaxLon - plotMinLon;

        const plotWidth = MAP_CONFIG.width - 2 * MAP_CONFIG.padding;
        const plotHeight = MAP_CONFIG.height - 2 * MAP_CONFIG.padding - MAP_CONFIG.titleSpace;

        // Draw title
        ctx.fillStyle = '#000000';
        ctx.font = `${MAP_CONFIG.titleFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(title, MAP_CONFIG.width / 2, 30);

        const plotTop = MAP_CONFIG.padding + MAP_CONFIG.titleSpace;
        const plotLeft = MAP_CONFIG.padding;

        // Draw grid if enabled
        if (MAP_CONFIG.showGrid) {
            ctx.strokeStyle = MAP_CONFIG.gridColor;
            ctx.lineWidth = 1;

            // Vertical lines
            for (let i = 0; i <= 5; i++) {
                const x = plotLeft + (plotWidth / 5) * i;
                ctx.beginPath();
                ctx.moveTo(x, plotTop);
                ctx.lineTo(x, plotTop + plotHeight);
                ctx.stroke();
            }

            // Horizontal lines
            for (let i = 0; i <= 5; i++) {
                const y = plotTop + (plotHeight / 5) * i;
                ctx.beginPath();
                ctx.moveTo(plotLeft, y);
                ctx.lineTo(plotLeft + plotWidth, y);
                ctx.stroke();
            }
        }

        // Draw axes
        ctx.strokeStyle = MAP_CONFIG.axisColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(plotLeft, plotTop);
        ctx.lineTo(plotLeft, plotTop + plotHeight);
        ctx.lineTo(plotLeft + plotWidth, plotTop + plotHeight);
        ctx.stroke();

        // Convert coordinates to canvas positions
        function toCanvasX(lon) {
            return plotLeft + ((lon - plotMinLon) / plotLonRange) * plotWidth;
        }

        function toCanvasY(lat) {
            // Invert Y axis (canvas Y increases downward, latitude increases upward)
            return plotTop + plotHeight - ((lat - plotMinLat) / plotLatRange) * plotHeight;
        }

        // Draw axis labels
        ctx.fillStyle = '#666666';
        ctx.font = `${MAP_CONFIG.axisFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Longitude', MAP_CONFIG.width / 2, MAP_CONFIG.height - 10);

        ctx.save();
        ctx.translate(15, MAP_CONFIG.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Latitude', 0, 0);
        ctx.restore();

        // Draw tick marks and values
        ctx.fillStyle = '#666666';
        ctx.font = `${MAP_CONFIG.axisFontSize}px Arial`;
        ctx.textAlign = 'center';

        // X-axis ticks (longitude)
        for (let i = 0; i <= 5; i++) {
            const lon = plotMinLon + (plotLonRange / 5) * i;
            const x = plotLeft + (plotWidth / 5) * i;
            const y = plotTop + plotHeight;

            // Tick mark
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 5);
            ctx.stroke();

            // Value
            ctx.fillText(lon.toFixed(1), x, y + 18);
        }

        // Y-axis ticks (latitude)
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const lat = plotMinLat + (plotLatRange / 5) * i;
            const x = plotLeft;
            const y = plotTop + plotHeight - (plotHeight / 5) * i;

            // Tick mark
            ctx.beginPath();
            ctx.moveTo(x - 5, y);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Value
            ctx.fillText(lat.toFixed(1), x - 8, y + 4);
        }

        // Draw points and labels
        points.forEach((point, idx) => {
            const x = toCanvasX(point.lon);
            const y = toCanvasY(point.lat);

            // Draw pin (circle)
            const color = MAP_CONFIG.pinColors[idx % MAP_CONFIG.pinColors.length];
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, MAP_CONFIG.pinRadius, 0, 2 * Math.PI);
            ctx.fill();

            // Draw label
            ctx.fillStyle = '#000000';
            ctx.font = `${MAP_CONFIG.fontSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText(point.name, x + MAP_CONFIG.labelOffset, y + 4);
        });

        // Save to file
        const buffer = canvas.toBuffer('image/png');
        writeFileSync(outputPath, buffer);
        logger.info(`Location plot saved to ${outputPath}`);

        return outputPath;

    } catch (error) {
        logger.error('Error generating location plot:', error);
        return null;
    }
}

/**
 * Add new location coordinates (for expanding the database)
 * @param {string} locationName - Name of the location
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 */
export function addLocationCoordinates(locationName, latitude, longitude) {
    ZIMBABWE_COORDINATES[locationName] = [latitude, longitude];
    logger.info(`Added coordinates for ${locationName}: [${latitude}, ${longitude}]`);
}

/**
 * Get all known locations
 * @returns {string[]} Array of location names
 */
export function getKnownLocations() {
    return Object.keys(ZIMBABWE_COORDINATES);
}

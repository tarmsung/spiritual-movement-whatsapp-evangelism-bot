import readline from 'readline';
import { createAssembly, getAllAssemblies, initializeDatabase } from '../database/db.js';
import { writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Prompt for user input
 */
function question(prompt) {
    return new Promise(resolve => {
        rl.question(prompt, resolve);
    });
}

/**
 * Main setup wizard
 */
async function runSetup() {
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║  WhatsApp Evangelism Bot - Setup Wizard  ║');
    console.log('╚═══════════════════════════════════════════╝\n');

    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('✓ Database initialized\n');

    // Check if .env exists
    const envPath = join(__dirname, '../../.env');
    const envExists = existsSync(envPath);

    if (envExists) {
        const overwrite = await question('.env file already exists. Overwrite? (yes/no): ');
        if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
            console.log('\n Skipping .env creation\n');
        } else {
            await setupEnvironment(envPath);
        }
    } else {
        await setupEnvironment(envPath);
    }

    // Setup clusters
    await setupAssemblies();

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║          Setup Complete! ✓                ║');
    console.log('╚═══════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('1. Review your .env file and add OpenAI API key (optional)');
    console.log('2. Run: npm start');
    console.log('3. Scan the QR code with WhatsApp');
    console.log('4. Test by sending: !evangelism\n');

    rl.close();
}

/**
 * Setup environment file
 */
async function setupEnvironment(envPath) {
    console.log('\n--- Environment Configuration ---\n');

    const churchName = await question('Church Name: ');
    const wakePhrase = await question('Wake Phrase (default: !evangelism): ') || '!evangelism';
    const adminNumbers = await question('Admin Phone Numbers (comma-separated, e.g., 1234567890,0987654321): ');

    // Format admin numbers
    const formattedAdmins = adminNumbers
        .split(',')
        .map(n => n.trim())
        .filter(n => n)
        .map(n => `${n}@s.whatsapp.net`)
        .join(',');

    const openaiKey = await question('OpenAI API Key (optional, press Enter to skip): ');

    // Create .env content
    const envContent = `# Church Information
CHURCH_NAME=${churchName}

# Bot Configuration
WAKE_PHRASE=${wakePhrase}
NODE_ENV=production

# Admin Configuration
ADMIN_NUMBERS=${formattedAdmins}

# OpenAI Configuration (Optional)
OPENAI_API_KEY=${openaiKey}

# Report Schedule (Cron format)
# Default: 0 9 1 * * (9 AM on the 1st of each month)
REPORT_SCHEDULE=0 9 1 * *

# Database Configuration
DATABASE_PATH=./data/evangelism.db

# Logging Configuration
LOG_LEVEL=info
`;

    writeFileSync(envPath, envContent);
    console.log('\n✓ .env file created\n');
}

/**
 * Setup assemblies
 */
async function setupAssemblies() {
    console.log('\n--- Cluster Configuration ---\n');
    console.log('You need to configure at least one cluster (church branch/group).\n');
    console.log('To get the WhatsApp Group ID:');
    console.log('1. Start the bot and scan QR code');
    console.log('2. Add the bot to your WhatsApp group');
    console.log('3. Check the bot logs for the group ID\n');
    console.log('For now, you can use placeholder IDs and update them later.\n');

    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('✓ Database initialized\n');

    // Check for existing assemblies
    const existingAssemblies = await getAllAssemblies();
    if (existingAssemblies.length > 0) {
        console.log('Existing clusters:');
        existingAssemblies.forEach(a => {
            console.log(`  - ${a.name} (${a.whatsapp_group_id})`);
        });
        console.log();
    }

    const addAssemblies = await question('Add clusters now? (yes/no): ');

    if (addAssemblies.toLowerCase() === 'yes' || addAssemblies.toLowerCase() === 'y') {
        let continueAdding = true;

        while (continueAdding) {
            const name = await question('Cluster Name: ');
            const groupId = await question('WhatsApp Group ID (or placeholder): ');

            try {
                await createAssembly(name, groupId);
                console.log(`✓ Added: ${name}\n`);
            } catch (error) {
                console.log(`✗ Error: ${error.message}\n`);
            }

            const addMore = await question('Add another cluster? (yes/no): ');
            continueAdding = addMore.toLowerCase() === 'yes' || addMore.toLowerCase() === 'y';
        }
    } else {
        console.log('\n You can add clusters later by running this setup again');
        console.log('or by directly inserting into the database.\n');
    }
}

// Run setup
runSetup().catch(error => {
    console.error('Setup error:', error);
    rl.close();
    process.exit(1);
});

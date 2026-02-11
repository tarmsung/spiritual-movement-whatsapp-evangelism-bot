/**
 * Get WhatsApp Group IDs
 * 
 * This script will help you find your group IDs.
 * 
 * INSTRUCTIONS:
 * 1. Make sure your bot is running (npm start)
 * 2. Send ANY message in your WhatsApp group
 * 3. Check the bot's console logs - it will show the group JID
 * 
 * The group JID looks like: 120363123456789012@g.us
 */

console.log('\n📱 HOW TO GET YOUR GROUP ID:\n');
console.log('='.repeat(80));
console.log('\n1. Your bot is currently running');
console.log('2. Go to your WhatsApp group');
console.log('3. Send ANY message (even just "hello")');
console.log('4. Look at the bot console logs\n');
console.log('You will see a line like:');
console.log('   [INFO] Message from 120363123456789012@g.us: hello\n');
console.log('The string ending with @g.us is your GROUP ID!\n');
console.log('='.repeat(80));
console.log('\n💡 ALTERNATIVE: Check the logs right now\n');

console.log('If someone has already sent a message in the group,');
console.log('you can see the group ID in the bot console output above.\n');
console.log('Look for lines that end with "@g.us"\n');
console.log('='.repeat(80));
console.log('\n📋 NEXT STEPS:\n');
console.log('Once you have the group ID, update your assembly:');
console.log('1. Stop the bot (Ctrl+C)');
console.log('2. Edit config.json or use setup wizard');
console.log('3. Replace "placeholder@g.us" with the real group ID');
console.log('4. Restart the bot\n');
console.log('='.repeat(80) + '\n');

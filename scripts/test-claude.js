import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const key = process.env.ANTHROPIC_API_KEY;

if (!key) {
    console.error('❌ ANTHROPIC_API_KEY not found in .env file!');
    process.exit(1);
}

console.log('🔑 API key found:', key.slice(0, 20) + '...');
console.log('🤖 Sending test prompt to Claude (claude-sonnet-4-6)...\n');

const anthropic = new Anthropic({ apiKey: key });

try {
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: 'You are an AI assistant for a church evangelism reporting bot.',
        messages: [
            {
                role: 'user',
                content: 'Respond with exactly: "Claude is generating this report. Model: claude-sonnet-4-6. Status: ✅ Ready."'
            }
        ]
    });

    const text = response.content[0].text;
    console.log('✅ Claude responded successfully!\n');
    console.log('─────────────────────────────────');
    console.log(text);
    console.log('─────────────────────────────────');
    console.log('\n📊 Response metadata:');
    console.log(`   Model used: ${response.model}`);
    console.log(`   Input tokens: ${response.usage.input_tokens}`);
    console.log(`   Output tokens: ${response.usage.output_tokens}`);
    console.log('\n🎉 Your bot reports are now powered by Claude!');
} catch (err) {
    console.error('❌ Claude API call failed:', err.message);
    process.exit(1);
}

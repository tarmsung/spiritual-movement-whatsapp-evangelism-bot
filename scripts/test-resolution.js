/**
 * scripts/test-resolution.js
 * 
 * Verifies that the getMembersByIds function correctly
 * retrieves and maps IDs to names.
 */

import { getMembersByIds } from '../src/database/db.js';
import logger from '../src/utils/logger.js';

async function test() {
    console.log('🧪 Testing Member ID Resolution...\n');
    
    const testIds = [1079, 1059, 1082, 9999]; // 9999 should not be found
    console.log(`Checking IDs: ${testIds.join(', ')}`);
    
    try {
        const results = await getMembersByIds(testIds);
        
        console.log('\nResults:');
        testIds.forEach(id => {
            if (results.has(id)) {
                console.log(`  ✅  ${id} → ${results.get(id)}`);
            } else {
                console.log(`  ❌  ${id} → NOT FOUND`);
            }
        });
        
        const expected = ['Kupakwashe Magamu', 'Irene Masaira', 'Memory Gwerere'];
        const found = Array.from(results.values());
        
        if (found.length === 3 && expected.every(name => found.includes(name))) {
            console.log('\n✨ PASS: Resolution logic works correctly.');
        } else {
            console.log('\n⚠️ FAIL: Unexpected resolution results.');
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

test().then(() => process.exit(0));

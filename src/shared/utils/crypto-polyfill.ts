/**
 * This file explicitly imports Node.js crypto module and
 * makes it available globally to fix the "crypto is not defined" error
 * in @nestjs/typeorm package
 */

import * as crypto from 'crypto';

// Simply export the crypto module for direct usage
export { crypto };

// Install crypto as a global if it's not already defined
if (typeof globalThis.crypto === 'undefined') {
    (globalThis as any).crypto = crypto;
}

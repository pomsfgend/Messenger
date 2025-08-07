
import path from 'path';
import { fileURLToPath } from 'url';

// By placing these in a separate file, we avoid circular dependency issues
// when other files need to know the root directory path.
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);
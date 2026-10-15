import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'mercado-pago-api.ts'),
  'utf8',
);

const FORBIDDEN = [
  /chrome\.storage/i,
  /indexedDB/i,
  /\bidb\b/,
  /localStorage\.(setItem|set)/,
  /sessionStorage\.(setItem|set)/,
  /document\.cookie\s*=/,
  /password\s*[:=]/i,
  /api[_-]?token/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
];

describe('mercado-pago-api does not persist credentials', () => {
  it('has no credential storage surface', () => {
    for (const pattern of FORBIDDEN) {
      expect(source, `matched ${pattern}`).not.toMatch(pattern);
    }
  });
});

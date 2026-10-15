import { describe, it, expect } from 'vitest';
import mercadoPagoImportSrc from './mercado-pago-import.ts?raw';
import mercadoPagoMapperSrc from './mercado-pago-mapper.ts?raw';
import useMercadoPagoImportSrc from '../ui/hooks/useMercadoPagoImport.ts?raw';
import mercadoPagoImportModalSrc from '../ui/components/MercadoPagoImportModal.tsx?raw';

/**
 * Negative evidence that the Mercado Pago feature surface does not persist
 * passwords, cookies, or API tokens (Import AC5 / MPAG-16).
 * Extension fetch surface is covered in extension/src/mercado-pago-api.credentials.test.ts.
 */
const FEATURE_SOURCES: ReadonlyArray<{ readonly name: string; readonly source: string }> = [
  { name: 'mercado-pago-import.ts', source: mercadoPagoImportSrc },
  { name: 'mercado-pago-mapper.ts', source: mercadoPagoMapperSrc },
  { name: 'useMercadoPagoImport.ts', source: useMercadoPagoImportSrc },
  { name: 'MercadoPagoImportModal.tsx', source: mercadoPagoImportModalSrc },
];

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

describe('Mercado Pago feature does not persist credentials', () => {
  it.each(FEATURE_SOURCES)('$name has no credential storage surface', ({ source, name }) => {
    for (const pattern of FORBIDDEN) {
      expect(source, `${name} matched ${pattern}`).not.toMatch(pattern);
    }
  });
});

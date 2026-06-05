import { describe, it, expect } from 'vitest';
import { generateVerificationChecksum, generateRecoverySheet } from './recovery-sheet.ts';

describe('recovery-sheet', () => {
  it('generates a deterministic checksum', async () => {
    const c1 = await generateVerificationChecksum('my-passphrase');
    const c2 = await generateVerificationChecksum('my-passphrase');
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('different passphrases produce different checksums', async () => {
    const c1 = await generateVerificationChecksum('passphrase-a');
    const c2 = await generateVerificationChecksum('passphrase-b');
    expect(c1).not.toBe(c2);
  });

  it('generates self-contained HTML', async () => {
    const html = await generateRecoverySheet('test-pass-123');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    expect(html).toContain('<style>');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<script');
  });

  it('includes the passphrase in the HTML', async () => {
    const html = await generateRecoverySheet('my-secret-pass');
    expect(html).toContain('my-secret-pass');
  });

  it('includes the verification checksum', async () => {
    const passphrase = 'checksum-test';
    const checksum = await generateVerificationChecksum(passphrase);
    const html = await generateRecoverySheet(passphrase);
    expect(html).toContain(checksum);
  });

  it('includes recovery instructions', async () => {
    const html = await generateRecoverySheet('test');
    expect(html).toContain('Recovery Instructions');
    expect(html).toContain('Restore existing vault');
    expect(html).toContain('Google Drive');
    expect(html).toContain('WebDAV');
  });

  it('includes app name and generation date', async () => {
    const html = await generateRecoverySheet('test');
    expect(html).toContain('mytruetrack');
    // Date format YYYY-MM-DD
    expect(html).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('escapes HTML special characters in passphrase', async () => {
    const html = await generateRecoverySheet('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});

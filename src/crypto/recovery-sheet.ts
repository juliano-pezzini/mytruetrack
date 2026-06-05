/**
 * Recovery sheet — generates a self-contained printable HTML page
 * with the user's passphrase and recovery instructions.
 */

const encoder = new TextEncoder();

/**
 * Generate a verification checksum from the passphrase.
 * Uses truncated SHA-256 (first 8 hex chars) — enough to verify
 * correct entry without exposing the full passphrase.
 */
export async function generateVerificationChecksum(passphrase: string): Promise<string> {
  const data = encoder.encode(passphrase);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a self-contained printable HTML recovery sheet.
 * Includes passphrase (hidden by default), verification checksum,
 * and recovery instructions.
 */
export async function generateRecoverySheet(passphrase: string): Promise<string> {
  const checksum = await generateVerificationChecksum(passphrase);
  const date = new Date().toISOString().split('T')[0];
  const escapedPassphrase = escapeHtml(passphrase);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>mytruetrack — Recovery Sheet</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #1a1a1a; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  .subtitle { color: #666; margin-bottom: 32px; font-size: 14px; }
  .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .warning strong { color: #856404; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 18px; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .passphrase-box { background: #f8f9fa; border: 2px dashed #6c757d; border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace; font-size: 18px; word-break: break-all; margin: 8px 0; }
  .checksum { font-family: 'Courier New', monospace; font-size: 16px; background: #e9ecef; padding: 4px 12px; border-radius: 4px; }
  .instructions li { margin-bottom: 8px; line-height: 1.5; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #888; }
  @media print { body { margin: 20px; } .warning { break-inside: avoid; } }
</style>
</head>
<body>
<h1>mytruetrack — Recovery Sheet</h1>
<p class="subtitle">Generated on ${date}</p>

<div class="warning">
  <strong>KEEP THIS SAFE.</strong> This sheet is the only way to recover your data if you forget your passphrase. Store it in a secure location (e.g., safe, lockbox). Anyone with this passphrase can decrypt your financial data.
</div>

<div class="section">
  <h2>Your Passphrase</h2>
  <div class="passphrase-box">${escapedPassphrase}</div>
</div>

<div class="section">
  <h2>Verification Checksum</h2>
  <p>When re-entering your passphrase, verify this checksum matches: <span class="checksum">${checksum}</span></p>
</div>

<div class="section">
  <h2>Recovery Instructions</h2>
  <ol class="instructions">
    <li>Open mytruetrack in your browser.</li>
    <li>If prompted for setup, choose <strong>"Restore existing vault"</strong>.</li>
    <li>Enter the passphrase shown above exactly as printed.</li>
    <li>Verify the checksum displayed matches: <span class="checksum">${checksum}</span></li>
    <li>Connect your cloud storage (Google Drive or WebDAV) to download your encrypted data.</li>
    <li>Your data will be decrypted locally and restored.</li>
  </ol>
</div>

<div class="footer">
  <p>mytruetrack — local-first personal finance. Your data, your keys, your control.</p>
  <p>This document contains sensitive information. Destroy it securely when no longer needed.</p>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

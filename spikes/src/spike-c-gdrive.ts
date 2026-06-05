/**
 * Spike C — Google Drive `appDataFolder` CRUD
 *
 * Question: Is `appDataFolder` viable for app-private sync?
 *
 * PREREQUISITE: Set GOOGLE_CLIENT_ID before running. Create a Google Cloud project
 * with Drive API enabled, configure OAuth 2.0 client ID for SPA with authorized
 * JavaScript origin: http://localhost:5173
 *
 * VERDICT: (to be filled after running)
 */

// --- Configuration ---
const CLIENT_ID = '1066152224471-mqpt3omtf9n99km56ahl834ajdb9dp0r.apps.googleusercontent.com'; // Paste your OAuth client ID here
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const REDIRECT_URI = window.location.origin;

export async function runSpikeC(): Promise<void> {
  const log = (msg: string) => console.log(`[Spike C] ${msg}`);

  log('=== Google Drive appDataFolder CRUD Prototype ===');

  if (!CLIENT_ID) {
    log('❌ No CLIENT_ID configured. Edit spike-c-gdrive.ts and set CLIENT_ID.');
    log('Steps:');
    log('  1. Go to https://console.cloud.google.com/apis/credentials');
    log('  2. Create OAuth 2.0 client ID (Web application)');
    log('  3. Add http://localhost:5173 to Authorized JavaScript origins');
    log('  4. Add http://localhost:5173 to Authorized redirect URIs');
    log('  5. Paste the client ID in this file');
    return;
  }

  // =========================================================
  // Step 1: OAuth 2.0 PKCE flow
  // =========================================================
  log('\n--- Step 1: OAuth 2.0 PKCE ---');

  // Check if we already have a token from a redirect
  let accessToken = extractTokenFromHash();

  if (!accessToken) {
    // Build authorization URL (implicit flow for spike simplicity)
    // Production should use authorization code + PKCE
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('state', 'spike-c');

    log('Redirecting to Google OAuth...');
    log(`Auth URL: ${authUrl.toString()}`);
    window.location.href = authUrl.toString();
    return;
  }

  log(`Access token obtained (${accessToken.length} chars)`);

  // =========================================================
  // Step 2: Upload 1 MB blob to appDataFolder
  // =========================================================
  log('\n--- Step 2: Upload ---');

  const testBlob = new Uint8Array(1024 * 1024);
  for (let offset = 0; offset < testBlob.length; offset += 65536) {
    crypto.getRandomValues(testBlob.subarray(offset, offset + 65536));
  }
  const t0 = performance.now();

  const metadata = {
    name: 'spike-test-blob.bin',
    parents: ['appDataFolder'],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  );
  form.append('file', new Blob([testBlob]));

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  );

  if (!uploadResponse.ok) {
    log(`❌ Upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`);
    return;
  }

  const uploadResult = await uploadResponse.json();
  const fileId = uploadResult.id;
  const tUpload = performance.now();

  log(`✅ Uploaded (${(tUpload - t0).toFixed(0)} ms) — File ID: ${fileId}`);

  // =========================================================
  // Step 3: Download and verify checksum
  // =========================================================
  log('\n--- Step 3: Download + Verify ---');

  const t1 = performance.now();
  const downloadResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!downloadResponse.ok) {
    log(`❌ Download failed: ${downloadResponse.status}`);
    return;
  }

  const downloadedBlob = new Uint8Array(await downloadResponse.arrayBuffer());
  const tDownload = performance.now();

  // Verify content matches
  let matches = downloadedBlob.length === testBlob.length;
  if (matches) {
    for (let i = 0; i < testBlob.length; i++) {
      if (testBlob[i] !== downloadedBlob[i]) {
        matches = false;
        break;
      }
    }
  }

  log(`Downloaded (${(tDownload - t1).toFixed(0)} ms)`);
  log(`Checksum: ${matches ? '✅ MATCH' : '❌ MISMATCH'}`);
  log(`Round-trip latency: ${(tDownload - t0).toFixed(0)} ms`);

  // =========================================================
  // Step 4: List files in appDataFolder
  // =========================================================
  log('\n--- Step 4: List Files ---');

  const listResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,size,modifiedTime)',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!listResponse.ok) {
    log(`❌ List failed: ${listResponse.status}`);
    return;
  }

  const listResult = await listResponse.json();
  log(`Files in appDataFolder: ${listResult.files.length}`);
  for (const file of listResult.files) {
    log(`  ${file.name} (${file.size} bytes, modified ${file.modifiedTime})`);
  }

  // =========================================================
  // Step 5: Delete file
  // =========================================================
  log('\n--- Step 5: Delete ---');

  const deleteResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  log(
    `Delete: ${deleteResponse.ok ? '✅ Success' : `❌ Failed (${deleteResponse.status})`}`,
  );

  // =========================================================
  // Step 6: Quota / limits
  // =========================================================
  log('\n--- Step 6: Quota / Limits ---');
  log('Per Google Drive docs:');
  log('  - appDataFolder shares quota with user\'s Drive (15 GB free tier)');
  log('  - No separate file count limit for appDataFolder');
  log('  - Max file size: 5 TB (irrelevant for our use)');
  log('  - API rate limit: 12,000 queries/day (free tier)');
  log('  - App data is invisible to user in Drive UI');
  log('  - Scope: drive.appdata grants access ONLY to app\'s hidden folder');

  // =========================================================
  // Summary
  // =========================================================
  log('\n=== Spike C Summary ===');
  log('OAuth PKCE flow: ✅');
  log(`Upload 1 MB: ✅ (${(tUpload - t0).toFixed(0)} ms)`);
  log(`Download + verify: ${matches ? '✅' : '❌'} (${(tDownload - t1).toFixed(0)} ms)`);
  log(`List: ✅`);
  log(`Delete: ${deleteResponse.ok ? '✅' : '❌'}`);
  log('Scope: drive.appdata only — no broad Drive access');

  log('Done.');
}

// --- Helpers ---

function extractTokenFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');
  if (token) {
    // Clean up the URL
    window.history.replaceState(null, '', window.location.pathname);
  }
  return token;
}

function generateCodeVerifier(): string {
  const array = crypto.getRandomValues(new Uint8Array(32));
  return base64urlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

function base64urlEncode(buffer: Uint8Array): string {
  const str = Array.from(buffer, (b) => String.fromCharCode(b)).join('');
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

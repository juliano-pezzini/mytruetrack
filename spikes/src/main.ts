import { runSpikeA } from './spike-a-crsqlite.ts';
import { runSpikeB } from './spike-b-crypto-auth.ts';
import { runSpikeC } from './spike-c-gdrive.ts';
import { runSpikeD } from './spike-d-ofx.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <h1>mytruetrack — Architecture Spikes</h1>
  <p>Open the browser console to see spike output.</p>
  <div id="controls">
    <button data-spike="a">Spike A: cr-sqlite</button>
    <button data-spike="b">Spike B: Crypto + WebAuthn</button>
    <button data-spike="c">Spike C: Google Drive</button>
    <button data-spike="d">Spike D: OFX Parsing</button>
  </div>
  <pre id="output"></pre>
`;

const spikes: Record<string, () => Promise<void>> = {
  a: runSpikeA,
  b: runSpikeB,
  c: runSpikeC,
  d: runSpikeD,
};

document.querySelectorAll<HTMLButtonElement>('[data-spike]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const spike = btn.dataset.spike!;
    const runner = spikes[spike];
    if (runner) {
      btn.disabled = true;
      btn.textContent += ' (running...)';
      try {
        await runner();
      } catch (err) {
        console.error(`[Spike ${spike.toUpperCase()}] Fatal error:`, err);
      } finally {
        btn.disabled = false;
        btn.textContent = btn.textContent!.replace(' (running...)', '');
      }
    }
  });
});

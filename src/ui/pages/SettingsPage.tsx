import { ImportSection } from '../components/ImportSection.tsx';
import { SyncSection } from '../components/SyncSection.tsx';

export function SettingsPage() {
  return (
    <div className="space-y-8">
      {/* Import */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Import Statement</h2>
        <ImportSection />
      </section>

      {/* Sync */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Cloud Sync</h2>
        <SyncSection />
      </section>

      {/* Security placeholder */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Security</h2>
        <p className="text-sm text-gray-500">Passphrase &amp; biometric unlock — coming soon.</p>
      </section>

      {/* About */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">About</h2>
        <p className="text-sm text-gray-500">mytruetrack v2.0.0-alpha</p>
      </section>
    </div>
  );
}

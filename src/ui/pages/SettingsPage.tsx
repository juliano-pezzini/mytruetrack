import { ImportSection } from '../components/ImportSection.tsx';
import { SyncSection } from '../components/SyncSection.tsx';
import { SecuritySection } from '../components/SecuritySection.tsx';

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

      {/* Security */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Security</h2>
        <SecuritySection />
      </section>

      {/* About */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">About</h2>
        <p className="text-sm text-gray-500">mytruetrack v2.0.0-alpha</p>
      </section>
    </div>
  );
}

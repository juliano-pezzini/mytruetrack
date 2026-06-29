import { Link } from 'react-router-dom';
import { SyncSection } from '../components/SyncSection.tsx';
import { SecuritySection } from '../components/SecuritySection.tsx';
import { THEMES, useTheme, type ThemeId } from '../context/ThemeContext.tsx';

function ThemeCard({
  label,
  description,
  preview,
  selected,
  onSelect,
}: {
  id: ThemeId;
  label: string;
  description: string;
  preview: { sidebar: string; surface: string; accent: string };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex flex-col gap-0 rounded-xl border-2 overflow-hidden text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-mtt-accent ${
        selected ? 'border-mtt-accent shadow-md' : 'border-mtt-border hover:border-mtt-muted'
      }`}
    >
      {/* Mini preview */}
      <div className="flex h-20 w-full" style={{ background: preview.surface }}>
        {/* Sidebar strip */}
        <div
          className="w-10 h-full flex flex-col gap-1.5 items-center pt-3"
          style={{ background: preview.sidebar }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-5 h-1 rounded-sm"
              style={{
                background: i === 0 ? preview.accent : `${preview.accent}40`,
                width: i === 0 ? '20px' : '16px',
              }}
            />
          ))}
        </div>
        {/* Content area */}
        <div className="flex-1 p-3 flex flex-col gap-2">
          <div className="h-5 rounded-md w-3/4" style={{ background: preview.sidebar + '18' }} />
          <div className="flex gap-1.5">
            <div className="h-8 rounded flex-1" style={{ background: preview.sidebar + '10' }} />
            <div className="h-8 rounded flex-1" style={{ background: preview.sidebar + '10' }} />
          </div>
          <div className="mt-auto flex items-center gap-1.5">
            <div
              className="h-2 rounded-full"
              style={{ background: preview.accent, width: '40%' }}
            />
            <div
              className="h-2 rounded-full"
              style={{ background: preview.accent + '30', width: '20%' }}
            />
          </div>
        </div>
      </div>
      {/* Label */}
      <div className="px-3 py-2.5 bg-mtt-surface border-t border-mtt-border">
        <p className="text-sm font-semibold text-mtt-fg leading-none mb-0.5">{label}</p>
        <p className="text-xs text-mtt-muted leading-snug">{description}</p>
      </div>
      {/* Selected checkmark */}
      {selected && (
        <span
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: preview.accent }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 6l3 3 5-5" />
          </svg>
        </span>
      )}
    </button>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8">
      {/* Appearance */}
      <section>
        <h2 className="text-lg font-semibold text-mtt-fg mb-1">Appearance</h2>
        <p className="text-sm text-mtt-muted mb-4">Choose a visual theme for your workspace.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              {...t}
              selected={theme === t.id}
              onSelect={() => setTheme(t.id)}
            />
          ))}
        </div>
      </section>

      {/* Sync */}
      <section>
        <h2 className="text-lg font-semibold text-mtt-fg mb-4">Cloud Sync</h2>
        <SyncSection />
      </section>

      {/* Security */}
      <section>
        <h2 className="text-lg font-semibold text-mtt-fg mb-4">Security</h2>
        <SecuritySection />
      </section>

      {/* Integrations */}
      <section>
        <h2 className="text-lg font-semibold text-mtt-fg mb-1">Integrations</h2>
        <p className="text-sm text-mtt-muted mb-4">Connect external services to import data.</p>
        <Link
          to="/import/investpass"
          className="inline-flex items-center gap-2 rounded-lg border border-mtt-border bg-mtt-surface px-4 py-3 text-sm font-medium text-mtt-fg hover:border-mtt-accent transition-colors"
        >
          <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-mtt-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          InvestPass Import
        </Link>
      </section>

      {/* About */}
      <section>
        <h2 className="text-lg font-semibold text-mtt-fg mb-2">About</h2>
        <p className="text-sm text-mtt-muted">mytruetrack v2.0.0-alpha</p>
      </section>
    </div>
  );
}

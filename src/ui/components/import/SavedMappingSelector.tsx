import { useEffect, useState } from 'react';
import {
  listMappingsForAccount,
  saveMapping,
  touchMapping,
  deleteMapping,
} from '../../../storage/import-mappings.ts';
import type { ColumnMapping, SavedMapping } from '../../../workers/types.ts';

type SavedMappingSelectorProps = {
  accountId: string;
  currentConfig: ColumnMapping;
  onLoad: (config: ColumnMapping) => void;
};

/** Load previously-saved column mappings and save the current one for reuse. */
export function SavedMappingSelector({
  accountId,
  currentConfig,
  onLoad,
}: SavedMappingSelectorProps) {
  const [mappings, setMappings] = useState<SavedMapping[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    void listMappingsForAccount(accountId).then(setMappings);
  };

  useEffect(refresh, [accountId]);

  async function handleSave() {
    if (name.trim() === '') return;
    setSaving(true);
    try {
      await saveMapping({ name, config: currentConfig, accountId });
      setName('');
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleLoad(m: SavedMapping) {
    onLoad(m.config);
    await touchMapping(m.id);
    refresh();
  }

  async function handleDelete(id: string) {
    await deleteMapping(id);
    refresh();
  }

  return (
    <div className="space-y-2 border-t border-gray-200 pt-3">
      {mappings.length > 0 && (
        <div className="space-y-1" data-testid="saved-mappings">
          <span className="block text-sm font-medium text-gray-700">Saved mappings</span>
          <ul className="space-y-1">
            {mappings.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => void handleLoad(m)}
                  className="text-blue-700 hover:underline"
                >
                  {m.name}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(m.id)}
                  className="text-gray-400 hover:text-red-600 text-xs"
                  aria-label={`Delete ${m.name}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-700 mb-1">Save this mapping</span>
          <input
            type="text"
            value={name}
            placeholder="e.g. Itaú checking"
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={name.trim() === '' || saving}
          className="px-3 py-2 text-sm font-medium text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

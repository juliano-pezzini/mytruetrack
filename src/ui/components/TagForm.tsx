import { useState } from 'react';
import type { CreateTagParams } from '../../domain/tag.ts';
import { SUGGESTED_TAG_COLORS } from '../../domain/tag.ts';

type TagFormProps = {
  onSubmit: (params: CreateTagParams) => void;
  onCancel: () => void;
  initial?: {
    name: string;
    color: string;
  };
  suggestedColor?: string;
  submitLabel?: string;
};

export function TagForm({
  onSubmit,
  onCancel,
  initial,
  suggestedColor,
  submitLabel = 'Create',
}: TagFormProps) {
  const defaultColor = initial?.color ?? suggestedColor ?? SUGGESTED_TAG_COLORS[0]!;
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(defaultColor);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      onSubmit({
        id: crypto.randomUUID(),
        name,
        color,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div>
          <label htmlFor="tag-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="tag-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label htmlFor="tag-color" className="block text-sm font-medium text-gray-700 mb-1">
            Color
          </label>
          <input
            id="tag-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-[38px] w-12 border border-gray-300 rounded-lg cursor-pointer"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

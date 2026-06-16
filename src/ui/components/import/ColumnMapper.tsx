import type { AmountStrategy, ColumnMapping } from '../../../workers/types.ts';
import type { NumberFormat } from '../../../domain/number-format.ts';

type ColumnMapperProps = {
  headers: readonly string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
};

function headerLabel(headers: readonly string[], index: number): string {
  const h = headers[index]?.trim();
  return h && h !== '' ? h : `Column ${index + 1}`;
}

type ColumnSelectProps = {
  label: string;
  headers: readonly string[];
  value: number | null;
  onChange: (value: number | null) => void;
  testId?: string;
};

function ColumnSelect({ label, headers, value, onChange, testId }: ColumnSelectProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <select
        data-testid={testId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">— Select column —</option>
        {headers.map((_, i) => (
          <option key={i} value={i}>
            {headerLabel(headers, i)}
          </option>
        ))}
      </select>
    </label>
  );
}

const STRATEGIES: ReadonlyArray<{ value: AmountStrategy; label: string }> = [
  { value: 'single', label: 'Single amount column (negative = debit)' },
  { value: 'separate', label: 'Separate debit & credit columns' },
  { value: 'type_column', label: 'Amount column + type column' },
];

/**
 * Lets the user map spreadsheet/CSV columns to transaction fields and choose how
 * credit/debit is encoded plus the decimal number format.
 */
export function ColumnMapper({ headers, mapping, onChange }: ColumnMapperProps) {
  const set = (patch: Partial<ColumnMapping>) => onChange({ ...mapping, ...patch });

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Amount format</legend>
        <div className="space-y-1">
          {STRATEGIES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="amount-strategy"
                value={s.value}
                checked={mapping.amountStrategy === s.value}
                onChange={() => set({ amountStrategy: s.value })}
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ColumnSelect
          label="Date column"
          headers={headers}
          value={mapping.dateColumn}
          onChange={(v) => v != null && set({ dateColumn: v })}
          testId="map-date"
        />
        <ColumnSelect
          label="Description column"
          headers={headers}
          value={mapping.descriptionColumn}
          onChange={(v) => v != null && set({ descriptionColumn: v })}
          testId="map-description"
        />

        {mapping.amountStrategy === 'separate' ? (
          <>
            <ColumnSelect
              label="Debit column"
              headers={headers}
              value={mapping.debitColumn}
              onChange={(v) => set({ debitColumn: v })}
              testId="map-debit"
            />
            <ColumnSelect
              label="Credit column"
              headers={headers}
              value={mapping.creditColumn}
              onChange={(v) => set({ creditColumn: v })}
              testId="map-credit"
            />
          </>
        ) : (
          <ColumnSelect
            label="Amount column"
            headers={headers}
            value={mapping.amountColumn}
            onChange={(v) => set({ amountColumn: v })}
            testId="map-amount"
          />
        )}

        {mapping.amountStrategy === 'type_column' && (
          <ColumnSelect
            label="Type column"
            headers={headers}
            value={mapping.typeColumn}
            onChange={(v) => set({ typeColumn: v })}
            testId="map-type"
          />
        )}

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Number format</span>
          <select
            data-testid="map-number-format"
            value={mapping.numberFormat}
            onChange={(e) => set({ numberFormat: e.target.value as NumberFormat })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="us">1,234.56 (US)</option>
            <option value="eu">1.234,56 (EU / BR)</option>
          </select>
        </label>
      </div>
    </div>
  );
}

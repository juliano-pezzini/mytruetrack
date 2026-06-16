type StrengthMeterProps = {
  readonly passphrase: string;
};

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

function getStrengthLevel(passphrase: string): { level: StrengthLevel; label: string } {
  const len = passphrase.length;
  if (len === 0) return { level: 0, label: '' };
  if (len < 8)  return { level: 1, label: 'Too short' };
  if (len < 12) return { level: 2, label: 'Weak' };
  if (len < 16) return { level: 3, label: 'Fair' };
  return { level: 4, label: 'Strong' };
}

const SEGMENT_COLORS: Record<StrengthLevel, string> = {
  0: 'bg-mtt-border',
  1: 'bg-red-500',
  2: 'bg-orange-400',
  3: 'bg-yellow-400',
  4: 'bg-mtt-positive',
};

const LABEL_COLORS: Record<StrengthLevel, string> = {
  0: 'text-mtt-muted',
  1: 'text-red-600',
  2: 'text-orange-500',
  3: 'text-yellow-600',
  4: 'text-mtt-positive',
};

export function StrengthMeter({ passphrase }: StrengthMeterProps) {
  const { level, label } = getStrengthLevel(passphrase);

  if (passphrase.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {([1, 2, 3, 4] as const).map((seg) => (
          <div
            key={seg}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              seg <= level ? SEGMENT_COLORS[level] : 'bg-mtt-border'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs mt-1 font-medium ${LABEL_COLORS[level]}`}>{label}</p>
    </div>
  );
}

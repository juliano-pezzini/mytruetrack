type StrengthMeterProps = {
  readonly passphrase: string;
};

function getStrength(passphrase: string): { label: string; color: string; width: string } {
  const len = passphrase.length;
  if (len === 0) return { label: '', color: 'bg-gray-200', width: 'w-0' };
  if (len < 8) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' };
  if (len < 12) return { label: 'Weak', color: 'bg-orange-500', width: 'w-1/3' };
  if (len < 16) return { label: 'Medium', color: 'bg-yellow-500', width: 'w-2/3' };
  return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
}

export function StrengthMeter({ passphrase }: StrengthMeterProps) {
  const { label, color, width } = getStrength(passphrase);

  if (passphrase.length === 0) return null;

  return (
    <div className="mt-1">
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} ${width} transition-all duration-300 rounded-full`} />
      </div>
      <p className={`text-xs mt-0.5 ${passphrase.length < 8 ? 'text-red-600' : 'text-gray-500'}`}>
        {label}
      </p>
    </div>
  );
}

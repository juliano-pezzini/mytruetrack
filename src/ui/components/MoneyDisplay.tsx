import { toCents, format } from '../../domain/money.ts';
import type { Money } from '../../domain/money.ts';

type MoneyDisplayProps = {
  amount: Money;
  className?: string;
};

export function MoneyDisplay({ amount, className = '' }: MoneyDisplayProps) {
  const cents = toCents(amount);
  const colorClass = cents < 0 ? 'text-red-600' : 'text-gray-900';

  return (
    <span className={`font-mono tabular-nums ${colorClass} ${className}`}>
      {format(amount)}
    </span>
  );
}

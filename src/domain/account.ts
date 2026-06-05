/**
 * Account — financial account with type-safe account types.
 *
 * Account types: bank, credit_card, wallet, transitional.
 * initialBalance is immutable after creation.
 */

import type { Money } from './money.ts';

export type AccountType = 'bank' | 'credit_card' | 'wallet' | 'transitional';

export type Account = Readonly<{
  id: string;
  name: string;
  type: AccountType;
  initialBalance: Money;
  isActive: boolean;
  description: string | null;
}>;

export type CreateAccountParams = {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: Money;
  isActive?: boolean;
  description?: string | null;
};

export function createAccount(params: CreateAccountParams): Account {
  const name = params.name.trim();
  if (name === '') {
    throw new Error('Account name is required');
  }

  return {
    id: params.id,
    name,
    type: params.type,
    initialBalance: params.initialBalance,
    isActive: params.isActive ?? true,
    description: params.description ?? null,
  };
}

/** Exhaustive check helper for AccountType */
export function assertAccountType(type: AccountType): void {
  switch (type) {
    case 'bank':
    case 'credit_card':
    case 'wallet':
    case 'transitional':
      break;
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown account type: ${_exhaustive}`);
    }
  }
}

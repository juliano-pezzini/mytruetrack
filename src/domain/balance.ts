/**
 * Balance — pure functions for account balance calculation and monthly snapshots.
 *
 * Formula: balance(date) = base_balance + sum(credits) - sum(debits)
 *   where base_balance = most recent snapshot's closingBalance before date,
 *   or account.initialBalance if no snapshot exists.
 *
 * Monthly snapshots are stored in account_balances for efficient historical queries.
 */

import type { Money } from './money.ts';
import type { Account } from './account.ts';
import type { Transaction } from './transaction.ts';
import { add, subtract, ZERO } from './money.ts';

/** Monthly balance snapshot */
export type AccountBalance = Readonly<{
  accountId: string;
  year: number;
  month: number; // 1–12
  closingBalance: Money;
}>;

/**
 * Calculate account balance at a target date.
 *
 * @param account - The account (for initialBalance fallback)
 * @param transactions - All relevant transactions (filtered externally or not)
 * @param snapshots - Available monthly snapshots for this account
 * @param targetDate - ISO date string (YYYY-MM-DD) to calculate balance at
 * @returns The balance at targetDate
 */
export function calculateBalance(
  account: Account,
  transactions: readonly Transaction[],
  snapshots: readonly AccountBalance[],
  targetDate: string,
): Money {
  const target = parseDate(targetDate);

  // Find the most recent snapshot on or before the target date
  const baseSnapshot = findMostRecentSnapshot(snapshots, target);

  let base: Money;
  let startDate: string;

  if (baseSnapshot) {
    base = baseSnapshot.closingBalance;
    // Start accumulating from the day after the snapshot month ends
    startDate = monthEnd(baseSnapshot.year, baseSnapshot.month);
  } else {
    base = account.initialBalance;
    // Accumulate all transactions up to target
    startDate = '';
  }

  // Sum transactions in range (startDate, targetDate]
  let balance = base;
  for (const txn of transactions) {
    if (txn.accountId !== account.id) continue;
    if (txn.transactionDate <= startDate) continue;
    if (txn.transactionDate > targetDate) continue;

    if (txn.type === 'credit') {
      balance = add(balance, txn.amount);
    } else {
      balance = subtract(balance, txn.amount);
    }
  }

  return balance;
}

/**
 * Compute the closing balance snapshot for a specific month.
 *
 * @param account - The account
 * @param transactions - All relevant transactions
 * @param snapshots - Existing snapshots (to find previous month's base)
 * @param year - Target year
 * @param month - Target month (1–12)
 * @returns The computed AccountBalance for this month
 */
export function computeMonthSnapshot(
  account: Account,
  transactions: readonly Transaction[],
  snapshots: readonly AccountBalance[],
  year: number,
  month: number,
): AccountBalance {
  // Find previous month's snapshot as base
  const prevSnapshot = findPreviousMonthSnapshot(snapshots, year, month);

  let base: Money;
  let startDate: string;

  if (prevSnapshot) {
    base = prevSnapshot.closingBalance;
    startDate = monthEnd(prevSnapshot.year, prevSnapshot.month);
  } else {
    base = account.initialBalance;
    startDate = '';
  }

  const endDate = monthEnd(year, month);

  // Sum transactions for this month
  let closing = base;
  for (const txn of transactions) {
    if (txn.accountId !== account.id) continue;
    if (txn.transactionDate <= startDate) continue;
    if (txn.transactionDate > endDate) continue;

    if (txn.type === 'credit') {
      closing = add(closing, txn.amount);
    } else {
      closing = subtract(closing, txn.amount);
    }
  }

  return {
    accountId: account.id,
    year,
    month,
    closingBalance: closing,
  };
}

/**
 * Compute the net change (credits - debits) for a list of transactions.
 */
export function netChange(transactions: readonly Transaction[]): Money {
  let result = ZERO;
  for (const txn of transactions) {
    if (txn.type === 'credit') {
      result = add(result, txn.amount);
    } else {
      result = subtract(result, txn.amount);
    }
  }
  return result;
}

// --- Internal helpers ---

function parseDate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
}

function monthEnd(year: number, month: number): string {
  // Last day of the month
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function findMostRecentSnapshot(
  snapshots: readonly AccountBalance[],
  target: { year: number; month: number },
): AccountBalance | null {
  let best: AccountBalance | null = null;

  for (const snap of snapshots) {
    // Snapshot must be on or before the target month
    if (snap.year > target.year) continue;
    if (snap.year === target.year && snap.month > target.month) continue;

    if (!best || snap.year > best.year || (snap.year === best.year && snap.month > best.month)) {
      best = snap;
    }
  }

  return best;
}

function findPreviousMonthSnapshot(
  snapshots: readonly AccountBalance[],
  year: number,
  month: number,
): AccountBalance | null {
  // Find snapshot for the month immediately before (year, month)
  // Walk backwards to find the most recent one strictly before this month
  let best: AccountBalance | null = null;

  for (const snap of snapshots) {
    if (snap.year > year) continue;
    if (snap.year === year && snap.month >= month) continue;

    if (!best || snap.year > best.year || (snap.year === best.year && snap.month > best.month)) {
      best = snap;
    }
  }

  return best;
}

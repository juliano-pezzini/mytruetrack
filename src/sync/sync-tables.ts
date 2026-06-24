/**
 * The set of tables that participate in sync, in dependency-safe insertion order.
 *
 * Kept in its own dependency-free module so database initialization (`storage/init.ts`)
 * can read it without pulling in the cloud delta-sync implementation and its crypto/
 * sync-state dependencies.
 */
export const SYNC_TABLES = [
  'accounts',
  'categories',
  'tags',
  'transactions',
  'transaction_tags',
  'account_balances',
  'auto_category_rules',
  'learned_category_patterns',
  'auto_category_corrections',
] as const;

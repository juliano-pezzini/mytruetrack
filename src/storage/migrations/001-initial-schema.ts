import type { Migration } from './types.ts';

export const migration001: Migration = {
  version: 1,
  name: 'initial-schema',
  up: [
    // accounts
    `CREATE TABLE accounts (
      id              TEXT PRIMARY KEY NOT NULL,
      name            TEXT NOT NULL DEFAULT '',
      type            TEXT NOT NULL DEFAULT 'bank',
      initial_balance INTEGER NOT NULL DEFAULT 0,
      is_active       INTEGER NOT NULL DEFAULT 1,
      description     TEXT DEFAULT ''
    )`,

    // categories
    `CREATE TABLE categories (
      id          TEXT PRIMARY KEY NOT NULL,
      parent_id   TEXT DEFAULT '',
      name        TEXT NOT NULL DEFAULT '',
      type        TEXT NOT NULL DEFAULT 'expense',
      description TEXT DEFAULT ''
    )`,

    // tags
    `CREATE TABLE tags (
      id    TEXT PRIMARY KEY NOT NULL,
      name  TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#808080'
    )`,

    // transactions
    `CREATE TABLE transactions (
      id               TEXT PRIMARY KEY NOT NULL,
      account_id       TEXT NOT NULL DEFAULT '',
      category_id      TEXT DEFAULT '',
      amount           INTEGER NOT NULL DEFAULT 0,
      description      TEXT NOT NULL DEFAULT '',
      transaction_date TEXT NOT NULL DEFAULT '',
      settled_date     TEXT DEFAULT '',
      type             TEXT NOT NULL DEFAULT 'debit',
      external_id      TEXT DEFAULT ''
    )`,

    // transaction ↔ tag junction
    `CREATE TABLE transaction_tags (
      transaction_id TEXT NOT NULL DEFAULT '',
      tag_id         TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (transaction_id, tag_id)
    )`,

    // monthly balance snapshots
    `CREATE TABLE account_balances (
      account_id      TEXT NOT NULL DEFAULT '',
      year            INTEGER NOT NULL DEFAULT 0,
      month           INTEGER NOT NULL DEFAULT 0,
      closing_balance INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (account_id, year, month)
    )`,

    // auto-categorization rules
    `CREATE TABLE auto_category_rules (
      id          TEXT PRIMARY KEY NOT NULL,
      pattern     TEXT NOT NULL DEFAULT '',
      category_id TEXT NOT NULL DEFAULT '',
      priority    INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1
    )`,

    // learned categorization patterns
    `CREATE TABLE learned_category_patterns (
      id               TEXT PRIMARY KEY NOT NULL,
      category_id      TEXT NOT NULL DEFAULT '',
      keyword          TEXT NOT NULL DEFAULT '',
      occurrence_count INTEGER NOT NULL DEFAULT 0,
      confidence_score INTEGER NOT NULL DEFAULT 0,
      first_learned_at TEXT NOT NULL DEFAULT '',
      last_matched_at  TEXT DEFAULT '',
      is_active        INTEGER NOT NULL DEFAULT 1
    )`,

    // auto-categorization corrections
    `CREATE TABLE auto_category_corrections (
      id                      TEXT PRIMARY KEY NOT NULL,
      transaction_id          TEXT NOT NULL DEFAULT '',
      original_category_id    TEXT DEFAULT '',
      corrected_category_id   TEXT NOT NULL DEFAULT '',
      description_text        TEXT NOT NULL DEFAULT '',
      correction_type         TEXT NOT NULL DEFAULT 'manual_assign',
      confidence_at_correction INTEGER DEFAULT 0
    )`,
  ],
};

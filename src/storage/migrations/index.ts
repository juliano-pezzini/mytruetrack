import type { Migration } from './types.ts';
import { migration001 } from './001-initial-schema.ts';

/** All migrations in version order. */
export const allMigrations: readonly Migration[] = [migration001];

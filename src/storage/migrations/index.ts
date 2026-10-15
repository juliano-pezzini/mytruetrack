import type { Migration } from './types.ts';
import { migration001 } from './001-initial-schema.ts';
import { migration002 } from './002-mercado-pago-import.ts';

/** All migrations in version order. */
export const allMigrations: readonly Migration[] = [migration001, migration002];

import type { Migration } from './types.ts';
import { migration001 } from './001-initial-schema.ts';
import { migration002 } from './002-mercado-pago-import.ts';
import { migration003 } from './003-import-log-error-messages.ts';

/** All migrations in version order. */
export const allMigrations: readonly Migration[] = [migration001, migration002, migration003];

/**
 * Spike A — cr-sqlite two-instance CRDT sync
 *
 * Question: Can two browser instances exchange CRDT changes via a shared blob
 * without conflicts or data loss?
 *
 * VERDICT: (to be filled after running)
 */

import initWasm from '@vlcn.io/crsqlite-wasm';

export async function runSpikeA(): Promise<void> {
  const log = (msg: string) => console.log(`[Spike A] ${msg}`);

  log('=== cr-sqlite CRDT Sync Prototype ===');

  // --- Initialize ---
  log('Initializing cr-sqlite WASM...');
  const sqlite = await initWasm();
  const db1 = await sqlite.open(':memory:');
  const db2 = await sqlite.open(':memory:');

  const site1 = (await db1.execA('SELECT crsql_site_id()'))[0][0];
  const site2 = (await db2.execA('SELECT crsql_site_id()'))[0][0];
  log(`DB1 site ID: ${site1}`);
  log(`DB2 site ID: ${site2}`);

  // --- Create shared schema on both ---
  const schema = `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      description TEXT DEFAULT '',
      amount INTEGER DEFAULT 0,
      date TEXT DEFAULT ''
    );
  `;

  await db1.exec(schema);
  await db1.exec("SELECT crsql_as_crr('transactions')");
  await db2.exec(schema);
  await db2.exec("SELECT crsql_as_crr('transactions')");
  log('Schema created and CRR enabled on both instances');

  // --- Helper: sync changes from src to dst ---
  async function syncChanges(
    src: Awaited<ReturnType<typeof sqlite.open>>,
    dst: Awaited<ReturnType<typeof sqlite.open>>,
    srcLabel: string,
    dstLabel: string,
    sinceVersion: number,
  ): Promise<void> {
    const changes = await src.execA(
      'SELECT * FROM crsql_changes WHERE db_version > ?',
      [sinceVersion],
    );
    log(`${srcLabel} → ${dstLabel}: ${changes.length} change(s)`);

    if (changes.length > 0) {
      await dst.tx(async (tx) => {
        for (const changeset of changes) {
          await tx.exec(
            'INSERT INTO crsql_changes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            changeset,
          );
        }
      });
    }
  }

  // --- Helper: dump table state ---
  async function dumpState(
    db: Awaited<ReturnType<typeof sqlite.open>>,
    label: string,
  ): Promise<unknown[]> {
    const rows = await db.execO(
      'SELECT id, description, amount, date FROM transactions ORDER BY id',
    );
    log(`${label} state (${rows.length} rows):`);
    for (const row of rows) {
      log(`  ${JSON.stringify(row)}`);
    }
    return rows;
  }

  // =========================================================
  // Scenario 1: Independent inserts, then sync both ways
  // =========================================================
  log('\n--- Scenario 1: Independent inserts ---');

  await db1.exec(
    "INSERT INTO transactions VALUES ('txn-001', 'Groceries', -5000, '2026-05-01')",
  );
  await db1.exec(
    "INSERT INTO transactions VALUES ('txn-002', 'Salary', 300000, '2026-05-01')",
  );

  await db2.exec(
    "INSERT INTO transactions VALUES ('txn-003', 'Coffee', -450, '2026-05-02')",
  );
  await db2.exec(
    "INSERT INTO transactions VALUES ('txn-004', 'Refund', 1500, '2026-05-02')",
  );

  // Sync DB1 → DB2, then DB2 → DB1
  await syncChanges(db1, db2, 'DB1', 'DB2', -1);
  await syncChanges(db2, db1, 'DB2', 'DB1', -1);

  const state1a = await dumpState(db1, 'DB1');
  const state1b = await dumpState(db2, 'DB2');

  const converged1 =
    JSON.stringify(state1a) === JSON.stringify(state1b) &&
    state1a.length === 4;
  log(`Scenario 1 convergence: ${converged1 ? '✅ PASS' : '❌ FAIL'}`);

  // =========================================================
  // Scenario 2: Concurrent update to same row (LWW conflict)
  // =========================================================
  log('\n--- Scenario 2: Concurrent update to same row ---');

  const v1Before = (await db1.execA('SELECT crsql_db_version()'))[0][0];
  const v2Before = (await db2.execA('SELECT crsql_db_version()'))[0][0];

  // Both update the same row's description
  await db1.exec(
    "UPDATE transactions SET description = 'Groceries (edited DB1)' WHERE id = 'txn-001'",
  );
  await db2.exec(
    "UPDATE transactions SET description = 'Groceries (edited DB2)' WHERE id = 'txn-001'",
  );

  // Sync in both directions
  await syncChanges(db1, db2, 'DB1', 'DB2', v1Before);
  await syncChanges(db2, db1, 'DB2', 'DB1', v2Before);

  const state2a = await dumpState(db1, 'DB1');
  const state2b = await dumpState(db2, 'DB2');

  const converged2 = JSON.stringify(state2a) === JSON.stringify(state2b);
  log(
    `Scenario 2 convergence (LWW): ${converged2 ? '✅ PASS' : '❌ FAIL'}`,
  );

  // =========================================================
  // Scenario 3: Delete on one side, update on other
  // =========================================================
  log('\n--- Scenario 3: Delete vs. update conflict ---');

  const v1Before3 = (await db1.execA('SELECT crsql_db_version()'))[0][0];
  const v2Before3 = (await db2.execA('SELECT crsql_db_version()'))[0][0];

  // DB1 deletes txn-003, DB2 updates it
  await db1.exec("DELETE FROM transactions WHERE id = 'txn-003'");
  await db2.exec(
    "UPDATE transactions SET amount = -500 WHERE id = 'txn-003'",
  );

  await syncChanges(db1, db2, 'DB1', 'DB2', v1Before3);
  await syncChanges(db2, db1, 'DB2', 'DB1', v2Before3);

  const state3a = await dumpState(db1, 'DB1');
  const state3b = await dumpState(db2, 'DB2');

  const converged3 = JSON.stringify(state3a) === JSON.stringify(state3b);
  log(
    `Scenario 3 convergence (delete vs update): ${converged3 ? '✅ PASS' : '❌ FAIL'}`,
  );

  // =========================================================
  // Library health check
  // =========================================================
  log('\n--- Library Health ---');
  log(
    'cr-sqlite repo: https://github.com/vlcn-io/cr-sqlite — check manually for last commit/release',
  );

  // =========================================================
  // Summary
  // =========================================================
  log('\n=== Spike A Summary ===');
  log(`Scenario 1 (independent inserts): ${converged1 ? '✅' : '❌'}`);
  log(`Scenario 2 (concurrent update LWW): ${converged2 ? '✅' : '❌'}`);
  log(`Scenario 3 (delete vs update): ${converged3 ? '✅' : '❌'}`);
  log('Bundle size: measure with Spike E (combined build)');

  // Cleanup
  await db1.close();
  await db2.close();

  log('Done.');
}

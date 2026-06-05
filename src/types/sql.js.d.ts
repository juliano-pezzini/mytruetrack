declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
  }

  interface SqlJsDatabase {
    run(sql: string, params?: BindParams): SqlJsDatabase;
    prepare(sql: string): Statement;
    close(): void;
  }

  type BindParams =
    | ReadonlyArray<string | number | null | Uint8Array>
    | Record<string, string | number | null | Uint8Array>;

  interface Statement {
    bind(params?: BindParams): boolean;
    step(): boolean;
    get(): (string | number | null | Uint8Array)[];
    getAsObject(): Record<string, string | number | null | Uint8Array>;
    free(): boolean;
  }

  export default function initSqlJs(
    config?: Record<string, unknown>,
  ): Promise<SqlJsStatic>;
}

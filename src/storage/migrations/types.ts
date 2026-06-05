export type Migration = {
  readonly version: number;
  readonly name: string;
  /** Single SQL statement or array of statements to run in order. */
  readonly up: string | readonly string[];
};

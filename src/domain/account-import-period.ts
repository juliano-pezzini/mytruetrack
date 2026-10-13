/**
 * Suggest the next account-import period for one (account, source) frontier.
 *
 * Caller must pass only logs already filtered for the relevant source.
 * todaySaoPaulo is YYYY-MM-DD in America/Sao_Paulo.
 */

export type AccountImportPeriodSuggestion = Readonly<{
  start: string;
  end: string;
}>;

export function suggestAccountImportPeriod(
  logs: readonly { periodEnd: string }[],
  todaySaoPaulo: string,
): AccountImportPeriodSuggestion {
  if (logs.length === 0) {
    const firstOfMonth = `${todaySaoPaulo.slice(0, 7)}-01`;
    return { start: firstOfMonth, end: todaySaoPaulo };
  }

  let maxEnd = logs[0]!.periodEnd;
  for (let i = 1; i < logs.length; i++) {
    const end = logs[i]!.periodEnd;
    if (end > maxEnd) maxEnd = end;
  }

  return { start: maxEnd, end: todaySaoPaulo };
}

/** True when start and end are ordered start ≤ end (inclusive period). */
export function isValidAccountImportPeriod(start: string, end: string): boolean {
  return start <= end;
}

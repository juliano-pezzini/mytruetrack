/**
 * OFX parser — converts OFX 1.x (SGML) and 2.x (XML) bank/credit-card
 * statements into ParsedStatement.
 */

import { parse as parseOFX } from 'ofx-js';
import { fromDecimal, abs as moneyAbs, isNegative } from '../domain/money.ts';
import type { Money } from '../domain/money.ts';
import type { TransactionType } from '../domain/transaction.ts';
import type { ParsedStatement, ParsedTransaction, ParsedAccountInfo } from './types.ts';

/** Raw OFX transaction shape from ofx-js. */
type RawTxn = {
  TRNTYPE?: string;
  DTPOSTED?: string;
  TRNAMT?: string;
  FITID?: string;
  NAME?: string;
  MEMO?: string;
};

/** Convert OFX date (YYYYMMDD or YYYYMMDDHHmmss) to ISO YYYY-MM-DD. */
function parseOfxDate(raw: string): string {
  const d = raw.replace(/\[.*$/, '').trim(); // strip timezone bracket if present
  if (d.length < 8) {
    throw new Error(`Invalid OFX date: ${raw}`);
  }
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/** Normalize STMTTRN to an array (ofx-js returns object for single txn). */
function normalizeTxnList(stmtTrn: RawTxn | RawTxn[] | undefined): RawTxn[] {
  if (!stmtTrn) return [];
  return Array.isArray(stmtTrn) ? stmtTrn : [stmtTrn];
}

/** Map a single raw OFX transaction to ParsedTransaction. */
function mapTransaction(raw: RawTxn): ParsedTransaction {
  const amountStr = raw.TRNAMT ?? '0';
  const rawAmount = fromDecimal(amountStr);

  // Determine type: use TRNTYPE if available, otherwise infer from sign
  let type: TransactionType;
  if (raw.TRNTYPE) {
    type = raw.TRNTYPE.toUpperCase() === 'CREDIT' ? 'credit' : 'debit';
  } else {
    type = isNegative(rawAmount) ? 'debit' : 'credit';
  }

  const amount: Money = moneyAbs(rawAmount);

  // Build description from NAME + MEMO
  const parts: string[] = [];
  if (raw.NAME) parts.push(raw.NAME.trim());
  if (raw.MEMO) parts.push(raw.MEMO.trim());
  const description = parts.join(' — ') || 'Unknown';

  return {
    date: parseOfxDate(raw.DTPOSTED ?? ''),
    description,
    amount,
    type,
    externalId: raw.FITID ?? null,
  };
}

/** Extract balance from LEDGERBAL if present. */
function extractBalance(ledgerBal: { BALAMT?: string; DTASOF?: string } | undefined): {
  balance: Money | null;
  balanceDate: string | null;
} {
  if (!ledgerBal?.BALAMT) {
    return { balance: null, balanceDate: null };
  }
  return {
    balance: fromDecimal(ledgerBal.BALAMT),
    balanceDate: ledgerBal.DTASOF ? parseOfxDate(ledgerBal.DTASOF) : null,
  };
}

/**
 * Parse an OFX string into a ParsedStatement.
 * Supports both bank (BANKMSGSRSV1) and credit card (CREDITCARDMSGSRSV1) statements.
 */
export async function parseOfx(content: string): Promise<ParsedStatement> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await parseOFX(content)) as { OFX: any };
  const ofx = result.OFX;

  // Try bank statement first
  const bankStmt = ofx?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS;
  if (bankStmt) {
    const acctFrom = bankStmt.BANKACCTFROM ?? {};
    const accountInfo: ParsedAccountInfo = {
      bankId: acctFrom.BANKID ?? null,
      accountId: acctFrom.ACCTID ?? '',
      accountType: 'bank',
    };

    const rawTxns = normalizeTxnList(bankStmt.BANKTRANLIST?.STMTTRN);
    const transactions = rawTxns.map(mapTransaction);
    const { balance, balanceDate } = extractBalance(bankStmt.LEDGERBAL);

    return {
      accountInfo,
      currency: bankStmt.CURDEF ?? 'USD',
      transactions,
      balance,
      balanceDate,
    };
  }

  // Try credit card statement
  const ccStmt = ofx?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS;
  if (ccStmt) {
    const acctFrom = ccStmt.CCACCTFROM ?? {};
    const accountInfo: ParsedAccountInfo = {
      bankId: null,
      accountId: acctFrom.ACCTID ?? '',
      accountType: 'credit_card',
    };

    const rawTxns = normalizeTxnList(ccStmt.BANKTRANLIST?.STMTTRN);
    const transactions = rawTxns.map(mapTransaction);
    const { balance, balanceDate } = extractBalance(ccStmt.LEDGERBAL);

    return {
      accountInfo,
      currency: ccStmt.CURDEF ?? 'USD',
      transactions,
      balance,
      balanceDate,
    };
  }

  throw new Error('Unsupported OFX format: no bank or credit card statement found');
}

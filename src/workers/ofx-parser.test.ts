import { describe, it, expect } from 'vitest';
import { parseOfx } from './ofx-parser.ts';
import { toCents } from '../domain/money.ts';

const SAMPLE_BANK_OFX = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<DTSERVER>20260501120000
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>001
<ACCTID>12345-6
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260501
<DTEND>20260531
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260501
<TRNAMT>3000.00
<FITID>2026050100001
<NAME>SALARIO EMPRESA X
<MEMO>PAGAMENTO MENSAL
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260505
<TRNAMT>-150.75
<FITID>2026050500001
<NAME>SUPERMERCADO ABC
<MEMO>COMPRAS MERCADO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260510
<TRNAMT>-45.00
<FITID>2026051000001
<NAME>RESTAURANTE XYZ
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>2804.25
<DTASOF>20260531
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`.trim();

const SAMPLE_CC_OFX = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<DTSERVER>20260501120000
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<TRNUID>2001
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<CCSTMTRS>
<CURDEF>BRL
<CCACCTFROM>
<ACCTID>9876-5432-1098-7654
</CCACCTFROM>
<BANKTRANLIST>
<DTSTART>20260501
<DTEND>20260531
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260503
<TRNAMT>-89.90
<FITID>CC2026050300001
<NAME>LOJA ONLINE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260515
<TRNAMT>89.90
<FITID>CC2026051500001
<NAME>ESTORNO LOJA ONLINE
<MEMO>DEVOLUCAO
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>-500.00
<DTASOF>20260531
</LEDGERBAL>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>
`.trim();

const SINGLE_TXN_OFX = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<DTSERVER>20260601
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>3001
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>999
<ACCTID>SINGLE-ACCT
<ACCTTYPE>SAVINGS
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260601
<DTEND>20260601
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260601
<TRNAMT>500.00
<FITID>SINGLE001
<NAME>DEPOSIT
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`.trim();

describe('ofx-parser', () => {
  describe('bank statement', () => {
    it('parses 3 transactions', async () => {
      const result = await parseOfx(SAMPLE_BANK_OFX);

      expect(result.transactions).toHaveLength(3);
      expect(result.currency).toBe('BRL');
    });

    it('extracts account info', async () => {
      const result = await parseOfx(SAMPLE_BANK_OFX);

      expect(result.accountInfo.bankId).toBe('001');
      expect(result.accountInfo.accountId).toBe('12345-6');
      expect(result.accountInfo.accountType).toBe('bank');
    });

    it('maps credit transaction correctly', async () => {
      const result = await parseOfx(SAMPLE_BANK_OFX);
      const txn = result.transactions[0]!;

      expect(txn.type).toBe('credit');
      expect(toCents(txn.amount)).toBe(300000);
      expect(txn.date).toBe('2026-05-01');
      expect(txn.externalId).toBe('2026050100001');
      expect(txn.description).toBe('SALARIO EMPRESA X — PAGAMENTO MENSAL');
    });

    it('maps debit transaction with negative amount to positive', async () => {
      const result = await parseOfx(SAMPLE_BANK_OFX);
      const txn = result.transactions[1]!;

      expect(txn.type).toBe('debit');
      expect(toCents(txn.amount)).toBe(15075); // absolute value
      expect(txn.date).toBe('2026-05-05');
      expect(txn.description).toBe('SUPERMERCADO ABC — COMPRAS MERCADO');
    });

    it('handles transaction without MEMO', async () => {
      const result = await parseOfx(SAMPLE_BANK_OFX);
      const txn = result.transactions[2]!;

      expect(txn.description).toBe('RESTAURANTE XYZ');
    });

    it('extracts balance', async () => {
      const result = await parseOfx(SAMPLE_BANK_OFX);

      expect(result.balance).not.toBeNull();
      expect(toCents(result.balance!)).toBe(280425);
      expect(result.balanceDate).toBe('2026-05-31');
    });
  });

  describe('credit card statement', () => {
    it('parses 2 transactions', async () => {
      const result = await parseOfx(SAMPLE_CC_OFX);

      expect(result.transactions).toHaveLength(2);
      expect(result.accountInfo.accountType).toBe('credit_card');
      expect(result.accountInfo.accountId).toBe('9876-5432-1098-7654');
      expect(result.accountInfo.bankId).toBeNull();
    });

    it('handles negative balance', async () => {
      const result = await parseOfx(SAMPLE_CC_OFX);

      expect(result.balance).not.toBeNull();
      expect(toCents(result.balance!)).toBe(-50000);
    });

    it('maps credit card debit and credit', async () => {
      const result = await parseOfx(SAMPLE_CC_OFX);

      const debit = result.transactions[0]!;
      expect(debit.type).toBe('debit');
      expect(toCents(debit.amount)).toBe(8990);

      const credit = result.transactions[1]!;
      expect(credit.type).toBe('credit');
      expect(toCents(credit.amount)).toBe(8990);
    });
  });

  describe('edge cases', () => {
    it('handles single transaction (object, not array)', async () => {
      const result = await parseOfx(SINGLE_TXN_OFX);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]!.externalId).toBe('SINGLE001');
      expect(toCents(result.transactions[0]!.amount)).toBe(50000);
    });

    it('handles missing balance', async () => {
      const result = await parseOfx(SINGLE_TXN_OFX);

      expect(result.balance).toBeNull();
      expect(result.balanceDate).toBeNull();
    });

    it('throws on unsupported OFX format', async () => {
      const badOfx = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<SIGNONMSGSRSV1>
<SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS></SONRS>
</SIGNONMSGSRSV1>
</OFX>
`.trim();

      await expect(parseOfx(badOfx)).rejects.toThrow('Unsupported OFX format');
    });
  });
});

import type { Database, Row } from '../database.ts';
import type { AutoCategoryCorrection, CorrectionType } from '../../domain/auto-categorization.ts';

function rowToCorrection(row: Row): AutoCategoryCorrection {
  return {
    id: row.id as string,
    transactionId: row.transaction_id as string,
    originalCategoryId: (row.original_category_id as string) || null,
    correctedCategoryId: row.corrected_category_id as string,
    descriptionText: row.description_text as string,
    correctionType: row.correction_type as CorrectionType,
    confidenceAtCorrection: (row.confidence_at_correction as number) || null,
  };
}

export type AutoCategoryCorrectionRepository = {
  create(correction: AutoCategoryCorrection): Promise<AutoCategoryCorrection>;
  getByTransactionId(transactionId: string): Promise<AutoCategoryCorrection[]>;
};

export function createAutoCategoryCorrectionRepository(
  db: Database,
): AutoCategoryCorrectionRepository {
  return {
    async create(correction: AutoCategoryCorrection): Promise<AutoCategoryCorrection> {
      await db.exec(
        `INSERT INTO auto_category_corrections
         (id, transaction_id, original_category_id, corrected_category_id, description_text, correction_type, confidence_at_correction)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          correction.id,
          correction.transactionId,
          correction.originalCategoryId ?? '',
          correction.correctedCategoryId,
          correction.descriptionText,
          correction.correctionType,
          correction.confidenceAtCorrection ?? 0,
        ],
      );
      return correction;
    },

    async getByTransactionId(transactionId: string): Promise<AutoCategoryCorrection[]> {
      return (
        await db.execO('SELECT * FROM auto_category_corrections WHERE transaction_id = ?', [
          transactionId,
        ])
      ).map(rowToCorrection);
    },
  };
}

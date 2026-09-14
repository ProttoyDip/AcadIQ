-- Honest confidence (reliability v2): additive, nullable. `confidence` keeps the composite
-- min(evidence_sufficiency, model_agreement ?? evidence_sufficiency); v1 rows stay readable.

-- AlterTable
ALTER TABLE `ai_explanations`
    ADD COLUMN `evidence_sufficiency` DECIMAL(5, 2) NULL,
    ADD COLUMN `model_agreement` DECIMAL(5, 2) NULL;

-- AlterTable
ALTER TABLE `exam_quality_scores`
    ADD COLUMN `model_agreement` DECIMAL(5, 2) NULL,
    ADD COLUMN `quality_score_spread` DECIMAL(5, 2) NULL;

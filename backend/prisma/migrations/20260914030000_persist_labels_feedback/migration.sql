-- Persist what we already compute + collect human labels.

-- AlterTable: extracted syllabus text (was parsed and discarded on every analysis)
ALTER TABLE `syllabus_documents` ADD COLUMN `extracted_text` LONGTEXT NULL;

-- CreateTable
CREATE TABLE `question_feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question_id` INTEGER NOT NULL,
    `report_id` INTEGER NULL,
    `faculty_id` INTEGER NOT NULL,
    `verdict` VARCHAR(10) NOT NULL,
    `ai_bloom_level` VARCHAR(30) NULL,
    `corrected_bloom_level` VARCHAR(30) NULL,
    `ai_topic` VARCHAR(191) NULL,
    `corrected_topic` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `question_feedback_question_id_report_id_faculty_id_key`(`question_id`, `report_id`, `faculty_id`),
    INDEX `question_feedback_faculty_id_created_at_idx`(`faculty_id`, `created_at`),
    INDEX `question_feedback_report_id_idx`(`report_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `question_feedback` ADD CONSTRAINT `question_feedback_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_feedback` ADD CONSTRAINT `question_feedback_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `analysis_reports`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_feedback` ADD CONSTRAINT `question_feedback_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Normalise existing free-text semesters to the canonical labels used from now on.
UPDATE `question_papers` SET `semester` = 'Spring' WHERE LOWER(TRIM(`semester`)) REGEXP '^(spring|spr)( ?[0-9]{4})?$';
UPDATE `question_papers` SET `semester` = 'Summer' WHERE LOWER(TRIM(`semester`)) REGEXP '^(summer|sum)( ?[0-9]{4})?$';
UPDATE `question_papers` SET `semester` = 'Fall'   WHERE LOWER(TRIM(`semester`)) REGEXP '^(fall|autumn|aut)( ?[0-9]{4})?$';
UPDATE `question_papers` SET `semester` = 'Winter' WHERE LOWER(TRIM(`semester`)) REGEXP '^(winter|win)( ?[0-9]{4})?$';
UPDATE `question_history` SET `semester` = 'Spring' WHERE LOWER(TRIM(`semester`)) REGEXP '^(spring|spr)( ?[0-9]{4})?$';
UPDATE `question_history` SET `semester` = 'Summer' WHERE LOWER(TRIM(`semester`)) REGEXP '^(summer|sum)( ?[0-9]{4})?$';
UPDATE `question_history` SET `semester` = 'Fall'   WHERE LOWER(TRIM(`semester`)) REGEXP '^(fall|autumn|aut)( ?[0-9]{4})?$';
UPDATE `question_history` SET `semester` = 'Winter' WHERE LOWER(TRIM(`semester`)) REGEXP '^(winter|win)( ?[0-9]{4})?$';

-- Add explainable quality scoring, academic memory, and course-outcome intelligence.
ALTER TABLE `analysis_reports`
  MODIFY `report_type` ENUM(
    'EXAM_QUALITY',
    'SYLLABUS_COVERAGE',
    'QUESTION_SIMILARITY',
    'QUESTION_REVIEW',
    'CO_MAPPING',
    'ACADEMIC_MEMORY'
  ) NOT NULL;

CREATE TABLE `exam_quality_scores` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `report_id` INTEGER NOT NULL,
  `quality_score` DECIMAL(5, 2) NOT NULL,
  `score_factors` JSON NOT NULL,
  `positive_points` JSON NOT NULL,
  `issues` JSON NOT NULL,
  `recommendations` JSON NOT NULL,
  `confidence_score` DECIMAL(5, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `exam_quality_scores_report_id_key` (`report_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ai_explanations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `report_id` INTEGER NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `decision` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `confidence` DECIMAL(5, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ai_explanations_report_id_key` (`report_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `question_history` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `source_question_id` INTEGER NULL,
  `question_text` TEXT NOT NULL,
  `semester` VARCHAR(50) NOT NULL,
  `year` INTEGER NOT NULL,
  `embedding_reference` VARCHAR(500) NULL,
  `similarity_score` DECIMAL(5, 2) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `question_history_source_question_id_key` (`source_question_id`),
  INDEX `question_history_course_id_year_semester_idx` (`course_id`, `year`, `semester`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `course_outcomes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `description` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `course_outcomes_course_id_idx` (`course_id`),
  UNIQUE INDEX `course_outcomes_course_id_code_key` (`course_id`, `code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `question_co_mappings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `report_id` INTEGER NOT NULL,
  `question_id` INTEGER NOT NULL,
  `course_outcome_id` INTEGER NOT NULL,
  `strength` VARCHAR(30) NOT NULL,
  `decision` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `confidence` DECIMAL(5, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `question_co_mappings_question_id_idx` (`question_id`),
  INDEX `question_co_mappings_course_outcome_id_idx` (`course_outcome_id`),
  UNIQUE INDEX `question_co_mappings_report_id_question_id_course_outcome_id_key` (`report_id`, `question_id`, `course_outcome_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `exam_quality_scores` ADD CONSTRAINT `exam_quality_scores_report_id_fkey`
  FOREIGN KEY (`report_id`) REFERENCES `analysis_reports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ai_explanations` ADD CONSTRAINT `ai_explanations_report_id_fkey`
  FOREIGN KEY (`report_id`) REFERENCES `analysis_reports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `question_history` ADD CONSTRAINT `question_history_course_id_fkey`
  FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `question_history` ADD CONSTRAINT `question_history_source_question_id_fkey`
  FOREIGN KEY (`source_question_id`) REFERENCES `questions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `course_outcomes` ADD CONSTRAINT `course_outcomes_course_id_fkey`
  FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `question_co_mappings` ADD CONSTRAINT `question_co_mappings_report_id_fkey`
  FOREIGN KEY (`report_id`) REFERENCES `analysis_reports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `question_co_mappings` ADD CONSTRAINT `question_co_mappings_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `question_co_mappings` ADD CONSTRAINT `question_co_mappings_course_outcome_id_fkey`
  FOREIGN KEY (`course_outcome_id`) REFERENCES `course_outcomes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing uploaded papers immediately become usable academic memory.
INSERT INTO `question_history` (`course_id`, `source_question_id`, `question_text`, `semester`, `year`, `created_at`)
SELECT qp.`course_id`, q.`id`, q.`question_text`, qp.`semester`, qp.`year`, qp.`uploaded_at`
FROM `questions` q
INNER JOIN `question_papers` qp ON qp.`id` = q.`paper_id`;

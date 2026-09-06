-- Create the complete AcadIQ schema.
CREATE TABLE `users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'FACULTY') NOT NULL DEFAULT 'FACULTY',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_email_key` (`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `faculty_profiles` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `department` VARCHAR(120) NOT NULL,
  `designation` VARCHAR(120) NOT NULL,
  UNIQUE INDEX `faculty_profiles_user_id_key` (`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `courses` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `faculty_id` INTEGER NOT NULL,
  `course_code` VARCHAR(30) NOT NULL,
  `course_name` VARCHAR(180) NOT NULL,
  `description` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `courses_faculty_id_idx` (`faculty_id`),
  UNIQUE INDEX `courses_faculty_id_course_code_key` (`faculty_id`, `course_code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `syllabus_documents` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` INTEGER NOT NULL,
  `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `syllabus_documents_course_id_uploaded_at_idx` (`course_id`, `uploaded_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `question_papers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `year` INTEGER NOT NULL,
  `semester` VARCHAR(50) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` INTEGER NOT NULL,
  `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `question_papers_course_id_uploaded_at_idx` (`course_id`, `uploaded_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `questions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `paper_id` INTEGER NOT NULL,
  `sequence_number` INTEGER NOT NULL,
  `question_text` TEXT NOT NULL,
  `marks` INTEGER NOT NULL DEFAULT 0,
  `topic` VARCHAR(191) NULL,
  `bloom_level` VARCHAR(30) NULL,
  INDEX `questions_paper_id_idx` (`paper_id`),
  UNIQUE INDEX `questions_paper_id_sequence_number_key` (`paper_id`, `sequence_number`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `analysis_reports` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `faculty_id` INTEGER NOT NULL,
  `course_id` INTEGER NULL,
  `question_paper_id` INTEGER NULL,
  `report_type` ENUM('EXAM_QUALITY', 'SYLLABUS_COVERAGE', 'QUESTION_SIMILARITY', 'QUESTION_REVIEW', 'CO_MAPPING') NOT NULL,
  `result_json` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `analysis_reports_faculty_id_created_at_idx` (`faculty_id`, `created_at`),
  INDEX `analysis_reports_course_id_idx` (`course_id`),
  INDEX `analysis_reports_question_paper_id_idx` (`question_paper_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recommendations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `report_id` INTEGER NOT NULL,
  `message` TEXT NOT NULL,
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `recommendations_report_id_idx` (`report_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `rubrics` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `created_by_id` INTEGER NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `criteria` JSON NOT NULL,
  `max_score` DECIMAL(7, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `rubrics_course_id_idx` (`course_id`),
  INDEX `rubrics_created_by_id_idx` (`created_by_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_answers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `question_id` INTEGER NOT NULL,
  `rubric_id` INTEGER NULL,
  `student_identifier` VARCHAR(100) NOT NULL,
  `answer_text` LONGTEXT NOT NULL,
  `score` DECIMAL(7, 2) NULL,
  `feedback` JSON NULL,
  `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `graded_at` DATETIME(3) NULL,
  INDEX `student_answers_question_id_idx` (`question_id`),
  INDEX `student_answers_rubric_id_idx` (`rubric_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `faculty_profiles` ADD CONSTRAINT `faculty_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `courses` ADD CONSTRAINT `courses_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `syllabus_documents` ADD CONSTRAINT `syllabus_documents_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `question_papers` ADD CONSTRAINT `question_papers_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `questions` ADD CONSTRAINT `questions_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `question_papers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `analysis_reports` ADD CONSTRAINT `analysis_reports_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `analysis_reports` ADD CONSTRAINT `analysis_reports_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `analysis_reports` ADD CONSTRAINT `analysis_reports_question_paper_id_fkey` FOREIGN KEY (`question_paper_id`) REFERENCES `question_papers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `analysis_reports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `rubrics` ADD CONSTRAINT `rubrics_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `rubrics` ADD CONSTRAINT `rubrics_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_answers` ADD CONSTRAINT `student_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_answers` ADD CONSTRAINT `student_answers_rubric_id_fkey` FOREIGN KEY (`rubric_id`) REFERENCES `rubrics` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `student_marks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paper_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `student_identifier` VARCHAR(100) NOT NULL,
    `marks` DECIMAL(7, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `student_marks_paper_id_student_identifier_question_id_key`(`paper_id`, `student_identifier`, `question_id`),
    INDEX `student_marks_question_id_idx`(`question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_blueprints` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER NOT NULL,
    `target_bloom` JSON NOT NULL,
    `outcome_weights` JSON NULL,
    `topic_weights` JSON NULL,
    `total_marks` INTEGER NOT NULL DEFAULT 100,
    `question_count` INTEGER NOT NULL DEFAULT 8,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `exam_blueprints_course_id_key`(`course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lecture_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER NOT NULL,
    `weeks` INTEGER NOT NULL,
    `hours_per_week` INTEGER NOT NULL,
    `plan_json` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lecture_plans_course_id_created_at_idx`(`course_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `rubrics` ADD COLUMN `question_paper_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `rubrics_question_paper_id_idx` ON `rubrics`(`question_paper_id`);

-- AddForeignKey
ALTER TABLE `student_marks` ADD CONSTRAINT `student_marks_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `question_papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_marks` ADD CONSTRAINT `student_marks_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_blueprints` ADD CONSTRAINT `exam_blueprints_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lecture_plans` ADD CONSTRAINT `lecture_plans_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rubrics` ADD CONSTRAINT `rubrics_question_paper_id_fkey` FOREIGN KEY (`question_paper_id`) REFERENCES `question_papers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

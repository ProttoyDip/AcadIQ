-- CreateTable
CREATE TABLE `terms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `faculty_id` INTEGER NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `start_date` CHAR(10) NOT NULL,
    `end_date` CHAR(10) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `terms_faculty_id_is_active_idx`(`faculty_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_slots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `term_id` INTEGER NOT NULL,
    `course_id` INTEGER NULL,
    `course_label` VARCHAR(120) NOT NULL,
    `section` VARCHAR(40) NULL,
    `day_of_week` INTEGER NOT NULL,
    `start_time` CHAR(5) NOT NULL,
    `end_time` CHAR(5) NOT NULL,
    `room` VARCHAR(60) NULL,
    `kind` VARCHAR(20) NOT NULL DEFAULT 'LECTURE',
    `source` VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `class_slots_term_id_day_of_week_idx`(`term_id`, `day_of_week`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `term_id` INTEGER NOT NULL,
    `slot_id` INTEGER NULL,
    `course_id` INTEGER NULL,
    `course_label` VARCHAR(120) NOT NULL,
    `section` VARCHAR(40) NULL,
    `date` CHAR(10) NOT NULL,
    `start_time` CHAR(5) NOT NULL,
    `end_time` CHAR(5) NOT NULL,
    `room` VARCHAR(60) NULL,
    `kind` VARCHAR(20) NOT NULL DEFAULT 'LECTURE',
    `status` VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    `reason` VARCHAR(255) NULL,
    `rescheduled_from_id` INTEGER NULL,
    `planned_week` INTEGER NULL,
    `planned_topics` JSON NULL,
    `covered_topics` JSON NULL,
    `notes` TEXT NULL,
    `material_ids` JSON NULL,
    `logged_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `class_sessions_rescheduled_from_id_key`(`rescheduled_from_id`),
    INDEX `class_sessions_term_id_date_idx`(`term_id`, `date`),
    INDEX `class_sessions_course_id_date_idx`(`course_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `calendar_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `term_id` INTEGER NOT NULL,
    `date` CHAR(10) NOT NULL,
    `end_date` CHAR(10) NULL,
    `kind` VARCHAR(20) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `calendar_events_term_id_date_idx`(`term_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `terms` ADD CONSTRAINT `terms_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_slots` ADD CONSTRAINT `class_slots_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_slots` ADD CONSTRAINT `class_slots_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_slot_id_fkey` FOREIGN KEY (`slot_id`) REFERENCES `class_slots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_rescheduled_from_id_fkey` FOREIGN KEY (`rescheduled_from_id`) REFERENCES `class_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

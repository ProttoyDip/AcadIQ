-- AlterTable
ALTER TABLE `users`
    ADD COLUMN `digest_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `digest_hour` INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN `digest_last_sent` CHAR(10) NULL;

-- AlterTable
ALTER TABLE `terms` ADD COLUMN `feed_token` CHAR(48) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `terms_feed_token_key` ON `terms`(`feed_token`);

-- AlterTable
ALTER TABLE `calendar_events`
    ADD COLUMN `course_id` INTEGER NULL,
    ADD COLUMN `section` VARCHAR(40) NULL,
    ADD COLUMN `start_time` CHAR(5) NULL,
    ADD COLUMN `end_time` CHAR(5) NULL;

-- AddForeignKey
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `department_routines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uploaded_by_id` INTEGER NOT NULL,
    `term_label` VARCHAR(80) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `slot_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `department_slots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `routine_id` INTEGER NOT NULL,
    `course_label` VARCHAR(120) NOT NULL,
    `section` VARCHAR(40) NULL,
    `teacher` VARCHAR(80) NULL,
    `day_of_week` INTEGER NOT NULL,
    `start_time` CHAR(5) NOT NULL,
    `end_time` CHAR(5) NOT NULL,
    `room` VARCHAR(60) NULL,
    `kind` VARCHAR(20) NOT NULL DEFAULT 'LECTURE',

    INDEX `department_slots_routine_id_day_of_week_idx`(`routine_id`, `day_of_week`),
    INDEX `department_slots_room_idx`(`room`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `department_routines` ADD CONSTRAINT `department_routines_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_slots` ADD CONSTRAINT `department_slots_routine_id_fkey` FOREIGN KEY (`routine_id`) REFERENCES `department_routines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

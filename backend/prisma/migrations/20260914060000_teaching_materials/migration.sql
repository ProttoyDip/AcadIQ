-- CreateTable
CREATE TABLE `teaching_materials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `course_id` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `extracted_text` LONGTEXT NULL,
    `chunk_count` INTEGER NOT NULL DEFAULT 0,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `teaching_materials_course_id_uploaded_at_idx`(`course_id`, `uploaded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teaching_material_chunks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `material_id` INTEGER NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `locator` VARCHAR(40) NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `teaching_material_chunks_material_id_chunk_index_key`(`material_id`, `chunk_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `teaching_materials` ADD CONSTRAINT `teaching_materials_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teaching_material_chunks` ADD CONSTRAINT `teaching_material_chunks_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `teaching_materials`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

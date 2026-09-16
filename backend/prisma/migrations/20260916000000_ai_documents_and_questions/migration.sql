-- CreateTable documents
CREATE TABLE `documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `title` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `file_type` VARCHAR(50) NOT NULL DEFAULT 'PDF',
    `extracted_text` LONGTEXT NULL,
    `summary` LONGTEXT NULL,
    `key_points` JSON NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `documents_user_id_idx`(`user_id`),
    INDEX `documents_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable document_chunks
CREATE TABLE `document_chunks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `document_id` INTEGER NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `page_number` INTEGER NULL,
    `section` VARCHAR(255) NULL,
    `token_count` INTEGER NULL,
    `embedding` BLOB NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_chunks_document_id_idx`(`document_id`),
    UNIQUE INDEX `document_chunks_document_id_chunk_index_key`(`document_id`, `chunk_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable generated_questions
CREATE TABLE `generated_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `document_id` INTEGER NULL,
    `user_id` INTEGER NULL,
    `topic` VARCHAR(255) NULL,
    `difficulty` VARCHAR(50) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `question` TEXT NOT NULL,
    `options` JSON NULL,
    `correct_answer` TEXT NULL,
    `explanation` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `generated_questions_document_id_idx`(`document_id`),
    INDEX `generated_questions_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_chunks` ADD CONSTRAINT `document_chunks_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_questions` ADD CONSTRAINT `generated_questions_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_questions` ADD CONSTRAINT `generated_questions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

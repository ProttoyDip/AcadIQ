-- CreateTable
CREATE TABLE `embedding_vectors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `owner_type` VARCHAR(30) NOT NULL,
    `owner_id` INTEGER NOT NULL,
    `course_id` INTEGER NULL,
    `model` VARCHAR(80) NOT NULL,
    `dimension` INTEGER NOT NULL,
    `vector` LONGBLOB NOT NULL,
    `content_hash` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `embedding_vectors_owner_type_owner_id_model_key`(`owner_type`, `owner_id`, `model`),
    INDEX `embedding_vectors_course_id_owner_type_model_idx`(`course_id`, `owner_type`, `model`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `syllabus_chunks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `syllabus_document_id` INTEGER NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `syllabus_chunks_syllabus_document_id_chunk_index_key`(`syllabus_document_id`, `chunk_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `syllabus_chunks` ADD CONSTRAINT `syllabus_chunks_syllabus_document_id_fkey` FOREIGN KEY (`syllabus_document_id`) REFERENCES `syllabus_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

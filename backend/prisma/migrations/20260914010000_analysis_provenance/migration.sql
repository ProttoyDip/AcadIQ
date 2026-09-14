-- CreateTable
CREATE TABLE `analysis_runs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `report_id` INTEGER NULL,
    `pipeline` VARCHAR(60) NOT NULL,
    `prompt_id` VARCHAR(60) NOT NULL,
    `prompt_version` VARCHAR(40) NOT NULL,
    `prompt_hash` CHAR(64) NOT NULL,
    `model` VARCHAR(80) NOT NULL,
    `temperature` DECIMAL(3, 2) NOT NULL,
    `input_hash` CHAR(64) NOT NULL,
    `sample_count` INTEGER NOT NULL,
    `cache_hit` BOOLEAN NOT NULL DEFAULT false,
    `prompt_tokens` INTEGER NULL,
    `completion_tokens` INTEGER NULL,
    `total_tokens` INTEGER NULL,
    `latency_ms` INTEGER NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `agreement_json` JSON NULL,
    `request_id` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `analysis_runs_report_id_idx`(`report_id`),
    INDEX `analysis_runs_input_hash_prompt_hash_model_idx`(`input_hash`, `prompt_hash`, `model`),
    INDEX `analysis_runs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analysis_run_samples` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `run_id` INTEGER NOT NULL,
    `sample_index` INTEGER NOT NULL,
    `raw_response` LONGTEXT NOT NULL,
    `validated` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `analysis_run_samples_run_id_idx`(`run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `llm_cache_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cache_key` CHAR(64) NOT NULL,
    `pipeline` VARCHAR(60) NOT NULL,
    `raw_response` LONGTEXT NOT NULL,
    `total_tokens` INTEGER NOT NULL DEFAULT 0,
    `hit_count` INTEGER NOT NULL DEFAULT 0,
    `tokens_saved` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `llm_cache_entries_cache_key_key`(`cache_key`),
    INDEX `llm_cache_entries_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `analysis_runs` ADD CONSTRAINT `analysis_runs_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `analysis_reports`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analysis_run_samples` ADD CONSTRAINT `analysis_run_samples_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `analysis_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

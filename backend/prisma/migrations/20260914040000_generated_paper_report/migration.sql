-- AlterTable: new report type for constraint-solving paper generation
ALTER TABLE `analysis_reports` MODIFY `report_type` ENUM('EXAM_QUALITY', 'SYLLABUS_COVERAGE', 'QUESTION_SIMILARITY', 'QUESTION_REVIEW', 'CO_MAPPING', 'ACADEMIC_MEMORY', 'GENERATED_PAPER') NOT NULL;

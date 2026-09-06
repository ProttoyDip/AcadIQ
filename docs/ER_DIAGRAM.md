# Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o| FACULTY_PROFILES : has
    USERS ||--o{ COURSES : owns
    USERS ||--o{ ANALYSIS_REPORTS : generates
    USERS ||--o{ RUBRICS : creates
    COURSES ||--o{ SYLLABUS_DOCUMENTS : contains
    COURSES ||--o{ QUESTION_PAPERS : contains
    COURSES ||--o{ ANALYSIS_REPORTS : groups
    COURSES ||--o{ RUBRICS : defines
    QUESTION_PAPERS ||--o{ QUESTIONS : contains
    QUESTION_PAPERS ||--o{ ANALYSIS_REPORTS : analyzed_by
    QUESTIONS ||--o{ STUDENT_ANSWERS : receives
    RUBRICS ||--o{ STUDENT_ANSWERS : grades
    ANALYSIS_REPORTS ||--o{ RECOMMENDATIONS : produces

    USERS {
        int id PK
        string name
        string email UK
        string password
        enum role
        datetime created_at
        datetime updated_at
    }

    FACULTY_PROFILES {
        int id PK
        int user_id FK
        string department
        string designation
    }

    COURSES {
        int id PK
        int faculty_id FK
        string course_code
        string course_name
        text description
        datetime created_at
        datetime updated_at
    }

    SYLLABUS_DOCUMENTS {
        int id PK
        int course_id FK
        string original_name
        string file_path
        string mime_type
        int file_size
        datetime uploaded_at
    }

    QUESTION_PAPERS {
        int id PK
        int course_id FK
        int year
        string semester
        string original_name
        string file_path
        string mime_type
        int file_size
        datetime uploaded_at
    }

    QUESTIONS {
        int id PK
        int paper_id FK
        int sequence_number
        text question_text
        int marks
        string topic
        string bloom_level
    }

    ANALYSIS_REPORTS {
        int id PK
        int faculty_id FK
        int course_id FK
        int question_paper_id FK
        enum report_type
        json result_json
        datetime created_at
    }

    RECOMMENDATIONS {
        int id PK
        int report_id FK
        text message
        enum priority
        datetime created_at
    }

    RUBRICS {
        int id PK
        int course_id FK
        int created_by_id FK
        string name
        json criteria
        decimal max_score
    }

    STUDENT_ANSWERS {
        int id PK
        int question_id FK
        int rubric_id FK
        string student_identifier
        text answer_text
        decimal score
        json feedback
    }
```

## Relationship notes

- `users.role` distinguishes `ADMIN` from `FACULTY`; only faculty users get a `faculty_profiles` row.
- A `course` belongs to exactly one faculty member (`courses.faculty_id → users.id`) but a faculty member can own many courses.
- Each `question_paper` is scoped to a `course` and tagged by `year`/`semester`, which is what lets the Question Similarity Detector compare "this year's paper" against "last year's paper" for the same course.
- `analysis_reports.result_json` stores the full structured AI output (topic coverage, Bloom distribution, similarity matches, etc.) so the dashboard can render rich reports without re-running the AI pipeline; `recommendations` are extracted into their own rows for filtering/sorting by `priority`.
- `rubrics.criteria` and `student_answers.feedback` are validated application JSON, allowing evolving assessment structures without losing relational ownership and grading links.
- All foreign keys cascade on delete, so removing a course cleans up its documents, papers, and questions.

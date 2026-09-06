# Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o| FACULTY_PROFILES : has
    USERS ||--o{ COURSES : owns
    USERS ||--o{ ANALYSIS_REPORTS : generates
    COURSES ||--o{ SYLLABUS_DOCUMENTS : contains
    COURSES ||--o{ QUESTION_PAPERS : contains
    QUESTION_PAPERS ||--o{ QUESTIONS : contains
    ANALYSIS_REPORTS ||--o{ RECOMMENDATIONS : produces

    USERS {
        int id PK
        string name
        string email UK
        string password
        enum role
        datetime created_at
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
    }

    SYLLABUS_DOCUMENTS {
        int id PK
        int course_id FK
        string file_path
        datetime uploaded_at
    }

    QUESTION_PAPERS {
        int id PK
        int course_id FK
        int year
        string semester
        string file_path
    }

    QUESTIONS {
        int id PK
        int paper_id FK
        text question_text
        int marks
        string topic
        string bloom_level
    }

    ANALYSIS_REPORTS {
        int id PK
        int faculty_id FK
        enum report_type
        json result_json
        datetime created_at
    }

    RECOMMENDATIONS {
        int id PK
        int report_id FK
        text message
        enum priority
    }
```

## Relationship notes

- `users.role` distinguishes `ADMIN` from `FACULTY`; only faculty users get a `faculty_profiles` row.
- A `course` belongs to exactly one faculty member (`courses.faculty_id → users.id`) but a faculty member can own many courses.
- Each `question_paper` is scoped to a `course` and tagged by `year`/`semester`, which is what lets the Question Similarity Detector compare "this year's paper" against "last year's paper" for the same course.
- `analysis_reports.result_json` stores the full structured AI output (topic coverage, Bloom distribution, similarity matches, etc.) so the dashboard can render rich reports without re-running the AI pipeline; `recommendations` are extracted into their own rows for filtering/sorting by `priority`.
- All foreign keys cascade on delete, so removing a course cleans up its documents, papers, and questions.

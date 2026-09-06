# Database

AcadIQ uses **MySQL 8** running in Docker, managed with **Prisma ORM** from the `backend/` service.

## Why no raw `.sql` files here

The schema is defined once, as code, in [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). Prisma generates and applies versioned migrations from that file — that's the single source of truth, so this folder does not duplicate table definitions.

- `init/` is mounted into the MySQL container at `/docker-entrypoint-initdb.d`. It runs once, on a first-ever container start, before Prisma migrations. Use it only for things Prisma can't express (e.g., seeding a non-schema default like a timezone or charset tweak).
- Actual tables are created via `npm run prisma:migrate` (dev) or `npm run prisma:migrate:deploy` (CI/production) inside `backend/`.

## Tables

| Table | Purpose |
|---|---|
| `users` | Faculty & admin accounts, credentials, role |
| `faculty_profiles` | Department/designation metadata for faculty users |
| `courses` | Courses owned by a faculty member |
| `syllabus_documents` | Uploaded syllabus PDFs per course |
| `question_papers` | Uploaded exam papers per course, by year/semester |
| `questions` | Parsed questions per paper (topic, marks, Bloom level) |
| `analysis_reports` | AI analysis output (JSON) per faculty member |
| `recommendations` | Actionable suggestions tied to a report |

See [`docs/ER_DIAGRAM.md`](../docs/ER_DIAGRAM.md) for the full entity-relationship diagram.

## Common commands

```bash
# start MySQL only
docker compose up -d mysql

# apply migrations (from backend/)
npm run prisma:migrate

# inspect data visually
npm run prisma:studio
```

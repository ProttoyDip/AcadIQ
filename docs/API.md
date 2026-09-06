# AcadIQ REST API

Base URL: `http://localhost:5000/api`

All responses use a consistent envelope:

```json
// success
{ "success": true, "data": { ... } }

// error
{ "success": false, "error": { "message": "string", "details": {} } }
```

Authenticated routes require `Authorization: Bearer <JWT>`.

---

## Authentication

### `POST /auth/register`

Request body:
```json
{
  "name": "Dr. Jane Rahman",
  "email": "jane.rahman@aust.edu",
  "password": "SecurePass123",
  "role": "FACULTY",
  "department": "CSE",
  "designation": "Assistant Professor"
}
```

Response `201`:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "user": { "id": 1, "name": "Dr. Jane Rahman", "email": "jane.rahman@aust.edu", "role": "FACULTY" }
  }
}
```

Errors: `409` email already registered · `400` validation failure.

### `POST /auth/login`

Request body: `{ "email": "...", "password": "..." }`
Response `200`: same shape as register. Errors: `401` invalid credentials.

---

## Courses

All routes require authentication.

### `GET /courses`
Returns all courses owned by the authenticated faculty member.

### `GET /courses/:id`
Returns one course with its syllabus documents and question papers (incl. parsed questions). `404` if not found or not owned by the caller.

### `POST /courses`
```json
{ "courseCode": "CSE 3811", "courseName": "Artificial Intelligence", "description": "..." }
```
Response `201`: the created course.

---

## Document upload

### `POST /documents/upload` (multipart/form-data)

Canonical upload endpoint. Fields: `documentType` (`SYLLABUS` or `QUESTION_PAPER`), `courseId`, and `file` (PDF, <=10MB). Question papers also require `year` and `semester`.

The legacy frontend endpoints below remain available:

### `POST /upload/syllabus` (multipart/form-data)
Fields: `courseId`, `file` (PDF, ≤10MB). Response `201`: the stored `SyllabusDocument`.

### `POST /upload/question-paper` (multipart/form-data)
Fields: `courseId`, `year`, `semester`, `file` (PDF). The backend extracts text and auto-segments questions. Response `201`: the stored `QuestionPaper`.

---

## AI Analysis

### `POST /analysis/exam`
```json
{ "courseId": 1, "questionPaperId": 4 }
```
Runs the Exam Quality Analyzer against the course's latest syllabus. Response `201`:
```json
{
  "success": true,
  "data": {
    "reportId": 12,
    "overallScore": 78,
    "topicCoverage": [{ "topic": "Search algorithms", "coveredInExam": true, "questionCount": 2, "marksAllocated": 15 }],
    "bloomDistribution": [{ "level": "APPLY", "questionCount": 3, "marksAllocated": 20, "percentage": 30 }],
    "marksDistribution": [{ "topic": "Search algorithms", "marks": 15, "percentage": 25 }],
    "learningOutcomeAlignment": [{ "outcome": "Apply informed search to solve problems", "addressed": true }],
    "recommendations": [{ "message": "Too many recall-based questions; add more analytical items.", "priority": "HIGH" }]
  }
}
```
Errors: `400` no syllabus uploaded yet · `404` question paper not found · `502` AI response invalid/unavailable · `503` AI provider not configured.

### `POST /analysis/syllabus`
```json
{ "courseId": 1, "questionPaperId": 4 }
```
Runs the Syllabus Coverage Analyzer. Response `201`:
```json
{
  "success": true,
  "data": {
    "reportId": 13,
    "coveredTopics": ["Search algorithms", "Knowledge representation"],
    "missingTopics": ["Constraint satisfaction"],
    "overusedTopics": [{ "topic": "Search algorithms", "occurrences": 4 }],
    "coveragePercentage": 82
  }
}
```

### `POST /analysis/similarity`
```json
{ "courseId": 1, "currentPaperId": 4, "previousPaperId": 2 }
```
Runs the Question Similarity Detector between two papers of the same course. Response `201`:
```json
{
  "success": true,
  "data": {
    "reportId": 14,
    "matches": [{ "currentQuestionId": 21, "previousQuestionId": 9, "similarityPercentage": 87, "matchType": "DUPLICATE" }],
    "overallDuplicationPercentage": 22,
    "recommendation": "Replace 3 near-duplicate questions from last year's paper with new analytical items."
  }
}
```

### `POST /analysis/question-review`

```json
{ "courseId": 1, "questionPaperId": 4, "questionIds": [21, 22] }
```

`questionIds` is optional. Returns per-question clarity and Bloom-level review, a 0-100 `qualityScore`, issues, recommendations, and the persisted `reportId`.

### `POST /analysis/co-mapping`

```json
{
  "courseId": 1,
  "questionPaperId": 4,
  "courseOutcomes": [{ "code": "CO1", "description": "Apply relational database design principles" }]
}
```

`courseOutcomes` is optional; when omitted, explicitly labelled outcomes are inferred from the syllabus. Returns structured coverage percentages, mappings, unmapped questions, issues, recommendations, and a `reportId`.

The `/analyze/*` paths remain backwards-compatible aliases.

The exam response now also includes `qualityScore`, `coverage`, `difficulty`, `scoreFactors`, `positivePoints`, `issues`, and a decision/reason/confidence `explanation`. `overallScore`, `topicCoverage`, and `learningOutcomeAlignment` remain compatibility aliases.

### `POST /memory/check`

```json
{ "courseId": 1, "questionPaperId": 4, "similarityThreshold": 40 }
```

Checks a stored paper against earlier questions from the course. Preview workflows may supply `newQuestions` and `historicalQuestions` directly. Returns `similarQuestions`, highest `similarityScore`, `replacementSuggestion`, `explanation`, and a persisted `reportId`. Every match includes its reason, confidence, and historical semester/year.

`POST /analysis/memory` is an equivalent endpoint for clients that group all AI operations under `/analysis`.

### `POST /co/analyze`

```json
{
  "courseId": 1,
  "questionPaperId": 4,
  "courseOutcomes": [{ "code": "CO1", "description": "Apply relational database design principles" }]
}
```

Returns `questionCOMap`, per-outcome `coverage`, aggregate `coveragePercentage`, `missingOutcomes`, issues, recommendations, and an explanation. Outcomes and report-scoped mappings are persisted. `/analysis/co-mapping` remains available as an alias.

`POST /analysis/co` is also available as a concise analysis-route alias.

---

## Reports

### `GET /reports`
List all analysis reports (with their recommendations) for the authenticated faculty member.

### `GET /reports/:id`
Fetch one complete report with its JSON snapshot, recommendations, AI explanation, normalized exam score, and explained CO mappings. `404` if not found or not owned by the caller.

---

## Error handling conventions

| Status | Meaning |
|---|---|
| `400` | Validation failure or missing prerequisite (e.g., no syllabus uploaded) |
| `401` | Missing/invalid/expired JWT, or bad login credentials |
| `403` | Authenticated but role not permitted (`middleware/role.middleware.ts`) |
| `404` | Resource not found, or not owned by the caller |
| `409` | Conflict (duplicate email on register) |
| `429` | Rate limit exceeded (`express-rate-limit`) |
| `502` | AI provider returned an error or a response that failed schema validation |
| `503` | AI provider not configured (missing API key) |
| `500` | Unhandled server error (logged, generic message returned to client) |

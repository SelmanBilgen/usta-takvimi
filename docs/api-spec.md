# API Specification (v1)

Base URL: /api/v1

## 1. Public (Client) Endpoints

### GET /availability

Query params:

- expertiseId (required)
- startDate (required, YYYY-MM-DD)
- endDate (required, YYYY-MM-DD)

Response 200:

- expertiseId
- days: [
  - date
  - status (AVAILABLE | LIMITED | FULL)
  - freeCapacity
  - totalCapacity
]

Notes:

- Must not include worker names or IDs

### POST /requests

Body:

- clientId
- expertiseId
- startDate
- endDate
- description
- estimatedWorkerCount

Response 201:

- requestId
- status (PENDING)

Validation:

- endDate >= startDate
- estimatedWorkerCount >= 1

## 2. Admin Endpoints

### GET /admin/requests?status=PENDING

Response 200:

- requests: [
  - id
  - client
  - expertise
  - startDate
  - endDate
  - estimatedWorkerCount
  - status
]

### GET /admin/requests/:id/available-workers

Response 200:

- requestId
- workers: [
  - workerId
  - name
  - expertiseId
  - fullyAvailable (boolean)
  - conflictingDates (array YYYY-MM-DD)
]

### POST /admin/requests/:id/assignments

Body:

- workerIds: number[]

Response 200:

- requestId
- status (ASSIGNED)
- assignedWorkerCount
- assignedDatesCount

Error 409:

- code: ASSIGNMENT_CONFLICT
- message
- details: conflicting worker/date pairs

## 3. Optional Admin Maintenance

### PATCH /admin/requests/:id/status

Body:

- status (COMPLETED | CANCELED)

### PATCH /admin/workers/:id/daily-status

Body:

- dailyStatus (ACTIVE | INACTIVE)

## 4. Error Contract

All non-2xx responses:

- code
- message
- details (optional)
- correlationId

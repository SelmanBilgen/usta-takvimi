# UstaTakvimi Architecture Blueprint

## 1. Architecture Goals

- Clean code and high cohesion in modules
- Scalable read model for calendar availability
- Transaction-safe assignment operations
- Clear separation of client and admin concerns
- Auditable, deterministic assignment decisions

## 2. High-Level Design

The system follows a modular monolith first approach:

- Frontend app (Next.js): Client and Admin UI
- Backend API (Express): Domain-driven modules
- MySQL: Source of truth for requests and assignments

A modular monolith gives lower operational overhead in early stages and can be split into services later if needed.

## 3. Domain Modules

- Identity (optional future): users, roles, permissions
- Expertises: expertise dictionary management
- Workers: worker profile and daily status
- Clients: company/customer records
- Requests: request lifecycle
- Assignments: assignment and conflict detection
- Availability: calendar capacity projections

## 4. Backend Layering (Clean Code)

Each module should use this layering:

- Route: HTTP wiring and validation middleware
- Controller: maps request/response and use cases
- Service (Use Case): business rules and transactions
- Repository: data access only
- Mapper/DTO: transport contracts
- Domain Model: entities, value objects, enums

Dependency rule:

- Routes -> Controllers -> Services -> Repositories
- Services never depend on Express
- Repositories never return raw SQL rows outside module boundaries

## 5. Database Modeling Strategy

Core entities:

- expertises
- workers
- clients
- requests
- assignments

To support conflict detection, assignments are stored per worker per date.
This enables a strict unique constraint on (worker_id, assignment_date), which blocks double booking at DB level.

## 6. Availability Computation

Availability is expertise-based and anonymized.
The client never sees worker names.

For each day and expertise:

- total_capacity = count(active workers in expertise)
- used_capacity = count(assignments on that day for expertise workers)
- free_capacity = total_capacity - used_capacity
- usage_ratio = used_capacity / total_capacity

Status mapping example:

- Available: usage_ratio < 0.50
- Limited: 0.50 <= usage_ratio < 1.00
- Full: usage_ratio >= 1.00

Optional: expose numeric free_capacity for client-side badge rendering.

## 7. Request Lifecycle

Request statuses:

- PENDING
- ASSIGNED
- COMPLETED
- CANCELED

Transitions:

- PENDING -> ASSIGNED (when at least one worker-day assignment exists)
- ASSIGNED -> COMPLETED (manually closed)
- PENDING/ASSIGNED -> CANCELED (manual cancel)

Use explicit transition guard methods in service layer.

## 8. Assignment Use Case (Conflict-Safe)

Transaction flow:

1. Lock request row FOR UPDATE
2. Verify request is assignable (status, dates, expertise)
3. Expand date range into daily rows
4. Validate each worker has correct expertise and active status
5. Bulk insert assignment rows
6. If unique constraint violation occurs, rollback and return conflict error
7. If insertion successful, set request status to ASSIGNED
8. Commit

This approach protects against race conditions and parallel admin actions.

## 9. API Boundaries

Public APIs:

- Availability query by expertise and month/date-range
- Create request

Admin APIs:

- List pending requests
- List available workers for request range
- Assign workers to request

Do not expose worker names or IDs in public availability endpoints.

## 10. Frontend Architecture

Use Next.js App Router with feature folders:

- app/(public)/request
- app/(admin)/dashboard
- features/availability
- features/requests
- features/assignments
- shared/ui
- shared/api

State strategy:

- Server state: TanStack Query
- Form state: React Hook Form + Zod
- UI state: local component state or lightweight store

Calendar:

- FullCalendar day grid or timeline
- Color legend: Available / Limited / Full
- Tooltip: free_capacity and estimated demand guidance

## 11. Validation and Error Strategy

- Request validation with Zod/Joi at route boundary
- Centralized error middleware
- Domain errors mapped to HTTP:
  - ConflictError -> 409
  - ValidationError -> 400
  - NotFoundError -> 404

Standard error payload:

- code
- message
- details (optional)
- correlationId

## 12. Security and Access

- JWT auth for admin panel
- Role-based authorization (ADMIN)
- Public endpoint rate limit for request creation
- Input sanitization and SQL parameterization

## 13. Observability

- Structured logs (pino/winston)
- Request correlation IDs
- Metrics:
  - request creation rate
  - assignment conflict rate
  - average time from PENDING to ASSIGNED

## 14. Testing Strategy

- Unit tests for services (especially transitions and assignment guards)
- Repository integration tests with test MySQL
- API tests for critical flows
- Contract tests for availability payload

Critical test scenarios:

- same worker assigned twice on same day -> blocked
- canceled request cannot be assigned
- inactive worker cannot be assigned
- client availability never leaks worker identities

## 15. Scalability Path

When load grows:

- Add read replicas for availability queries
- Introduce Redis cache for monthly availability snapshots
- Move assignment operations to queue only if throughput requires
- Split Availability and Assignment modules into services if team/scale justifies

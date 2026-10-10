# Implementation Plan

## Phase 1 - Foundation

- Initialize monorepo with apps/web, apps/api, packages/shared
- Add linting, formatting, and commit hooks
- Add environment config and secret management
- Add migration tool and create schema from database/schema.sql

## Phase 2 - Core Backend Modules

- Build expertises, workers, clients, requests, assignments modules
- Implement request creation use case
- Implement availability read model endpoint
- Implement admin pending request listing
- Implement assignment use case with transaction and conflict handling

## Phase 3 - Frontend Client Flow

- Public request screen with expertise selector
- FullCalendar integration with capacity colors
- Request submission form with validation
- Confirmation and request tracking ID output

## Phase 4 - Frontend Admin Flow

- Admin login and protected routes
- Pending requests list
- Request detail with available/conflicting workers
- Manual assignment action with conflict feedback

## Phase 5 - Quality and Operations

- Unit, integration, and API tests
- Structured logs, metrics, and correlation IDs
- Basic CI pipeline for lint, test, migration check

## Suggested Package Split

- apps/api/src/modules/*
- apps/api/src/shared/*
- apps/web/src/features/*
- packages/shared/src/contracts/*
- packages/shared/src/enums/*

## Clean Code Checklist

- Keep use cases small and single-purpose
- Avoid framework-specific code in domain services
- Keep DTOs explicit and versioned
- Prefer composition over inheritance
- Add tests for each bug fixed

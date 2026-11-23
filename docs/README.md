# Personal Project Portfolio — v2.0

Independent project; not related to Goodnotes Digital Planner.

## Deliverables
- API Design (DOCX)
- UI Design (DOCX)
- Functional Specification (DOCX)
- Design System (DOCX)
- Responsive Admin/Public HTML prototype

## Preview
Open `Personal-Project-Portfolio-Prototype-v2.0.html` in a modern browser.

## Prototype scope
Admin/Public mode switch, dashboard metrics, project CRUD, repository multi-registration, repository visibility, project publication settings, public project list/detail, and localStorage persistence.

## Important limitations
This is a front-end prototype. Authentication, NestJS API, PostgreSQL, real file storage, GitHub OAuth/API synchronization, and production authorization are not implemented. Sample GitHub URLs are placeholders and must be replaced with actual repositories.

## Architecture
Two frontends (Admin Web and Public Web) communicate with one modular-monolith Backend API. Admin and Public endpoints are logically separated under `/api/v1/admin` and `/api/v1/public`.

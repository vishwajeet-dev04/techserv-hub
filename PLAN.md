# Techserv Company Hub — PLAN.md

## 1. Purpose

Build a deliberately simple internal **Company Hub** for TechServ.ai .

The application is NOT intended to compete with Salesforce, HubSpot, ERPNext, Odoo, or accounting software.

Its purpose is to give stakeholders one place to answer:

1. What business do we have?
2. What deals are in progress?
3. How much revenue are we generating?
4. What is our financial position?
5. What needs management attention?

The product must remain simple for a small team while having a clean architecture that can scale in users, data volume, modules, and integrations.

---

# 2. Product Principles

These principles are mandatory.

### 2.1 Simplicity over feature count

Do not add a feature merely because a conventional CRM has it.

Every feature must answer a concrete business need.

### 2.2 Modular monolith

Build one deployable application with clear internal modules.

Do NOT start with microservices.

The architecture must make future extraction into services possible without requiring a rewrite.

### 2.3 Database is the source of truth

Business calculations, financial metrics, deal values, and dashboard KPIs must be derived from persisted structured data.

LLMs must never be the authoritative source for calculations.

### 2.4 AI is an enrichment layer

Use AI for:

- document extraction
- classification
- summarisation
- management insights
- natural-language querying later

AI must not directly mutate critical business data without validation.

### 2.5 API-first

The frontend must communicate with the backend through APIs.

Do not put business logic inside React components.

### 2.6 Configuration over hardcoding

Pipeline stages, deal probabilities, financial metric definitions, dashboard configuration, etc. should be configurable where practical.

Do not create a generic configuration framework prematurely.

### 2.7 Internal product first

Optimize for TechServ's actual workflow.

Do not build multi-tenant SaaS architecture unless explicitly required later.

---

# 3. V1 Scope

Navigation should contain only:

- Dashboard
- Business
- Deals
- Finance
- Reports

Settings/Admin can be accessible separately.

---

# 4. Core Domain Model

V1 entities:

```text
User
Company
Contact
Deal
DealActivity
FinancialDocument
FinancialPeriod
FinancialMetric
Report
AuditLog
```

Future entities may include:

```text
Project
Employee
Invoice
Payment
Task
RFP
Proposal
CustomerInteraction
```

Do not implement future entities until required.

---

# 5. Entity Definitions

## 5.1 User

Represents an application user.

Fields:

- id
- name
- email
- password/auth identity
- role
- is_active
- created_at
- updated_at

Roles initially:

- ADMIN
- MANAGEMENT
- SALES
- FINANCE
- VIEWER

Use role-based access control, but keep permissions simple.

---

## 5.2 Company

Represents an organization/customer/prospect/partner.

Fields:

- id
- name
- company_type
- industry
- website
- location
- status
- owner_id
- notes
- created_at
- updated_at

Company status:

- PROSPECT
- CUSTOMER
- PARTNER
- INACTIVE

Do not create dozens of CRM fields.

---

## 5.3 Contact

Fields:

- id
- company_id
- first_name
- last_name
- designation
- email
- phone
- linkedin_url
- notes
- created_at
- updated_at

A contact belongs to one company initially.

---

## 5.4 Deal

Represents a commercial opportunity.

Fields:

- id
- company_id
- name
- description
- value
- currency
- stage
- probability
- expected_close_date
- owner_id
- source
- notes
- created_at
- updated_at

Default stages:

```text
LEAD
QUALIFIED
REQUIREMENT
PROPOSAL
NEGOTIATION
WON
LOST
```

Do not add complicated sales forecasting logic in V1.

Weighted pipeline:

```text
weighted_value = deal.value * deal.probability
```

This calculation belongs in backend/domain logic.

---

## 5.5 DealActivity

Represents meaningful activity against a deal.

Types:

- NOTE
- CALL
- MEETING
- EMAIL
- PROPOSAL
- FOLLOW_UP

Fields:

- id
- deal_id
- type
- subject
- description
- activity_date
- created_by
- created_at

---

# 6. Finance Module

The finance module is NOT an accounting system.

It is a financial intelligence layer.

The system should accept uploaded:

- PDF
- XLSX
- CSV

Financial documents may include:

- Profit & Loss
- Balance Sheet
- Cash Flow Statement
- Bank Statement
- Management financial reports

---

# 7. Financial Data Architecture

Separate:

1. Original document
2. Extracted data
3. Normalized financial metrics
4. Calculated KPIs
5. AI interpretation

Never mix these layers.

```text
Uploaded Document
       |
       v
Document Storage
       |
       v
Extraction
       |
       v
Raw Extracted Data
       |
       v
Validation / Normalization
       |
       v
Financial Metrics
       |
       v
Calculated KPIs
       |
       v
Dashboard / Reports
       |
       v
AI Insights
```

---

# 8. FinancialDocument

Fields:

- id
- file_name
- file_type
- storage_path
- document_type
- reporting_period
- uploaded_by
- extraction_status
- validation_status
- created_at
- updated_at

Extraction statuses:

```text
UPLOADED
PROCESSING
EXTRACTED
FAILED
```

Validation statuses:

```text
PENDING
VALID
REQUIRES_REVIEW
REJECTED
```

---

# 9. FinancialPeriod

Represents a reporting period.

Fields:

- id
- period_type
- start_date
- end_date
- label

Examples:

```text
April 2026
Q1 FY27
FY2026
```

---

# 10. FinancialMetric

Do not hardcode financial values directly into dashboard code.

Use normalized metrics.

Example:

```text
metric:
  revenue
  expenses
  gross_profit
  operating_profit
  net_profit
  cash
  receivables
  payables
  assets
  liabilities
  equity
```

Fields:

- id
- financial_period_id
- metric_code
- value
- currency
- source_document_id
- source_reference
- confidence
- created_at

`source_reference` should allow the UI to show where a value came from in the uploaded document when available.

---

# 11. Financial Extraction

The extraction pipeline must be asynchronous.

Never make a user wait synchronously for a large document.

```text
Upload
  |
  v
Create FinancialDocument
  |
  v
Queue extraction job
  |
  v
Extract text/tables
  |
  v
LLM/Document AI
  |
  v
Structured extraction
  |
  v
Validation
  |
  v
Persist FinancialMetric
```

Use background workers.

Recommended initial implementation:

- Django
- Celery
- Redis
- PostgreSQL

Do not introduce Kafka or a distributed event platform in V1.

---

# 12. AI Extraction Contract

LLM output must be structured.

Example:

```json
{
  "period": "FY2026",
  "metrics": [
    {
      "metric_code": "revenue",
      "value": 32000000,
      "currency": "INR",
      "source_reference": "Page 2 - Revenue",
      "confidence": 0.97
    }
  ]
}
```

The backend must validate:

- required fields
- numeric values
- supported metric codes
- currency
- reporting period
- confidence

Never directly save arbitrary LLM output into production financial tables.

---

# 13. Dashboard

The dashboard is the primary screen.

It should be simple and executive-oriented.

Initial KPI cards:

```text
Revenue
Monthly Revenue
Pipeline
Weighted Pipeline
Receivables
Payables
Cash
Profit
```

Initial sections:

### Sales

- pipeline by stage
- active deals
- expected closures
- won/lost

### Finance

- revenue trend
- expense trend
- profit trend
- receivables
- payables

### Business

- revenue by company
- top customers
- customer concentration

### Attention

Management alerts generated from deterministic rules initially.

Examples:

- overdue receivables
- large deal approaching close date
- revenue decline
- expense increase
- customer concentration

---

# 14. KPI Architecture

Do not calculate KPIs in the frontend.

Create a backend KPI/service layer.

Example:

```text
FinancialMetric
       |
       v
KPI Service
       |
       +--> Revenue Growth
       +--> Profit Margin
       +--> Pipeline
       +--> Weighted Pipeline
       +--> Receivables
       |
       v
Dashboard API
```

Frontend only renders returned values.

All KPI calculations must be deterministic and testable.

---

# 15. AI Management Insights

AI insights are a SECONDARY layer.

First calculate the numbers deterministically.

Then provide structured data to the LLM.

Example input:

```json
{
  "revenue_growth": 0.14,
  "profit_margin": 0.11,
  "receivables_growth": 0.22,
  "pipeline": 8200000,
  "weighted_pipeline": 3600000
}
```

The AI may produce:

```text
Receivables increased faster than revenue this month.
Management should review collection timelines.
```

The AI must not invent financial values.

Every numerical statement in an AI-generated insight must be traceable to backend-provided data.

---

# 16. Reports

V1 reports:

1. Monthly Business Summary
2. Sales Pipeline Report
3. Financial Summary
4. Customer Revenue Report

Reports should be generated from the same domain/KPI services used by dashboards.

Do not duplicate calculations inside report generation.

---

# 17. Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts or equivalent chart library
- React Query / TanStack Query

Use TypeScript strictly.

Avoid unnecessary frontend state-management frameworks.

---

## Backend

- Python
- Django
- Django REST Framework
- PostgreSQL

Use Django ORM.

Use service/domain modules for business logic rather than putting complex logic inside views or serializers.

---

## Async Processing

- Celery
- Redis

Use for:

- financial document processing
- report generation
- AI processing
- future scheduled jobs

---

## Storage

Use object storage for uploaded documents.

Development:

- local filesystem or MinIO

Production:

- S3-compatible storage / Azure Blob

Do not store uploaded documents directly in PostgreSQL.

---

# 18. Backend Architecture

Use a modular monolith.

Suggested structure:

```text
backend/
├── config/
│   ├── settings/
│   ├── urls.py
│   └── celery.py
│
├── apps/
│   ├── users/
│   ├── business/
│   ├── deals/
│   ├── finance/
│   ├── documents/
│   ├── dashboard/
│   ├── reports/
│   └── audit/
│
├── common/
│   ├── permissions/
│   ├── storage/
│   ├── exceptions/
│   ├── pagination/
│   └── utils/
│
└── manage.py
```

Each app should have clear boundaries.

Avoid circular dependencies.

---

# 19. Service Layer

Complex business operations belong in services.

Example:

```text
business/services/company_service.py
deals/services/deal_service.py
finance/services/extraction_service.py
finance/services/kpi_service.py
reports/services/report_service.py
```

Do not put business rules inside React.

Avoid putting complex business rules directly inside Django views.

---

# 20. API Design

Use REST APIs.

Example:

```text
/api/v1/dashboard
/api/v1/companies
/api/v1/contacts
/api/v1/deals
/api/v1/deals/{id}/activities
/api/v1/finance/documents
/api/v1/finance/periods
/api/v1/finance/metrics
/api/v1/reports
```

All APIs must be versioned.

Do not expose internal database structure unnecessarily.

---

# 21. Database Rules

Use PostgreSQL.

Every major table should include:

```text
id
created_at
updated_at
```

Use UUID primary keys for externally exposed entities.

Use foreign keys and database constraints.

Use indexes for:

- company name
- contact email
- deal stage
- deal owner
- expected close date
- financial period
- financial metric code

Avoid premature database optimization.

---

# 22. Data Integrity

Important financial/business data must have:

- validation
- constraints
- audit history where appropriate

A deleted financial document should not silently delete historical financial metrics.

Prefer soft deletion or archival for important business records.

---

# 23. Audit Logging

Record important changes:

- deal value changes
- deal stage changes
- financial document upload
- financial data approval
- user/role changes

AuditLog:

```text
id
user_id
entity_type
entity_id
action
old_value
new_value
timestamp
```

Do not build a complicated enterprise audit system in V1.

---

# 24. Security

Minimum requirements:

- authenticated APIs
- password hashing / secure auth
- role-based access
- HTTPS in production
- environment variables for secrets
- no secrets in source control
- file upload validation
- maximum upload size
- allowed MIME types
- protection against path traversal
- database backups

Financial documents must not be publicly accessible.

Use signed/private object-storage URLs.

---

# 25. Observability

Production must have:

- application logging
- error logging
- background job status
- basic health endpoint
- database connectivity health check

Health endpoint:

```text
/api/v1/health
```

Do not add a complex observability platform in V1.

---

# 26. Testing

Minimum testing requirements:

### Backend

- model tests where business rules exist
- service tests
- API tests
- financial calculation tests
- extraction validation tests

### Frontend

- critical component tests
- API integration tests for important workflows

### Mandatory financial tests

Test:

- revenue growth
- profit margin
- weighted pipeline
- period comparisons
- missing financial periods
- negative values
- currency handling

Financial calculations must have deterministic automated tests.

---

# 27. Development Rules for Cursor

Cursor MUST follow this document.

Before implementing a feature:

1. Inspect the existing architecture.
2. Identify the relevant domain module.
3. Reuse existing services/components.
4. Avoid introducing a new dependency unless necessary.
5. Update tests.
6. Update documentation when architecture changes.

Cursor must NOT:

- rewrite working modules unnecessarily
- introduce microservices
- introduce GraphQL without explicit approval
- introduce Kafka without explicit approval
- introduce a second database without explicit approval
- create generic enterprise frameworks
- duplicate business logic between frontend and backend
- put financial calculations in the frontend
- allow raw LLM output to directly modify financial records
- expose database credentials
- hardcode secrets
- create huge components/files when smaller modules are appropriate

---

# 28. Definition of Done

A feature is not complete until:

- API implemented
- validation implemented
- authorization considered
- frontend implemented
- error states implemented
- loading states implemented
- tests added
- database migrations created
- logging considered
- documentation updated where required

---

# 29. UI Principles

The UI must feel like an internal management application, not an enterprise CRM.

Use:

- clean layout
- minimal navigation
- clear typography
- generous whitespace
- simple tables
- simple charts
- obvious actions
- useful empty states

Avoid:

- excessive configuration
- complex sidebars
- nested navigation
- unnecessary modals
- dense CRM terminology
- feature clutter

The dashboard should answer questions in seconds.

---

# 30. V1 Implementation Order

Implement in this order:

## Phase 1 — Foundation

- repository setup
- Django
- PostgreSQL
- React
- TypeScript
- authentication
- Docker
- environment configuration
- CI
- base API structure

## Phase 2 — Business

- companies
- contacts
- users
- basic search
- company details

## Phase 3 — Deals

- deals
- pipeline
- stages
- deal activities
- weighted pipeline
- deal dashboard

## Phase 4 — Finance

- document upload
- financial periods
- financial metrics
- manual financial data entry
- financial dashboard

Manual financial entry MUST work before AI extraction is implemented.

## Phase 5 — AI Finance

- PDF/XLSX processing
- extraction
- structured validation
- human review
- persistence

## Phase 6 — Management Dashboard

- combined CRM + finance dashboard
- KPI services
- charts
- management alerts

## Phase 7 — Reports

- monthly business report
- sales report
- financial summary

## Phase 8 — AI Insights

- management summaries
- financial observations
- business questions

---

# 31. Future Architecture

Potential future integrations:

```text
                    COMPANY HUB
                         |
       ┌─────────────────┼─────────────────┐
       |                 |                 |
      CRM              Finance           AI
       |                 |                 |
       |                 |                 |
    Email          Accounting API      RFP/BidBrain
    Calendar       Banking             Proposal AI
    WhatsApp       Invoicing           Estimation AI
```

Potential future modules:

- Projects
- Resource allocation
- Invoicing
- Payments
- RFP management
- Proposal management
- Customer health
- Forecasting
- AI business assistant

Do not implement these until there is a real requirement.

---

# 32. Scalability Strategy

The application should scale vertically and horizontally without architectural rewrites.

Initial:

```text
React
  |
Django
  |
PostgreSQL
  |
Redis/Celery
```

Later:

```text
Load Balancer
      |
 ┌────┴────┐
Django   Django
 └────┬────┘
      |
 PostgreSQL
      |
 Redis/Celery
      |
 Object Storage
```

The modular monolith remains the application boundary.

Only extract a service when there is a demonstrated operational reason.

---

# 33. Performance Guidelines

V1 targets:

- Dashboard API < 1 second for normal datasets
- CRUD API < 500 ms for normal operations
- Pagination on all list APIs
- No unbounded queries
- Avoid N+1 database queries
- Lazy-load large datasets
- Async processing for document/AI operations

Do not optimize prematurely.

---

# 34. Search

V1:

- company name
- contact name/email
- deal name/company

Use PostgreSQL search capabilities initially.

Do not introduce Elasticsearch/OpenSearch unless actual scale requires it.

---

# 35. Deployment

Containerize the application.

Required containers/services initially:

```text
frontend
backend
postgres
redis
worker
```

Production configuration must use environment variables.

Create:

```text
.env.example
docker-compose.yml
Dockerfile(s)
README.md
```

Never commit `.env`.

---

# 36. Documentation

Maintain:

```text
PLAN.md
README.md
ARCHITECTURE.md
API.md
```

PLAN.md is the product/architecture contract.

ARCHITECTURE.md documents significant architectural decisions.

If a proposed change contradicts PLAN.md, stop and flag it rather than silently changing the architecture.

---

# 37. Product Philosophy

The product should feel like:

> "I open it and immediately know what is happening in the company."

Not:

> "I open it and have to configure a CRM."

The winning feature is not the number of modules.

The winning feature is **clarity**.

Keep the core small.

Build the architecture properly.

Add complexity only when the business actually demands it.

---

# 38. Cursor Instruction

When working on this repository, treat this file as a governing architectural specification.

Before making substantial changes:

1. Read PLAN.md.
2. Inspect relevant existing code.
3. State the intended approach briefly.
4. Implement the smallest solution that satisfies the requirement.
5. Preserve existing architectural boundaries.
6. Add/update tests.
7. Do not introduce unnecessary dependencies.
8. Do not expand scope without explicit instruction.

If a requested feature conflicts with this plan, identify the conflict and propose the smallest architectural change required.

**Do not silently redesign the system.**

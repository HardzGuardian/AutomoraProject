# AMC Management System --- Person 2 Backend

Backend implementation for the **Sales / Core Operations** side of an
Annual Maintenance Contract (AMC) Management System.

This module is responsible for managing the complete sales-side
lifecycle of:

-   Clients
-   Client Contacts
-   Client Sites
-   Assets
-   Service Types
-   Contracts
-   Contract Documents
-   Contract SLAs
-   Renewals
-   Renewal Follow-ups
-   Contract status automation
-   Renewal reminder automation

The implementation follows the project's modular backend architecture
and the responsibilities defined for **Person 2** in the backend team
split.

------------------------------------------------------------------------

## Table of Contents

-   [Project Overview](#project-overview)
-   [Person 2 Scope](#person-2-scope)
-   [Architecture](#architecture)
-   [Technology Stack](#technology-stack)
-   [Project Structure](#project-structure)
-   [Implemented Modules](#implemented-modules)
    -   [Client Module](#1-client-module)
    -   [Asset Module](#2-asset-module)
    -   [Contract Module](#3-contract-module)
    -   [Service Type Module](#4-service-type-module)
    -   [Renewal Module](#5-renewal-module)
    -   [Background Jobs](#6-background-jobs)
-   [Database Schema](#database-schema)
-   [API Endpoints](#api-endpoints)
-   [Authentication and
    Authorization](#authentication-and-authorization)
-   [Cross-Person Dependencies](#cross-person-dependencies)
-   [Audit Logging](#audit-logging)
-   [Contract Lifecycle](#contract-lifecycle)
-   [Renewal Lifecycle](#renewal-lifecycle)
-   [Background Jobs](#background-jobs)
-   [Validation and Error Handling](#validation-and-error-handling)
-   [Testing](#testing)
-   [Environment Setup](#environment-setup)
-   [Running the Backend](#running-the-backend)
-   [Development Notes](#development-notes)
-   [Known Unresolved Decisions](#known-unresolved-decisions)
-   [Current Limitations / Pending
    Dependencies](#current-limitations--pending-dependencies)
-   [Definition of Done](#definition-of-done)

------------------------------------------------------------------------

# Project Overview

The AMC Management System is designed to centralize the lifecycle of
maintenance contracts, replacing spreadsheet-based tracking with an
auditable and automated workflow.

The overall system covers:

``` text
Client Onboarding
       ↓
Contract Creation
       ↓
Asset Association
       ↓
Service Scheduling
       ↓
Field Visits / Tickets
       ↓
Invoicing
       ↓
Renewal
       ↓
Reporting
```

Person 2 owns the **Sales / Core Operations** portion of this lifecycle:

``` text
Client
  ↓
Contract
  ↓
Assets
  ↓
Renewal
```

The requirements define client profiles, contacts, sites, contract
terms, assets, renewal tracking, expiry alerts, and automated reminders
as core capabilities of the AMC platform.

------------------------------------------------------------------------

# Person 2 Scope

According to the backend team split, Person 2 owns:

  Area            Responsibility
  --------------- ----------------------------------------------------
  Clients         Client CRUD, contacts, sites, history
  Contracts       Contract lifecycle, assets, SLA, documents, status
  Assets          Asset CRUD, site/contract linking, service history
  Service Types   Service type CRUD
  Renewals        Renewal tracking, quotes, follow-ups, outcomes
  Jobs            Contract status and renewal reminder jobs

Person 2 owns the feature-level implementation of routes, controllers,
services, validators, tests, and jobs where applicable.

The following areas are owned by other team members:

-   Foundation / Auth / Admin / Users / Audit / Uploads --- Person 1
-   Scheduling / Visits / Tickets / SLA --- Person 3
-   Invoices / Payments / Notifications / Reports --- Person 4

------------------------------------------------------------------------

# Architecture

The backend follows a **modular monolith** architecture.

The main request flow is:

``` text
Client / Frontend
       │
       ▼
    Express
       │
       ▼
    Routes
       │
       ▼
 Authentication
       │
       ▼
 Authorization / RBAC
       │
       ▼
   Validation
       │
       ▼
   Controller
       │
       ▼
    Service
       │
       ▼
     Prisma
       │
       ▼
   PostgreSQL
```

### Layer Responsibilities

  -----------------------------------------------------------------------
  Layer                               Responsibility
  ----------------------------------- -----------------------------------
  Routes                              Define REST API endpoints and
                                      attach middleware

  Middleware                          Authentication, authorization,
                                      validation, errors, uploads

  Controllers                         HTTP request/response handling

  Services                            Business logic, rules, transactions
                                      and orchestration

  Validators                          Request data validation

  Prisma                              Database access and relations

  PostgreSQL                          Persistent data storage

  Jobs                                Scheduled background operations
  -----------------------------------------------------------------------

### Important Design Rule

Business logic belongs in **services**, not in routes or controllers.

For example:

``` text
PATCH /api/v1/contracts/:id/activate
                ↓
       contract.routes.ts
                ↓
       auth / role middleware
                ↓
       contract.controller.ts
                ↓
        contract.service.ts
                ↓
             Prisma
```

------------------------------------------------------------------------

# Technology Stack

## Backend

-   Node.js
-   Express.js
-   TypeScript
-   REST API

## Database

-   PostgreSQL
-   Prisma ORM

## Validation

-   Zod

## Authentication / Security

-   JWT-based authentication
-   Role-Based Access Control (RBAC)
-   Shared authentication and authorization middleware from Person 1

## Background Jobs

-   `node-cron`

## Testing

-   Unit tests
-   Supertest-based integration test setup

------------------------------------------------------------------------

# Project Structure

The Person 2 implementation is organized into feature modules:

``` text
src/
│
├── modules/
│   │
│   ├── client/
│   │   ├── client.validator.ts
│   │   ├── client.service.ts
│   │   ├── client.controller.ts
│   │   └── client.routes.ts
│   │
│   ├── asset/
│   │   ├── asset.validator.ts
│   │   ├── asset.service.ts
│   │   ├── asset.controller.ts
│   │   └── asset.routes.ts
│   │
│   ├── contract/
│   │   ├── contract.validator.ts
│   │   ├── contract.service.ts
│   │   ├── contract.controller.ts
│   │   └── contract.routes.ts
│   │
│   ├── serviceType/
│   │   ├── serviceType.validator.ts
│   │   ├── serviceType.service.ts
│   │   ├── serviceType.controller.ts
│   │   └── serviceType.routes.ts
│   │
│   └── renewal/
│       ├── renewal.validator.ts
│       ├── renewal.service.ts
│       ├── renewal.controller.ts
│       └── renewal.routes.ts
│
├── jobs/
│   ├── contractStatus.job.ts
│   ├── renewalReminder.job.ts
│   └── index.ts
│
├── config/
├── middleware/
├── types/
├── utils/
├── app.ts
└── server.ts
```

------------------------------------------------------------------------

# Implemented Modules

## 1. Client Module

### Responsibilities

The Client module manages:

-   Client profiles
-   Client contacts
-   Client sites
-   Client history
-   Client access/scoping

### Client Profile

Supported fields include:

-   Company name
-   Industry
-   Category
-   Tax / GST ID
-   Address
-   Notes
-   Assigned user support in schema

### Client Categories

``` text
CORPORATE
RETAIL
GOVERNMENT
```

### Client Operations

-   Create
-   Read
-   Update
-   Soft delete
-   List
-   Search
-   Filtering
-   Pagination
-   History timeline

### Contacts

Each client can have multiple contacts.

Supported operations:

-   Create
-   Read
-   Update
-   Delete
-   Primary contact management

### Sites

Each client can have multiple service sites.

Supported fields include:

-   Site name
-   Address
-   City
-   State
-   Pincode

Supported operations:

-   Create
-   Read
-   Update
-   Delete
-   List assets associated with a site

------------------------------------------------------------------------

# 2. Asset Module

Assets represent the physical or digital equipment maintained under AMC
contracts.

### Asset Information

-   Serial number
-   Model
-   Manufacturer
-   Install date
-   Warranty expiry
-   Notes

### Asset Operations

-   Create
-   Read
-   Update
-   List
-   Serial number uniqueness validation
-   Site linking
-   Contract linking
-   Service history retrieval

### Asset Relationships

``` text
Client
  │
  └── Site
       │
       └── Asset
            │
            └── Contract
```

An asset can be associated with multiple contracts over its lifetime.

A join model is used for contract-asset relationships.

------------------------------------------------------------------------

# 3. Contract Module

The Contract module is the central business module of Person 2's
implementation.

Contracts connect:

``` text
Client
  +
Assets
  +
Service Terms
  +
SLA
  +
Renewal
```

### Contract Information

-   Contract number
-   Client
-   Contract type
-   Contract status
-   Start date
-   End date
-   Renewal date
-   Contract value
-   Payment terms
-   Billing frequency
-   Included visits
-   Notes

### Contract Types

``` text
COMPREHENSIVE
NON_COMPREHENSIVE
```

### Contract Statuses

``` text
DRAFT
ACTIVE
EXPIRING_SOON
EXPIRED
CANCELLED
```

### Payment Frequencies

``` text
MONTHLY
QUARTERLY
HALF_YEARLY
ANNUAL
```

### Contract Operations

-   Create
-   Update
-   Activate
-   Cancel
-   Status calculation
-   Expiring contract lookup
-   Asset linking
-   Asset unlinking
-   Document management
-   SLA management

### Contract Creation

Contract creation performs a transaction covering the relevant
contract-domain records.

The operation includes:

``` text
Validate Client
      ↓
Validate Assets
      ↓
Calculate Renewal Date
      ↓
Create Contract
      ↓
Create ContractAsset records
      ↓
Create ContractSLA where required
      ↓
Create Renewal record
      ↓
Audit
```

The renewal date convention is:

``` text
renewalDate = endDate - 30 days
```

### Contract Status Calculation

Status calculation is centralized.

The lifecycle is:

``` text
DRAFT
  ↓
ACTIVE
  ↓
EXPIRING_SOON
  ↓
EXPIRED
```

`CANCELLED` is protected from automatic status transitions.

------------------------------------------------------------------------

# 4. Service Type Module

Service Types represent reusable maintenance/service definitions.

Supported operations:

-   Create
-   Read
-   Update
-   Delete

Supported fields:

-   Name
-   Description
-   Estimated duration
-   Base price

Service types currently have protection against deletion when they are
in use.

------------------------------------------------------------------------

# 5. Renewal Module

The Renewal module tracks the lifecycle of contract renewals.

### Renewal Statuses

``` text
PENDING
IN_DISCUSSION
RENEWED
NOT_RENEWED
```

### Renewal Operations

-   List renewals
-   Get renewal
-   List expiring contracts
-   Update renewal status
-   Process renewal
-   Mark as not renewed
-   Track quotes
-   Add follow-ups
-   List follow-ups

### Renewal Quotes

The renewal record tracks the number/status of quotes sent through
`quotesSent`.

### Follow-ups

Follow-ups are stored as historical records.

Example:

``` text
Renewal
 ├── Follow-up 1
 ├── Follow-up 2
 ├── Follow-up 3
 └── Outcome
```

Existing follow-ups are not overwritten.

------------------------------------------------------------------------

# 6. Background Jobs

Two scheduled jobs are implemented.

## Contract Status Job

File:

``` text
src/jobs/contractStatus.job.ts
```

Runs daily at:

``` text
01:00 UTC
```

Responsibilities:

-   Find contracts requiring status changes
-   Transition `ACTIVE → EXPIRING_SOON`
-   Transition `EXPIRING_SOON → EXPIRED`
-   Skip `CANCELLED` contracts
-   Keep execution idempotent
-   Handle individual failures safely

## Renewal Reminder Job

File:

``` text
src/jobs/renewalReminder.job.ts
```

Runs daily at:

``` text
08:00 UTC
```

Responsibilities:

-   Find contracts approaching expiry
-   Process 30-day reminders
-   Process 60-day reminders
-   Process 90-day reminders
-   De-duplicate reminders using `ReminderLog`
-   Call the notification service interface

The job is designed to be idempotent.

Running it more than once should not send duplicate reminders for the
same reminder period.

------------------------------------------------------------------------

# Database Schema

Person 2 extends the shared Prisma schema.

## New Enums

``` text
ClientCategory
├── CORPORATE
├── RETAIL
└── GOVERNMENT

ContractType
├── COMPREHENSIVE
└── NON_COMPREHENSIVE

ContractStatus
├── DRAFT
├── ACTIVE
├── EXPIRING_SOON
├── EXPIRED
└── CANCELLED

PaymentFrequency
├── MONTHLY
├── QUARTERLY
├── HALF_YEARLY
└── ANNUAL

RenewalStatus
├── PENDING
├── IN_DISCUSSION
├── RENEWED
└── NOT_RENEWED
```

`SALES` was also added to the existing `UserRole` enum.

## New Models

``` text
Client
ClientContact
ClientSite
Asset
AssetSite
ServiceType
Contract
ContractAsset
ContractDocument
ContractSLA
Renewal
RenewalFollowUp
ReminderLog
```

`UploadedFile` was extended with the contract-document relationship.

## Key Relationships

``` text
Client
 ├── ClientContact[]
 ├── ClientSite[]
 └── Contract[]

ClientSite
 └── AssetSite[]

Asset
 ├── AssetSite[]
 └── ContractAsset[]

Contract
 ├── ContractAsset[]
 ├── ContractDocument[]
 ├── ContractSLA
 └── Renewal

Renewal
 └── RenewalFollowUp[]

ReminderLog
 └── Contract
```

------------------------------------------------------------------------

# API Endpoints

All Person 2 endpoints use the `/api/v1` prefix.

## Clients

  Method   Endpoint                        Access
  -------- ------------------------------- -----------------------
  POST     `/api/v1/clients`               ADMIN, MANAGER, SALES
  GET      `/api/v1/clients`               ADMIN, MANAGER, SALES
  GET      `/api/v1/clients/:id`           ADMIN, MANAGER, SALES
  PATCH    `/api/v1/clients/:id`           ADMIN, MANAGER, SALES
  DELETE   `/api/v1/clients/:id`           ADMIN, MANAGER
  GET      `/api/v1/clients/:id/history`   ADMIN, MANAGER, SALES

## Client Contacts

  Method   Endpoint                         Access
  -------- -------------------------------- -----------------------
  POST     `/api/v1/clients/contacts`       ADMIN, MANAGER, SALES
  GET      `/api/v1/clients/contacts/:id`   ADMIN, MANAGER, SALES
  PATCH    `/api/v1/clients/contacts/:id`   ADMIN, MANAGER, SALES
  DELETE   `/api/v1/clients/contacts/:id`   ADMIN, MANAGER

## Client Sites

  Method   Endpoint                             Access
  -------- ------------------------------------ -----------------------
  POST     `/api/v1/clients/sites`              ADMIN, MANAGER, SALES
  GET      `/api/v1/clients/sites/:id`          ADMIN, MANAGER, SALES
  GET      `/api/v1/clients/sites/:id/assets`   ADMIN, MANAGER, SALES
  PATCH    `/api/v1/clients/sites/:id`          ADMIN, MANAGER, SALES
  DELETE   `/api/v1/clients/sites/:id`          ADMIN, MANAGER

## Assets

  Method   Endpoint                               Access
  -------- -------------------------------------- -----------------------
  POST     `/api/v1/assets`                       ADMIN, MANAGER, SALES
  GET      `/api/v1/assets`                       ADMIN, MANAGER, SALES
  GET      `/api/v1/assets/:id`                   ADMIN, MANAGER, SALES
  PATCH    `/api/v1/assets/:id`                   ADMIN, MANAGER, SALES
  GET      `/api/v1/assets/:id/service-history`   ADMIN, MANAGER, SALES

## Contracts

  ------------------------------------------------------------------------------------------
  Method                  Endpoint                                   Access
  ----------------------- ------------------------------------------ -----------------------
  POST                    `/api/v1/contracts`                        ADMIN, MANAGER, SALES

  GET                     `/api/v1/contracts`                        ADMIN, MANAGER, SALES

  GET                     `/api/v1/contracts/:id`                    ADMIN, MANAGER, SALES

  PATCH                   `/api/v1/contracts/:id`                    ADMIN, MANAGER, SALES

  PATCH                   `/api/v1/contracts/:id/activate`           ADMIN, MANAGER

  PATCH                   `/api/v1/contracts/:id/cancel`             ADMIN, MANAGER

  POST                    `/api/v1/contracts/:id/assets`             ADMIN, MANAGER, SALES

  DELETE                  `/api/v1/contracts/:id/assets/:assetId`    ADMIN, MANAGER, SALES

  POST                    `/api/v1/contracts/:id/documents`          ADMIN, MANAGER, SALES

  GET                     `/api/v1/contracts/:id/documents`          ADMIN, MANAGER, SALES

  DELETE                  `/api/v1/contracts/:id/documents/:docId`   ADMIN, MANAGER

  GET                     `/api/v1/contracts/:id/sla`                ADMIN, MANAGER, SALES

  PUT                     `/api/v1/contracts/:id/sla`                ADMIN, MANAGER
  ------------------------------------------------------------------------------------------

## Service Types

  Method   Endpoint                      Access
  -------- ----------------------------- -----------------------
  POST     `/api/v1/service-types`       ADMIN, MANAGER
  GET      `/api/v1/service-types`       ADMIN, MANAGER, SALES
  GET      `/api/v1/service-types/:id`   ADMIN, MANAGER, SALES
  PATCH    `/api/v1/service-types/:id`   ADMIN, MANAGER
  DELETE   `/api/v1/service-types/:id`   ADMIN

## Renewals

  Method   Endpoint                             Access
  -------- ------------------------------------ -----------------------
  GET      `/api/v1/renewals`                   ADMIN, MANAGER, SALES
  GET      `/api/v1/renewals/expiring`          ADMIN, MANAGER, SALES
  GET      `/api/v1/renewals/:id`               ADMIN, MANAGER, SALES
  PATCH    `/api/v1/renewals/:id/status`        ADMIN, MANAGER, SALES
  POST     `/api/v1/renewals/:id/process`       ADMIN, MANAGER
  PATCH    `/api/v1/renewals/:id/not-renewed`   ADMIN, MANAGER
  POST     `/api/v1/renewals/:id/follow-ups`    ADMIN, MANAGER, SALES
  GET      `/api/v1/renewals/:id/follow-ups`    ADMIN, MANAGER, SALES

------------------------------------------------------------------------

# Authentication and Authorization

Person 2 uses the shared authentication and RBAC infrastructure
implemented by Person 1.

Supported roles relevant to this module include:

``` text
ADMIN
MANAGER
SALES
CUSTOMER
```

Role checks are enforced through shared middleware.

Resource ownership/scoping is enforced at the service layer where
required.

## Client Portal

The optional client portal is intended to expose only records belonging
to the authenticated client.

The service layer is responsible for preventing access to another
client's:

-   Client records
-   Contracts
-   Assets

The exact mapping between `CUSTOMER` users and Client records remains
unresolved.

------------------------------------------------------------------------

# Cross-Person Dependencies

Person 2 depends on services owned by other team members.

## Person 1 --- Foundation

### Audit Service

``` text
auditService.log(params, tx?)
```

Status:

``` text
READY
```

Used throughout Person 2 write operations.

### Upload Service

``` text
uploadService.saveFile(file, userId)
```

Status:

``` text
READY
```

Used for contract document handling.

------------------------------------------------------------------------

## Person 3 --- Scheduling

### Scheduling Service

``` text
schedulingService.generateVisits(contract)
```

Status:

``` text
STUBBED
```

This dependency is required when contract activation triggers visit
generation.

The stub is intentionally retained until Person 3's real scheduling
implementation is available.

------------------------------------------------------------------------

## Person 4 --- Notifications

### Notification Service

``` text
notificationService.sendRenewalReminder(...)
```

Status:

``` text
STUBBED
```

The renewal reminder job calls this interface.

The actual email/SMS/WhatsApp provider implementation belongs to Person
4.

------------------------------------------------------------------------

# Audit Logging

Person 2 uses the shared audit infrastructure rather than implementing a
separate audit system.

Audit events are generated for important writes, including:

-   Client creation/update/deletion
-   Contact changes
-   Site changes
-   Asset changes
-   Contract creation/update/activation/cancellation
-   Contract asset linking/unlinking
-   Contract document operations
-   SLA changes
-   Renewal changes
-   Renewal follow-ups
-   Automated contract status changes where applicable

Audit actions and entities are registered in:

``` text
src/config/constants.ts
```

------------------------------------------------------------------------

# Contract Lifecycle

The implemented contract lifecycle is:

``` text
                    ┌───────────────┐
                    │     DRAFT     │
                    └───────┬───────┘
                            │
                         Activate
                            │
                            ▼
                    ┌───────────────┐
                    │     ACTIVE    │
                    └───────┬───────┘
                            │
                  Expiry threshold reached
                            │
                            ▼
                  ┌───────────────────┐
                  │   EXPIRING_SOON   │
                  └─────────┬─────────┘
                            │
                       End date reached
                            │
                            ▼
                    ┌───────────────┐
                    │    EXPIRED    │
                    └───────────────┘

At applicable points:
ACTIVE / EXPIRING_SOON
          │
       Cancel
          ▼
     CANCELLED
```

`CANCELLED` contracts are protected from automatic status transitions.

------------------------------------------------------------------------

# Renewal Lifecycle

Renewal status values:

``` text
PENDING
   ↓
IN_DISCUSSION
   ↓
RENEWED
```

or:

``` text
PENDING / IN_DISCUSSION
          ↓
     NOT_RENEWED
```

Renewal follow-ups are historical records and can occur multiple times
before an outcome is recorded.

The renewal date is calculated as:

``` text
Contract End Date - 30 Days
```

------------------------------------------------------------------------

# Background Jobs

## Contract Status Job

``` text
Every day at 01:00 UTC

Find eligible contracts
        ↓
Calculate current status
        ↓
Update required status
        ↓
Audit change where applicable
```

Transitions:

``` text
ACTIVE
  ↓
EXPIRING_SOON
  ↓
EXPIRED
```

Cancelled contracts are skipped.

The job is idempotent and error-safe.

## Renewal Reminder Job

``` text
Every day at 08:00 UTC

Find contracts reaching:
30 days
60 days
90 days
        ↓
Check ReminderLog
        ↓
Skip if already sent
        ↓
Send renewal reminder
        ↓
Record reminder
```

Reminder de-duplication is handled using:

``` text
ReminderLog
```

------------------------------------------------------------------------

# Validation and Error Handling

Request validation is implemented using Zod validators.

Validation covers:

-   Required fields
-   Data types
-   Enums
-   Dates
-   IDs
-   Numeric values
-   Contract fields
-   Renewal fields
-   Contact fields
-   Site fields
-   Asset fields

The shared error-handling infrastructure is used rather than creating
module-specific error middleware.

Typical API error semantics include:

``` text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
500 Internal Server Error
```

Examples of domain errors include:

``` text
CLIENT_NOT_FOUND
CONTRACT_NOT_FOUND
ASSET_NOT_FOUND
RENEWAL_NOT_FOUND
INVALID_CONTRACT_STATE
INVALID_RENEWAL_STATE
DUPLICATE_CONTRACT_ASSET
```

------------------------------------------------------------------------

# Testing

Person 2 includes automated tests for critical business logic and jobs.

## Test Suites

  Test Suite                         Tests Status
  ------------------------------- -------- --------------
  `contract.service.test.ts`             9 PASS
  `contractStatus.job.test.ts`           5 PASS
  `renewal.service.test.ts`              7 PASS
  `renewalReminder.job.test.ts`          5 PASS
  **Total**                         **26** **ALL PASS**

## Test Coverage Areas

### Contracts

-   Contract creation
-   Contract validation
-   Contract dates
-   Renewal date calculation
-   Status calculation
-   Activation
-   Cancellation
-   Expiring contracts

### Renewals

-   Renewal retrieval
-   Status transitions
-   Renewal processing
-   Not-renewed outcome
-   Follow-ups

### Jobs

-   Contract status transitions
-   Cancelled contract protection
-   30/60/90-day reminders
-   Reminder de-duplication
-   Idempotency

------------------------------------------------------------------------

# Environment Setup

Create a `.env` file based on the project's `.env.example`.

The application requires the environment configuration established by
the foundation layer, including the database connection and
authentication configuration.

Do not commit `.env` or production secrets to source control.

------------------------------------------------------------------------

# Running the Backend

Install dependencies:

``` bash
npm install
```

Generate Prisma client:

``` bash
npx prisma generate
```

Apply the database schema/migrations according to the project's Prisma
workflow:

``` bash
npx prisma migrate dev
```

Start development server:

``` bash
npm run dev
```

Build the TypeScript project:

``` bash
npm run build
```

Run tests using the project's configured test command:

``` bash
npm test
```

The exact scripts should be taken from the repository's current
`package.json`.

------------------------------------------------------------------------

# Development Notes

## Shared File Ownership

The following are shared/foundation files and should not be modified
casually:

``` text
prisma/schema.prisma
src/config/constants.ts
src/app.ts
src/server.ts
package.json
```

Person 2 has made only the changes required for the Person 2
implementation.

## Cross-Domain Access

A team rule is:

> A module should not directly query another person's domain tables from
> its service when a service-level interface should be used instead.

Person 2 therefore uses service dependencies for cross-person
functionality where required.

## Business Logic Location

Business rules belong in:

``` text
*.service.ts
```

Controllers remain HTTP adapters.

Routes remain endpoint definitions.

Validators handle request validation.

Jobs call service-level functionality rather than duplicating business
logic.

------------------------------------------------------------------------

# Known Unresolved Decisions

## 1. Sales Access Scoping

The team has not finalized whether `SALES` users should see:

``` text
A. Only their assigned clients
```

or:

``` text
B. All clients
```

The schema supports `assignedToId`, but the service does not enforce a
specific Sales ownership policy until the team makes this decision.

The relevant implementation is documented with:

``` text
// UNRESOLVED DECISION: Sales access scoping
```

------------------------------------------------------------------------

## 2. Client Portal User Mapping

The `CUSTOMER` role is intended for client-portal access, but the exact
mapping between an authenticated customer user and a `Client` record has
not yet been finalized.

The current implementation does not expose unrestricted
client-management access to `CUSTOMER` users.

A dedicated user-to-client mapping strategy still needs to be finalized.

------------------------------------------------------------------------

## 3. Renewal Date

This decision is resolved.

The project convention is:

``` text
renewalDate = endDate - 30 days
```

------------------------------------------------------------------------

# Current Limitations / Pending Dependencies

The Person 2 module is implemented, but two cross-person integrations
remain dependent on other team members.

  Dependency                                       Owner      Status
  ------------------------------------------------ ---------- --------------
  `schedulingService.generateVisits(contract)`     Person 3   STUBBED
  `notificationService.sendRenewalReminder(...)`   Person 4   STUBBED
  `auditService.log(...)`                          Person 1   READY / USED
  `uploadService`                                  Person 1   READY / USED

The scheduling dependency will be connected when Person 3's scheduling
service is available.

The notification dependency will be connected when Person 4's
notification service is available.

Integration tests requiring a real database remain dependent on the
project's test database/environment setup.

------------------------------------------------------------------------

# Implementation Status

## Overall

``` text
Person 2 Backend
────────────────────────────────────
Clients              ✅ COMPLETE
Contacts             ✅ COMPLETE
Sites                ✅ COMPLETE
Assets               ✅ COMPLETE
Contracts            ✅ COMPLETE
Contract Documents   ✅ COMPLETE
Contract SLA         ✅ COMPLETE
Service Types        ✅ COMPLETE
Renewals             ✅ COMPLETE
Renewal Follow-ups   ✅ COMPLETE
Contract Status Job  ✅ COMPLETE
Renewal Reminder Job ✅ COMPLETE
Audit Integration    ✅ COMPLETE
Upload Integration   ✅ COMPLETE
Scheduling Integration 🔲 STUBBED
Notification Integration 🔲 STUBBED
```

## Build and Tests

``` text
TypeScript compilation   ✅ CLEAN
Automated tests          ✅ 26/26 PASS
Background jobs          ✅ IMPLEMENTED
RBAC integration         ✅ IMPLEMENTED
Audit integration        ✅ IMPLEMENTED
Upload integration       ✅ IMPLEMENTED
```

The TypeScript build has only the expected `seed.ts` root-directory
warning noted during implementation.

------------------------------------------------------------------------

# Definition of Done

A Person 2 module is considered complete when:

-   [x] Routes exist
-   [x] Controllers exist
-   [x] Services exist where required
-   [x] Validators exist where required
-   [x] RBAC is applied
-   [x] Business rules are implemented
-   [x] Contract and renewal state rules are enforced
-   [x] Database relationships are validated
-   [x] Transactions are used where appropriate
-   [x] Audit logging is integrated
-   [x] Shared error handling is used
-   [x] Shared response handling is used
-   [x] Critical tests exist
-   [x] Background jobs are implemented
-   [x] Background jobs are idempotent
-   [x] Cross-person dependencies use defined interfaces
-   [x] No duplicate authentication/upload/audit infrastructure was
    created
-   [x] No secrets are hard-coded
-   [x] TypeScript compilation succeeds
-   [x] All current Person 2 automated tests pass

------------------------------------------------------------------------

# Reference Documents

This implementation is based on the project's:

1.  **AMC Management Software --- Business & Functional Requirements
    Document**
2.  **Backend Team Split**
3.  **Whole System Architecture / Implementation Plan**

Person 2's implementation specifically follows the responsibilities for
**Clients, Contracts, Assets, Service Types, Renewals, Contract Status
Jobs, and Renewal Reminder Jobs**.

------------------------------------------------------------------------

# Person 2 Backend Summary

``` text
                         AMC MANAGEMENT SYSTEM
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                 CLIENT                       SALES
                    │                           │
             ┌──────┴──────┐                    │
             │             │                    │
         Contacts        Sites                  │
                            │                   │
                          Assets                │
                            │                   │
                         Contract ──────────────┘
                            │
                 ┌──────────┼──────────┐
                 │          │          │
                SLA      Documents   Renewal
                                      │
                              ┌───────┴───────┐
                              │               │
                           Quotes          Follow-ups
                              │
                           Outcome

Background Automation:
    Contract Status Job
    Renewal Reminder Job
```

**Person 2 owns the Sales / Core Operations backend layer that connects
clients, assets, contracts, and renewals.**

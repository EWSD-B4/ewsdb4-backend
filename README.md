# University Magazine Management System Backend

Backend API and worker service for a secure role-based university magazine platform. This system manages student contributions for an annual university magazine, including submission workflows, faculty-scoped review, reporting, and asynchronous document processing.

## Table of Contents

- [Quick Start](#quick-start)
- [Overview](#overview)
- [Supported Roles](#supported-roles)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Main Features](#main-features)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Docker](#docker)
- [Contribution Processing Flow](#contribution-processing-flow)
- [Academic Year Logic](#academic-year-logic)
- [Terms and Conditions Logic](#terms-and-conditions-logic)
- [Logging and Monitoring](#logging-and-monitoring)
- [API Modules](#api-modules)
- [Access Control Summary](#access-control-summary)
- [Testing and Code Quality](#testing-and-code-quality)
- [Troubleshooting](#troubleshooting)
- [Development Notes](#development-notes)
- [Known Limitations / Notes](#known-limitations--notes)
- [Audience Guide](#audience-guide)

## Quick Start

If you want to run the backend locally with the current development flow:

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

Run the worker in a separate terminal:

```bash
npm run worker
```

Before running the project, make sure the required supporting services are available:
- MySQL
- Redis
- MongoDB
- RabbitMQ
- S3-compatible storage

Without those services, the API may start, but several workflows will be incomplete.

## Overview

This backend supports the University Magazine Management System, a secure web-based platform for collecting and managing student contributions.

The system supports:
- secure authentication and authorization
- role-based workflow control
- student contribution submission with DOCX and image uploads
- faculty-restricted coordinator review and comment flow
- manager access to selected contributions and reports
- administrator management of users, faculties, academic years, and terms
- notification and email integration
- asynchronous document extraction and content processing

The backend is designed with modular services and route separation to keep business logic maintainable and easier to collaborate on in a team environment.

## Supported Roles

The system currently supports these roles:

- `ADMIN`
- `STUDENT`
- `COORDINATOR`
- `MANAGER`
- `GUEST`

## Architecture

This project has two runtime components:

### 1. API Server
Handles:
- HTTP requests
- authentication and authorization
- validation
- business workflows
- reporting and analytics endpoints
- notifications and email triggers
- database writes and reads

### 2. Worker Service
Handles:
- asynchronous DOCX processing
- document extraction and transformation
- background consumption of RabbitMQ messages
- processed content storage for later retrieval

### Data and Infrastructure Layers

- `MySQL + Prisma`: transactional business data
- `MongoDB`: processed document content
- `Redis`: auth-related state and cache support
- `RabbitMQ`: background processing queue
- `S3-compatible storage`: uploaded files
- `Resend`: email delivery

## Tech Stack

- `Node.js`
- `Express.js`
- `TypeScript`
- `Prisma`
- `MySQL`
- `MongoDB`
- `Redis`
- `RabbitMQ`
- `AWS S3 / S3-compatible storage`
- `Resend`
- `Jest`
- `ESLint`
- `Prettier`

## Main Features

### Authentication
- login/logout
- current user lookup
- password update
- password reset flow

### Contribution Workflow
- student submission of DOCX and supporting images
- faculty-based coordinator review
- coordinator comments, selection, and rejection
- manager access to selected contributions
- guest access to selected contribution browsing flows

### Administration
- user management
- faculty management
- academic year management
- terms and conditions management

### Reporting and Analytics
- faculty statistics
- contributor counts
- contribution percentages
- no-comment and overdue exception reports
- system usage analytics

### Notifications and Email
- contribution submission notifications
- guest registration notifications
- comment-related notifications
- email logging support

## Project Structure

```txt
src/
  app.ts
  index.ts
  config/
  constants/
  middleware/
  modules/
    academic-year/
    admin/
    analytics/
    auth/
    comment/
    contribution/
    document/
    faculty/
    history/
    notification/
    plagiarism/
    report/
    terms/
    user/
  routes/
  services/
  shared/
    cache/
    database/
    email/
    errors/
    logger/
    mq/
    storage/
    utils/
  types/
  utils/
  worker/
    index.ts
```

## Environment Variables

Create a `.env` file in the project root.

### Core App
```env
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1
LOG_LEVEL=info
CORS_ORIGIN=*
APP_URL=http://localhost:3000
```

### MySQL
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=test_db
DB_CONNECTION_LIMIT=10
```

### Redis
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### JWT
```env
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

### S3 / Object Storage
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=your-bucket
S3_DOCUMENT_PREFIX=documents/
```

### RabbitMQ
```env
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE_NAME=document-processing
RABBITMQ_EXCHANGE_NAME=documents
RABBITMQ_ROUTING_KEY=document.upload
RABBITMQ_DLX_EXCHANGE_NAME=documents-dlx
RABBITMQ_DLQ_NAME=document-processing-dlq
RABBITMQ_DLQ_ROUTING_KEY=document.failed
RABBITMQ_MAX_RETRIES=3
RABBITMQ_RETRY_DELAY_MS=60000
```

### Email
```env
RESEND_API_KEY=your-resend-key
EMAIL_FROM=noreply@example.com
```

## Prerequisites

Before running locally, make sure these are available:

- `Node.js >= 18`
- `npm >= 9`
- MySQL
- Redis
- MongoDB
- RabbitMQ
- S3-compatible storage or AWS S3
- valid email credentials if email features need to be tested

## Installation

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Push schema to database:

```bash
npm run prisma:push
```

If you use migrations instead:

```bash
npm run prisma:migrate
```

Optional seed:

```bash
npm run prisma:seed
```

## Running the Project

### Start API Server
```bash
npm run dev
```

### Start Worker
Run this in a separate terminal:

```bash
npm run worker
```

### Production Build
```bash
npm run build
npm start
```

## Docker

This project includes Docker support, but the backend does not run as a fully isolated single container by itself. Full functionality depends on supporting services such as MySQL, Redis, MongoDB, RabbitMQ, and object storage.

For that reason, the recommended Docker workflow is `docker-compose`, not a single `docker run`.

### Available Docker Files

The repository currently includes:

- `Dockerfile`
- `Dockerfile.dev`
- `docker-compose.yml`
- `docker-compose.local.yml`
- `docker-compose.dev.yml`
- `docker-compose.staging.yml`
- `docker-compose.prod.yml`

Use the compose file that matches your environment.

### Recommended: Run Full Local Stack

For local development, use the local compose file if that is the environment your team uses:

```bash
docker-compose -f docker-compose.local.yml up --build
```

Or use the default compose file:

```bash
docker-compose up --build
```

This approach is recommended because the backend depends on multiple services.

### Stop Docker Services

```bash
docker-compose down
```

To stop and also remove volumes:

```bash
docker-compose down -v
```

### Run in Detached Mode

```bash
docker-compose up -d --build
```

### View Logs

```bash
docker-compose logs -f
```

For a specific service:

```bash
docker-compose logs -f <service-name>
```

### Build and Run API Container Only

If MySQL, Redis, MongoDB, RabbitMQ, and object storage are already available outside Docker, you may run only the backend container.

Build the image:

```bash
docker build -t university-magazine-backend .
```

Run the container:

```bash
docker run --env-file .env -p 3000:3000 university-magazine-backend
```

### Important Note

Running only the backend container is not enough for full functionality unless the following services are already available and correctly configured:

- MySQL
- Redis
- MongoDB
- RabbitMQ
- S3-compatible storage
- email provider configuration if email flows are being tested

Without those services:
- the API may start
- but upload, queue, document-processing, notification, and storage workflows may not work correctly

### Development Container Option

If you want a development-oriented container setup, use the dev Dockerfile and matching compose file where appropriate:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

Use this only if your team has verified that the dev compose configuration matches the current environment setup.

## Contribution Processing Flow

The system uses an asynchronous processing pipeline.

### Submission Flow

1. Student submits a contribution with:
   - DOCX file
   - optional images
   - metadata such as title
2. Backend validates:
   - role
   - faculty scope
   - academic year rules
   - file types
   - deadline rules
3. Files are uploaded to object storage.
4. Contribution and file records are stored in MySQL.
5. A message is published to RabbitMQ.
6. Worker consumes the message.
7. Worker processes the DOCX content.
8. Processed document content is stored in MongoDB.
9. Coordinators are notified through notification/email flow.

### Why the Worker Matters

The API server and worker are both required for full functionality.

Without the worker:
- uploads may still succeed
- but content extraction and processed article content retrieval will not complete

## Academic Year Logic

Academic year records control submission windows.

### Important Fields
- `startDate`
- `endDate`
- `closureDate`
- `closureFinalDate`
- `isCurrent`
- `isActive`

### Meaning
- `closureDate`
  stops new submissions
- `closureFinalDate`
  stops update-related actions after the final deadline

### Current Logic
- before `closureDate`:
  - new submissions are allowed
  - updates are allowed
- after `closureDate` but before `closureFinalDate`:
  - new submissions are blocked
  - updates may still be allowed
- after `closureFinalDate`:
  - update-related actions are blocked

A newly created academic year is not automatically current.  
`isCurrent` is set separately through the dedicated current-year flow.



## Logging and Monitoring

The backend includes both application logging and request logging.

### Logging Techniques Used

- `Winston` is used as the main application logger
- `Morgan` is used for HTTP request logging

### Current Logging Behavior

- in development mode, HTTP requests are logged with `morgan('dev')`
- in non-development mode, HTTP request logs are passed into the Winston logger
- application events such as startup, shutdown, database connections, queue events, uploads, worker processing, notifications, and errors are logged through Winston

### Log Outputs

Current file-based logs:

- `logs/all.log`
- `logs/error.log`

### User Activity Monitoring

In addition to file and console logging, the project also tracks page-view activity through middleware. This supports usage monitoring and analytics-related reporting.

This means the project has:
- operational logging
- HTTP request logging
- error logging
- user activity tracking

These are useful both for debugging during development and for system monitoring in deployed environments.

## API Modules

Base URL:
```txt
http://localhost:3000/api/v1
```

Main route groups:

- `/auth`
- `/users`
- `/admin`
- `/faculties`
- `/academic-years`
- `/student`
- `/coordinator/contributions`
- `/manager/contributions`
- `/guest`
- `/comments`
- `/notifications`
- `/analytics`
- `/reports`
- `/terms`
- `/documents`
- `/history`
- `/plagiarism`

## Access Control Summary

### Public or Pre-auth Access
Depending on route policy:
- login
- password reset flow
- active terms
- health check
- selected guest/public read flows where explicitly allowed

### Protected by Role
- student-only contribution actions
- coordinator faculty review flows
- manager selected contribution/report access
- admin maintenance and analytics access

### Important Note
Access control is enforced at:
- route level
- middleware level
- business-service level

This is important for preserving faculty scope and workflow restrictions.

## Testing and Code Quality

### Run Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### DOCX-specific Test
```bash
npm run test:docx
```

### Lint
```bash
npm run lint
```

### Auto-fix Lint
```bash
npm run lint:fix
```

### Format
```bash
npm run format
```

### Type Check
```bash
npm run typecheck
```

## Troubleshooting

### 1. API starts but uploaded documents are not processed
Check:
- RabbitMQ is running
- MongoDB is running
- the worker process is started with `npm run worker`

If the API is running without the worker, upload may succeed but extracted content will not be available.

### 2. Prisma client errors after schema changes
Run:

```bash
npm run prisma:generate
```

If the database schema also needs updating:

```bash
npm run prisma:push
```

### 3. Database connection fails on startup
Check:
- MySQL is running
- `.env` values for `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are correct

### 4. Redis connection fails
Check:
- Redis is running
- `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` are correct

### 5. File upload succeeds but files are not accessible later
Check:
- S3 or S3-compatible storage is reachable
- bucket configuration is correct
- AWS credentials and bucket name are valid

### 6. Email flow does not work
Check:
- `RESEND_API_KEY` is set
- `EMAIL_FROM` is valid
- the configured sender is allowed by the email provider

### 7. Current academic year not found
Some contribution and reporting flows depend on an active current academic year.

Check:
- there is at least one academic year record
- one record is marked as `isCurrent = true`
- the current year is still active

## Development Notes

### Build Scripts
```bash
npm run build
npm start
```

### Prisma Scripts
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:push
npm run prisma:studio
npm run prisma:seed
```

### Development Principle
When modifying this backend:
- preserve current Prisma schema unless a schema change is explicitly intended
- preserve faculty-based access rules
- preserve role-based route protections
- keep API and worker flow aligned
- avoid breaking upload, queue, and content-processing flow

### External Service Dependency Note
Several features depend on configured external services:
- S3 for file storage
- RabbitMQ for document processing
- MongoDB for processed content
- Resend for email flow
- Redis for auth-related state

If these are unavailable, some workflows will be only partially functional.

## Known Limitations / Notes

- Full contribution processing depends on both the API server and the worker service running together.
- The system depends on multiple external services. Local development is not complete with the API alone.
- Several workflows depend on an active current academic year.
- Terms and conditions logic is version-based, so the active terms record should be managed carefully.
- Guest/public access behavior depends on route policy and should be reviewed together with frontend expectations.
- Docker support exists, but the recommended path for this project is `docker-compose`, not a single standalone backend container for full functionality.

## Audience Guide

### 
Recommended order:
1. create `.env`
2. start MySQL, Redis, MongoDB, RabbitMQ
3. run `npm install`
4. run `npm run prisma:generate`
5. run `npm run prisma:push`
6. run `npm run dev`
7. run `npm run worker`

### 
Focus on:
- service boundaries in `src/modules`
- middleware flow
- Prisma access patterns
- worker and queue integration
- MongoDB content retrieval flow
- role-based access enforcement

### 
Key evaluation points in this backend:
- role-based workflow design
- faculty-scoped access control
- contribution processing pipeline
- academic year deadline enforcement
- terms/agreement traceability
- separation between API and worker responsibilities
- reporting and notification support

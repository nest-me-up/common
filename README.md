# Nest Me Up - Common Library

This library is a set of opinionated, SaaS-oriented, best-practice common modules built for [NestJS](https://nestjs.com/) applications. It is designed to speed up the development of microservices by providing ready-to-use building blocks for configuration, logging, context propagation, error handling, and HTTP communication.

## High-Level Intent

- **SaaS Oriented:** Built with multi-tenancy and distributed systems in mind.
- **Opinionated:** Enforces specific patterns to ensure consistency across services.
  - **Logging:** Forces the use of `nestjs-pino` for high-performance, JSON-structured logging suitable for log aggregation systems.
  - **HTTP:** Standardizes on `axios` for all inter-service communication to guarantee consistent context propagation and error handling.
- **Best Practices:** Incorporates standard practices for observability, error handling, and configuration management.
- **Microservices Ready:** Built-in mechanisms for context propagation across service boundaries.

---

## Context Management

A core feature of this library is its robust handling of request context, ensuring that traceability and metadata flow seamlessly through your application and across microservices.

### How it Flows Within a Service

Internally, context is managed using Node.js `AsyncLocalStorage` via the `ContextService`. This allows you to access request-scoped information (like `transactionId`, `sessionId`, `userId`) anywhere in your code without passing it explicitly as arguments.

1. **Initialization:** The `ContextMiddleware` intercepts incoming requests, extracts standard headers (or generates new transaction or session IDs), and initializes the `AsyncLocalStorage` store.
2. **Access:** Services can inject `ContextService` to retrieve `ContextInfo` or store request-scoped data (`contextStorage`).
3. **Logging:** The `LoggerModule` automatically enriches all log entries with the current context information, ensuring every log is traceable to a specific transaction or user.

### Configuration & Extensibility

#### Customizing Header Names

You can override the default header names or map new context properties to headers by providing a `context.headerNames` object in your configuration file (e.g., `default.yml`).

**Example Configuration:**

```yaml
context:
  headerNames:
    # Override default
    transactionId: 'x-trace-id'
    # Add custom property mapping
    customProperty: 'x-custom-header'
```

#### Adding Custom Context Properties

To track additional properties (like `customProperty` above) throughout the request lifecycle:

1.  **Map it:** Add the mapping in your configuration as shown above. The `ContextMiddleware` will automatically extract the header value and add it to the context object using the key `customProperty`.
2.  **Type it:** Create an interface that extends the base `ContextInfo` to include your new property.
3.  **Use it:** Pass your generic type to `getContext`.

```typescript
// 1. Define your extended context interface
import { ContextInfo } from 'nest-me-up-common'

export interface MyContext extends ContextInfo {
  customProperty?: string
}

// 2. Retrieve it in your service
const ctx = this.contextService.getContext<MyContext>()
console.log(ctx.customProperty) // Value from 'x-custom-header'
```

### How it Flows Between Microservices

To maintain trace continuity in a distributed system, context must be propagated with every outgoing request.

1. **Outgoing Requests:** The `HttpClientService` creates HTTP clients that automatically inject current context information into request headers.
2. **Incoming Requests:** The receiving service's `ContextMiddleware` reads these headers and re-establishes the context, ensuring `transactionId` and other metadata are preserved across the entire call chain.

### Key Identifiers

- **`transactionId` (Distributed Trace):**
  Represents a single logical operation that may span multiple services.
  - **Flow:** Originates at the edge (or first service) and is propagated downstream via the `x-transaction-id` header.
  - **Usage:** Use this to filter logs across all microservices to see the full path of a request.

- **`internalTransactionId` (Local Trace):**
  Represents the processing of a request _within a specific service instance_.
  - **Flow:** Generated uniquely for every incoming request to a service. It is **not** propagated to downstream services.
  - **Usage:** Use this to isolate logs for a specific service execution, helpful when a single distributed transaction involves multiple independent calls to the same service.

---

## Modules

### 1. Context Module

Provides the foundation for request-scoped data.

- **`ContextService`:** Wrapper around `AsyncLocalStorage`. Allows setting and getting context info and arbitrary storage data.
- **`ContextMiddleware`:** Standard middleware to extract tracing headers (e.g., `x-transaction-id`, `x-session-id`) and initialize the context for the request lifecycle. It supports custom header mappings via configuration.
- **`ContextInfo` Interface:** Defines the shape of the context object available throughout the request.
  - `userId` (optional): ID of the authenticated user.
  - `tenantId` (string): ID of the tenant (for multi-tenant SaaS apps).
  - `projectId` (optional): ID of the project/workspace within the tenant.
  - `transactionId` (string): Trace ID spanning multiple microservices.
  - `internalTransactionId` (optional): Unique ID for the current service execution.
  - `sessionId` (optional): ID of the user session.
- **Global Access:** available globally once imported.

### 2. Configuration Module

An enhanced configuration loader based on `@nestjs/config`.

- **YAML Support:** Loads configuration from YAML files.
- **Merging Strategy:** Supports a layered configuration approach. It loads a default configuration file and merges it with a service-specific configuration file (defined by `service_config` env var or options), allowing for environment-specific overrides.
- **Global Access:** available globally once imported.

### 3. Logger Module

A pre-configured wrapper around `nestjs-pino`.

- **Context-Aware:** Automatically adds context data such as `transactionId`, `sessionId`, etc., to every log line.
- **Security:** Built-in redaction for sensitive keys and URL tokens (e.g., removing tokens from logged URLs).
- **Formatting:** Configures truncation for long messages and supports pretty-printing in local development.
- **Global Access:** available globally once imported.

### 4. Http Client Module

Provides a configured `Axios` instance for inter-service communication.

- **Context Propagation:** Automatically attaches context headers to outgoing requests.
- **Resilience:** Built-in retry logic using `axios-retry`.
- **Standardized Error Handling:**
  - Catches and logs errors with detailed context (URL, method, host).
  - Sanitizes error objects (redacts request bodies) before throwing.
  - Specifically handles `DomainCustomException` for business logic propagation.

### 5. Errors Module

Standardizes error handling across the domain.

#### `DomainCustomException`

A base exception class designed for **business logic errors** that need to be communicated explicitly to the client or other microservices.

- **Structure:** Includes a human-readable `message`, a specific `statusCode` (internal error code, not HTTP status), and an optional `data` payload.
- **Client-Side Use:** Ideal for returning structured errors that the UI can react to (e.g., specific validation failures, insufficient funds, resource limits).
  - _Example:_ Throwing `new DomainCustomException('Balance too low', 1002, { current: 5, required: 10 })` allows the frontend to show a specific modal to the user.
- **Inter-Service Use:** When thrown in one microservice, the `HttpClientModule` (in the calling service) can recognize this exception format and re-throw it, preserving the business context across the network boundary.

#### Global Exception Filters

The module provides filters to ensure all exceptions returning to the client have a consistent JSON structure.

- **`DomainCustomExceptionFilter`:** Catches `DomainCustomException` and formats the response with a specific HTTP status code (customizable, usually maps to a known "business error" HTTP code like 400 or 422) and the full error payload.
- **`GlobalExceptionFilter`:** A catch-all filter for any other unhandled exceptions.
  - **Security:** In non-local environments, it masks unknown 500 errors as "Internal server error" to prevent leaking stack traces or sensitive system details.
  - **Logging:** Automatically logs 500-level errors as `error` and 400-level errors as `warn` with full context.
  - **Consistency:** Ensures every error response has the same shape:
    ```json
    {
      "statusCode": 500,
      "domainStatusCode": -1,
      "message": "Internal server error",
      "timestamp": "2023-01-01T12:00:00.000Z",
      "data": null
    }
    ```

## Installation

```bash
npm install nest-me-up-common
```

## Usage

Import the necessary modules into your root `AppModule`:

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, LoggerModule, ContextModule } from 'nest-me-up-common'

@Module({
  imports: [
    ConfigModule.forRoot(),
    LoggerModule.forRoot(),
    ContextModule,
    // ...
  ],
})
export class AppModule {}
```

Most modules are globaly accessible so you dont need to include them in the import section of your modules.

## Example Application

Check out the [NestJS Example App](https://github.com/nest-me-up/nestjs-example-app) to see this library in action within a microservice architecture.

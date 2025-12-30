import { ExceptionFilter } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { GloablExceptionFilter } from './global-exception.filter'
import { MontaraExceptionFilter } from './montara-exception.filter'

/*
The function getMontaraGlobalFilters is a helper utility used to enforce a consistent error-handling strategy
across the application's services.
It takes a PinoLogger instance (for dependency injection) and returns an array containing the standard set of exception filters
used by the system:
- GloablExceptionFilter: A "catch-all" filter that intercepts standard HTTP exceptions and unhandled internal errors (500s).
  It ensures all errors return a uniform JSON response structure and handles security practices like masking internal error details in production.
- MontaraExceptionFilter: A specialized filter designed to catch the DomainCustomException.
  It ensures that business-logic errors are handled with their specific domain status codes and data payloads,
  rather than being treated as generic server errors.

By using this function (e.g., in main.ts via app.useGlobalFilters(...)),
developers can instantly configure a service to adhere to the organization's error logging and response standards.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMontaraGlobalFilters(logger: PinoLogger): ExceptionFilter<any>[] {
  return [new GloablExceptionFilter(logger), new MontaraExceptionFilter(logger)]
}

/*
The ErrorResponse class is a simple data transfer object (DTO) used to standardize the structure of error responses
across the application. It ensures that all error responses have a consistent shape,
making it easier to handle and log errors uniformly.

response contains:
- statusCode: The HTTP status code of the response.
- domainStatusCode: The domain status code of the response. This is a custom status code for business-logic errors.
- message: The message of the response.
- timestamp: The timestamp of the response.
- data: The data of the response. This is a custom data payload for business-logic errors.
*/
export class ErrorResponse {
  constructor(
    public readonly statusCode: number,
    public readonly domainStatusCode: number,
    public readonly message: string,
    public readonly timestamp: string,
    public readonly data?: object,
  ) {}
}

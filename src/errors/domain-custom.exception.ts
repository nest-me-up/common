/*
DomainCustomException is a custom error class that extends the standard JavaScript Error object
to support structured, domain-specific error handling across the application.

Class Structure:
It adds two read-only properties to the standard error message:
- statusCode: A numeric code (internal error code) indicating the type of failure.
data (optional): An object to hold arbitrary payload data,
   allowing you to pass structured details about the error (e.g., validation fields, resource IDs, or specific business logic context).

Why Use It?
Transporting Business Logic Errors: Unlike generic HTTP errors (like 400 Bad Request or 500 Internal Server Error),
this exception allows services to communicate specific business failures.

Example: Instead of just returning "Payment Failed", the data field could contain { reason: "insufficient_funds", currentBalance: 5.00 }.
Cross-Service

Communication:
As seen in the HttpClientService, this exception is designed to be serialized and sent over HTTP.
The client service can catch a response, detect this specific exception type,
and handle it gracefully (e.g., showing a specific UI message to the user)
rather than treating it as a crash or unknown network error.

Consistent Error Shape:
It enforces a standard structure for custom errors throughout the system,
ensuring that logs and error handlers always know where to look for the status code and additional context.
*/
export class DomainCustomException extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly data?: object,
  ) {
    super(message)
  }
}

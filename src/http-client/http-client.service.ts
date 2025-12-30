import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosError } from 'axios'
import axiosRetry from 'axios-retry'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { ContextInfo, ContextService } from '../context'
import { DomainCustomException } from '../errors'
import { DOMAIN_CUSTOM_HTTP_ERROR_CODE } from '../errors/errors.const'
import { getContextHeaderNames } from './http-headers.config'

/*
The HttpClientService is a NestJS injectable service that provides a configured HTTP client
(based on axios) for making inter-service requests.
Its main purpose is to standardize how HTTP calls are made within the system,
specifically regarding context propagation, retry logic, and error handling.

The service exposes a getHttpClient method that creates and configures an axios instance
with the following options:
- Base URL: Can be optionally set.
- Retries: Configures automatic retries using axios-retry (default is 0).
- Inter-service Communication: When enabled (default: true),
  it automatically attaches context headers to requests.

Context Propagation
When making requests to other internal services,
the service automatically propagates context (such as user ID, transaction ID, etc.):
It retrieves the current context from ContextService (or uses a provided context).
It maps context keys to HTTP headers (defined via configuration)
and attaches them to the outgoing request.
This ensures that tracing and user context are preserved across microservice boundaries.

Standardized Error Handling
The service includes a response interceptor that processes errors via handleAxiosError:

- Domain Custom Errors: If the response status matches a specific custom code
     (DOMAIN_CUSTOM_HTTP_ERROR_CODE), it logs it as a domain exception.
- Bad Requests: 400-level errors are logged with specific details.
- Unknown Errors: Other errors are logged as warnings.

Error Sanitization: Before rejecting the promise,
it creates a "sanitized" error object.
Crucially, it redacts the request data (body) to prevent sensitive information
from leaking into logs or upstream error handlers.
*/
@Injectable()
export class HttpClientService {
  private readonly contextKeyToHeaderName: Record<string, string>
  constructor(
    configService: ConfigService,
    private readonly contextService: ContextService,
    @InjectPinoLogger(HttpClientService.name)
    private readonly logger: PinoLogger,
  ) {
    this.contextKeyToHeaderName = getContextHeaderNames(configService)
  }

  public getHttpClient({
    contextInfo,
    baseUrl,
    retries = 0,
    interServiceCommunication = true,
  }: {
    contextInfo?: ContextInfo
    baseUrl?: string
    retries?: number
    interServiceCommunication?: boolean
  }) {
    const instance = axios.create(baseUrl ? { baseURL: baseUrl } : {})
    axiosRetry(instance, { retries })
    if (interServiceCommunication) {
      const resolvedContextInfo: ContextInfo = contextInfo || this.contextService.getContext()
      instance.interceptors.request.use((config) => {
        for (const [key, value] of Object.entries(this.contextKeyToHeaderName)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((resolvedContextInfo as any)[key]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            config.headers[value] = (resolvedContextInfo as any)[key]
          }
        }
        return config
      })
      instance.interceptors.response.use(
        (response) => response,
        (error) => this.handleAxiosError(error),
      )
    }
    return instance
  }

  private handleAxiosError(error: AxiosError) {
    const parsedUrl = new URL(error.config?.url || '')

    error.status = error.response?.status
    //log the domain custom error
    if (error.response?.status === DOMAIN_CUSTOM_HTTP_ERROR_CODE) {
      const domainCustomException: DomainCustomException = error.response?.data as DomainCustomException
      this.logger.info(
        domainCustomException,
        `Call to %s, to host: %s with http method: %s, failed - domain error, message: %s, statusCode: %d`,
        error.config?.url,
        parsedUrl.host,
        error.config?.method,
        domainCustomException.message,
        domainCustomException.statusCode,
      )
    } else if (error.response?.status && error.response?.status <= HttpStatus.BAD_REQUEST) {
      //log the bad request error
      this.logger.info(
        error.response?.data,
        `Call to %s, to host: %s with http method: %s, failed bad request - message: %s`,
        error.config?.url,
        parsedUrl.host,
        error.config?.method,
        error.message,
      )
    } else {
      //log the unknown error
      this.logger.warn(
        error.response?.data,
        `Call to %s, to host: %s with http method: %s, failed unknown error - message: %s`,
        error.config?.url,
        parsedUrl.host,
        error.config?.method,
        error.message,
      )
    }
    //sanitize the error
    if (error.response) {
      const sanitizedError = {
        code: error.code,
        status: error.status,
        message: error.message,
        name: error.name,
        stack: error.stack,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: '<REDACTED>',
        },
        response: {
          config: {
            url: error.response.config?.url,
            method: error.response.config?.method,
            headers: error.response.config?.headers,
          },
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data,
        },
      }
      return Promise.reject(sanitizedError)
    } else {
      return Promise.reject(error)
    }
  }
}

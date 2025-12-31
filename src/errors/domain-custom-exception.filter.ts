import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { DomainCustomException } from './domain-custom.exception'
import { ErrorResponse } from './error-global-filters'
import { DOMAIN_CUSTOM_HTTP_ERROR_CODE } from './errors.const'

@Catch(DomainCustomException)
export class DomainCustomExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(DomainCustomExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: DomainCustomException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()

    const errorResponse: ErrorResponse = {
      statusCode: DOMAIN_CUSTOM_HTTP_ERROR_CODE,
      domainStatusCode: exception.statusCode,
      message: exception.message,
      timestamp: new Date().toISOString(),
      data: exception.data,
    }
    this.logger.info(exception, 'Domain custom exception occurred: %o', errorResponse)

    response.status(errorResponse.statusCode).json(errorResponse)
  }
}

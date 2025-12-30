import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { ErrorResponse } from './montara-global-filters'

@Catch()
export class GloablExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GloablExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()

    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = (exception as any)?.message
    if (statusCode < HttpStatus.BAD_REQUEST || statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception, `Uncaught exception occurred: message: %s`, message)
    } else {
      this.logger.warn(exception, `Uncaught exception occurred in the 4xx range, message: %s`, message)
    }

    const errorResponse: ErrorResponse = {
      statusCode: statusCode,
      domainStatusCode: -1,
      message: process.env.NODE_ENV === 'prod' ? 'Internal server error' : message,
      timestamp: new Date().toISOString(),
    }

    response.status(statusCode).json(errorResponse)
  }
}

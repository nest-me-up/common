import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { ErrorResponse } from './error-global-filters'

@Catch()
export class GloablExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GloablExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()

    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data = undefined
    const message = exception?.message || 'Unknown error'
    if (statusCode < HttpStatus.BAD_REQUEST || statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception, `Uncaught exception occurred: message: %s`, message)
    } else {
      data = exception?.response?.message || exception?.response?.data
      this.logger.warn(exception, `Uncaught exception occurred in the 4xx range, message: %s`, message)
    }

    const errorResponse: ErrorResponse = {
      statusCode: statusCode,
      domainStatusCode: -1,
      message:
        process.env.NODE_ENV === 'local' || statusCode === HttpStatus.BAD_REQUEST ? message : 'Internal server error',
      timestamp: new Date().toISOString(),
      data: data,
    }

    response.status(statusCode).json(errorResponse)
  }
}

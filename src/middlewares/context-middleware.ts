import { Injectable, NestMiddleware } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NextFunction, Request, Response } from 'express'
import { IncomingHttpHeaders } from 'http'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { v4 } from 'uuid'
import { ContextInfo, ContextService } from '../context'

export interface CommonMiddlewareModuleConfig {
  headerNames: Record<keyof ContextInfo, string>
}

export const DEFAULT_HEADER_NAMES: Partial<Record<keyof ContextInfo, string>> = {
  transactionId: 'x-transaction-id',
  sessionId: 'x-session-id',
  userId: 'x-user-id',
  tenantId: 'x-tenant-id',
  projectId: 'x-project-id',
}

/*
  This middleware is responsible for initializing and maintaining request context information
  (like tracking IDs) for incoming HTTP requests.
  It acts as a bridge between raw HTTP headers and the application's internal ContextService.

  Here is a breakdown of its key responsibilities:
  - Header Configuration
  The middleware maps internal context keys (like transactionId, userId) to specific HTTP header names.
  It uses a default set of headers (x-transaction-id, x-session-id, etc.).
  These defaults can be overridden or extended via the application's configuration (context.headerNames).

  - ID Management & Propagation
  In the use method (the middleware entry point), it ensures critical tracking IDs exist:
  Transaction ID: extracted from headers or generated (UUID).
  Session ID: extracted from headers or generated (UUID).
  Internal Transaction ID: always generated new for the current service processing.

  It then mutates both the incoming request (req) and the outgoing
  response (_res) to include these IDs as headers.
  This ensures that downstream services (if the request is forwarded)
  and the client receiving the response both have the tracking IDs.

  - Context Creation & Scope
  It creates a ContextInfo object containing:
  The core IDs (transactionId, sessionId, internalTransactionId).
  Any other values extracted from headers based on the configuration map
  (e.g., userId, tenantId).
  Finally, and most importantly, it wraps the rest of the request processing
  (next()) inside this.contextService.runWithContext(...).
  This uses AsyncLocalStorage (under the hood of ContextService)
  to make this context information available anywhere in the application code
  for this specific request without passing it as arguments.

*/
@Injectable()
export class ContextMiddleware implements NestMiddleware {
  private readonly contextKeyToHeaderName: Record<string, string>

  constructor(
    private readonly configService: ConfigService,
    private readonly contextService: ContextService<ContextInfo>,
    @InjectPinoLogger(ContextMiddleware.name)
    private readonly logger: PinoLogger,
  ) {
    const configHeaderNames = this.configService.get('context.headerNames')
    this.contextKeyToHeaderName = {
      ...DEFAULT_HEADER_NAMES,
      ...configHeaderNames,
    }
  }

  use(req: Request, _res: Response, next: NextFunction) {
    const transactionId = (req?.headers[this.contextKeyToHeaderName.transactionId] as string) || v4()
    const sessionId = (req?.headers[this.contextKeyToHeaderName.sessionId] as string) || v4()
    try {
      req.headers[this.contextKeyToHeaderName.transactionId] = transactionId
      if (_res['header'] && typeof _res['header'] == 'function') {
        _res.header(this.contextKeyToHeaderName.transactionId, transactionId)
      }
      req.headers[this.contextKeyToHeaderName.sessionId] = sessionId
      if (_res['header'] && typeof _res['header'] == 'function') {
        _res.header(this.contextKeyToHeaderName.sessionId, sessionId)
      }
    } catch (error) {
      this.logger.error(error)
    }

    const internalTransactionId = v4()
    const contextInfo: ContextInfo = this.createContextInfo(
      req.headers,
      transactionId,
      sessionId,
      internalTransactionId,
    )

    this.contextService.runWithContext(contextInfo, () => {
      next()
    })
  }

  private createContextInfo(
    headers: IncomingHttpHeaders,
    transactionId: string,
    sessionId: string,
    internalTransactionId: string,
  ): ContextInfo {
    const contextInfo: Record<string, unknown> = {
      transactionId,
      sessionId,
      internalTransactionId,
    }
    for (const [key, value] of Object.entries(this.contextKeyToHeaderName)) {
      if (headers[value]) {
        contextInfo[key] = headers[value]
      }
    }
    return contextInfo as unknown as ContextInfo
  }
}

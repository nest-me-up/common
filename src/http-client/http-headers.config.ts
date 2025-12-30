import { ConfigService } from '@nestjs/config'
import { ContextInfo } from '../context'

export const DEFAULT_HEADER_NAMES: Partial<Record<keyof ContextInfo, string>> = {
  transactionId: 'x-transaction-id',
  sessionId: 'x-session-id',
  userId: 'x-user-id',
  tenantId: 'x-tenant-id',
  projectId: 'x-project-id',
}

export function getContextHeaderNames(configService: ConfigService): Record<string, string> {
  const configHeaderNames = configService.get('context.headerNames')
  const contextKeyToHeaderName = {
    ...DEFAULT_HEADER_NAMES,
    ...configHeaderNames,
  }
  return contextKeyToHeaderName
}

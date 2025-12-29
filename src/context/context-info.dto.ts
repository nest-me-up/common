export interface ContextInfo {
  userId?: string
  tenantId: string
  projectId?: string

  transactionId: string // The transaction id which is used to track the request across services
  internalTransactionId?: string // The internal transaction id which is used to track the request within a service
  sessionId?: string
}

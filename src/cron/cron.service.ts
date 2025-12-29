import { Injectable } from '@nestjs/common'
import cron from 'node-cron'
import { v4 } from 'uuid'
import { ContextInfo, ContextService } from '../context'
@Injectable()
export class CronService {
  constructor(private readonly contextService: ContextService<ContextInfo>) {}

  public schedule(expression: string, callback: () => void, options?: cron.ScheduleOptions): cron.ScheduledTask {
    let contextInfo = this.contextService.getContext()
    if (!contextInfo) {
      contextInfo = {
        tenantId: 'unknown',
        transactionId: v4(),
        internalTransactionId: v4(),
        projectId: 'unknown',
        sessionId: 'unknown',
      }
    }
    return cron.schedule(
      expression,
      () => {
        this.contextService.runWithContext(contextInfo, callback)
      },
      options,
    )
  }
}

import { Module } from '@nestjs/common'
import { ContextModule } from '../context'
import { CronService } from './cron.service'

@Module({
  imports: [ContextModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}

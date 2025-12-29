import { Module } from '@nestjs/common'
import { ContextService } from './context.service'

@Module({
  imports: [],
  exports: [ContextService],
  providers: [ContextService],
})
export class ContextModule {}

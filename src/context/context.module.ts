import { Global, Module } from '@nestjs/common'
import { ContextService } from './context.service'

@Global()
@Module({
  imports: [],
  exports: [ContextService],
  providers: [ContextService],
})
export class ContextModule {}

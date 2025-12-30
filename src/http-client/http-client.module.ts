import { Module } from '@nestjs/common'

import { ContextModule } from '../context'
import { LoggerModule } from '../logger'
import { HttpClientService } from './http-client.service'
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [LoggerModule, ContextModule, ConfigModule],
  exports: [HttpClientService],
  providers: [HttpClientService],
})
export class HttpClientModule {}

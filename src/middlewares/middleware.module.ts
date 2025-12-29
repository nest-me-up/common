import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ContextModule } from '../context'
import { LoggerModule } from '../logger'
import { ContextMiddleware } from './context-middleware'

@Module({
  imports: [ContextModule, ConfigModule, LoggerModule],
  providers: [ContextMiddleware],
})
export class CommonMiddlewareModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes('*')
  }
}

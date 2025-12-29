import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { Request, Response } from 'express'
import { ContextInfo, ContextModule, ContextService } from '../context'
import { LoggerModule } from '../logger'
import { ContextMiddleware } from './context-middleware'
import { CommonMiddlewareModule } from './middleware.module'

jest.mock('express-http-context', () => {
  return {
    __esModule: true,
    set: jest.fn(),
  }
})

jest.mock('uuid', () => ({
  v4: jest.fn(() => '12345'),
}))

interface ExtendedContextInfo extends ContextInfo {
  other: string
}
let headerExtractorMiddleware: ContextMiddleware
let contextService: ContextService<ExtendedContextInfo>
let close: () => Promise<void>
describe('headers middleware', function () {
  beforeEach(async () => {
    const appData = await createEnvironment()
    close = appData.close
    headerExtractorMiddleware = appData.module.get<ContextMiddleware>(ContextMiddleware)
    contextService = appData.module.get<ContextService<ExtendedContextInfo>>(ContextService<ExtendedContextInfo>)
  })
  afterAll(async () => {
    await close()
  })

  it('get headers', function () {
    const req = {
      headers: {
        ['x-tenant-id']: 'tenant',
        ['x-user-id']: 'user',
        ['x-transaction-id']: 'trans',
        ['x-project-id']: 'project',
        ['x-session-id']: 'session',
        ['x-other-id']: 'other',
      },
      body: {
        test: '123',
      },
    }
    let contextInfo: ExtendedContextInfo | null = null
    jest.spyOn(contextService, 'runWithContext').mockImplementation((_contextInfo) => {
      contextInfo = _contextInfo
    })
    headerExtractorMiddleware.use(req as unknown as Request, {} as Response, jest.fn())
    const expected: ExtendedContextInfo = {
      projectId: 'project',
      tenantId: 'tenant',
      transactionId: 'trans',
      userId: 'user',
      sessionId: 'session',
      internalTransactionId: '12345',
      other: 'other',
    }
    expect(contextInfo).toEqual(expected)
  })
})

async function createEnvironment() {
  const module = await Test.createTestingModule({
    imports: [LoggerModule.forRoot(), ContextModule, CommonMiddlewareModule],
  })
    .overrideProvider(ConfigService)
    .useValue({
      get: jest.fn().mockReturnValue({
        tenantId: 'x-tenant-id',
        userId: 'x-user-id',
        transactionId: 'x-transaction-id',
        projectId: 'x-project-id',
        sessionId: 'x-session-id',
        other: 'x-other-id',
      }),
    })
    .compile()
  jest.setTimeout(20000)

  const app = module.createNestApplication()
  await app.init()
  const close = async function () {
    await app.close()
    // await module.close()
  }
  return { module, app, close }
}

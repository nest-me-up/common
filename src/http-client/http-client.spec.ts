import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { AxiosError } from 'axios'
import nock from 'nock'
import { getConfigServiceMock } from '../configuration/config.mock'
import { ContextInfo, ContextService, createContextServiceMock } from '../context'
import { LoggerModule } from '../logger'
import { getLoggerMock } from '../logger/logger-mock'
import { HttpClientModule } from './http-client.module'
import { HttpClientService } from './http-client.service'
import { DEFAULT_HEADER_NAMES } from './http-headers.config'

const contextInfo: ContextInfo = {
  tenantId: 'tenant',
  transactionId: 'trans',
  internalTransactionId: 'internal',
  projectId: 'project',
}

jest.mock('express-http-context', function () {
  const cache: Record<string, unknown> = {}
  return {
    set: (key: string, value: unknown) => {
      cache[key] = value
    },
    get: (key: string) => {
      return cache[key]
    },
  }
})

let service: HttpClientService
const contextServiceMock = createContextServiceMock(contextInfo)
const configServiceMock = getConfigServiceMock()
beforeAll(() => {
  service = new HttpClientService(configServiceMock, contextServiceMock, getLoggerMock())
})

describe('http client', function () {
  beforeEach(() => {
    jest.clearAllMocks()
    nock.cleanAll()
  })
  it('should forward transactionId', async function () {
    const requestURI = 'http://www.example.com'

    const client = service.getHttpClient({
      retries: 3,
      contextInfo: {
        transactionId: 'x',
      } as ContextInfo,
    })

    const scope = nock(requestURI)
      .get('/')
      .reply(function () {
        expect(this.req.headers[DEFAULT_HEADER_NAMES.transactionId as string]).toBe('x')
        return [200]
      })
    await client.get(requestURI)

    expect(scope.isDone()).toBeTruthy()
  })
  it('should support retry', async function () {
    const retries = 3
    const client = service.getHttpClient({ retries })
    const requestURI = 'http://www.example.com'
    let times = 0
    const scope = nock(requestURI)
      .persist(true)
      .get('/')
      .times(3)
      .reply(function () {
        return times++ < retries - 1 ? [500] : [200]
      })
    await client.get(requestURI)
    expect(scope.isDone()).toBeTruthy()
  })

  it('should not log when success', async function () {
    const logErrorSpy = jest.fn()
    Logger.error = logErrorSpy
    const retries = 3
    const client = service.getHttpClient({ retries })
    const requestURI = 'http://www.googledsdsdsdss.com'
    nock(requestURI).persist(true).get('/testme2').reply(200)
    await client.get(requestURI + '/testme2')
    expect(logErrorSpy).toHaveBeenCalledTimes(0)
  })
  it('should forward all headers from user context', async function () {
    const user: ContextInfo = {
      userId: '3',
      tenantId: '2',
      projectId: '3',
      transactionId: '123456',
      sessionId: '123',
    }
    const client = service.getHttpClient({ retries: 3, contextInfo: user })
    const requestURI = 'http://www.example.com'

    const scope = nock(requestURI)
      .get('/')
      .reply(function () {
        expect(this.req.headers[DEFAULT_HEADER_NAMES.tenantId as string]).toBe(user.tenantId)
        expect(this.req.headers[DEFAULT_HEADER_NAMES.projectId as string]).toBe(user.projectId)
        expect(this.req.headers[DEFAULT_HEADER_NAMES.transactionId as string]).toBe(user.transactionId)
        expect(this.req.headers[DEFAULT_HEADER_NAMES.userId as string]).toBe(user.userId)
        expect(this.req.headers[DEFAULT_HEADER_NAMES.sessionId as string]).toBe(user.sessionId)

        return [200]
      })
    await client.get(requestURI)

    expect(scope.isDone()).toBeTruthy()
  })
  it('test no projectId allowed', async function () {
    const user: ContextInfo = {
      userId: '3',
      tenantId: '2',
      projectId: undefined,
      transactionId: '123456',
      sessionId: '123',
    }
    const client = service.getHttpClient({ contextInfo: user, retries: 3 })
    const requestURI = 'http://www.example.com'

    const scope = nock(requestURI)
      .get('/')
      .reply(function () {
        expect(this.req.headers[DEFAULT_HEADER_NAMES.tenantId as string]).toBe(user.tenantId)
        expect(this.req.headers[DEFAULT_HEADER_NAMES.projectId as string]).toBeFalsy()
        expect(this.req.headers[DEFAULT_HEADER_NAMES.transactionId as string]).toBe(user.transactionId)
        expect(this.req.headers[DEFAULT_HEADER_NAMES.userId as string]).toBe(user.userId)
        expect(this.req.headers[DEFAULT_HEADER_NAMES.sessionId as string]).toBe(user.sessionId)

        return [200]
      })
    await client.get(requestURI)

    expect(scope.isDone()).toBeTruthy()
  })
  it('should return status code on error - 404', async function () {
    const user: ContextInfo = {
      userId: '3',
      tenantId: '2',
      projectId: '3',
      transactionId: '123456',
    }
    const requestURI = 'http://www.example.com'

    nock(requestURI).persist(true).post('/').reply(403)

    const client = service.getHttpClient({ contextInfo: user, retries: 3 })

    try {
      await client.post(requestURI, { name: 'test' })
      throw new Error('Throw if no error')
    } catch (error) {
      console.log(error)
      expect((error as AxiosError).status).toBe(403)
    }
  })
  it('should return status code on error - 500', async function () {
    const user: ContextInfo = {
      userId: '3',
      tenantId: '2',
      projectId: '3',
      transactionId: '123456',
    }
    const requestURI = 'http://www.example.com'

    nock(requestURI).persist(true).post('/').reply(500)

    const client = service.getHttpClient({ contextInfo: user, retries: 3 })

    try {
      await client.post(requestURI, { name: 'test' })
      throw new Error('Throw if no error')
    } catch (error) {
      console.log(error)
      expect((error as AxiosError).status).toBe(500)
    }
  })

  it('test module', async function () {
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), HttpClientModule],
      providers: [
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: ContextService,
          useValue: contextServiceMock,
        },
      ],
    }).compile()

    const app = module.createNestApplication()
    await app.init()
    await app.close()
  })
})

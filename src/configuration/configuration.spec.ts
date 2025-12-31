import * as fs from 'fs'
import { createConfig } from './config-impl'
import { ConfigModule } from './config.module'

jest.mock('fs')

describe('ConfigModule', () => {
  const mockReadFileSync = fs.readFileSync as jest.Mock

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('should define forRoot', () => {
    const dynamicModule = ConfigModule.forRoot({})
    expect(dynamicModule.module).toBe(ConfigModule)
    expect(dynamicModule.imports).toHaveLength(1)
  })

  describe('createConfigLoader', () => {
    it('should load default config only', () => {
      mockReadFileSync.mockReturnValue('app: { port: 3000 }')

      const loader = createConfig({
        defaultConfigFile: 'default.yml',
      })
      const config = loader()

      expect(config).toEqual({ app: { port: 3000 } })
      expect(mockReadFileSync).toHaveBeenCalledWith('default.yml', 'utf8')
    })

    it('should merge default and service config', () => {
      mockReadFileSync.mockImplementation((path: string) => {
        if (path === 'default.yml') return 'app: { port: 3000, name: "base" }'
        if (path === 'service.yml') return 'app: { port: 8080 }'
        return ''
      })

      const loader = createConfig({
        defaultConfigFile: 'default.yml',
        configFileName: 'service.yml',
      })
      const config = loader()

      expect(config).toEqual({
        app: {
          port: 8080,
          name: 'base',
        },
      })
      expect(mockReadFileSync).toHaveBeenCalledTimes(2)
    })
  })
})

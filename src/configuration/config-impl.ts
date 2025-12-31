import { readFileSync } from 'fs'
import yaml, { YAMLException } from 'js-yaml'
import { merge } from 'lodash'
import { join } from 'path'
import { ConfigModuleOptions } from './config.options'

export const DEFAULT_CONFIG_PATH = join(process.cwd(), 'src/config', 'default.yml')

function handleYAMLError(error: YAMLException, configFileName: string): never {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { message, ...restOfError } = error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const { buffer, snippet, ...restOfMark } = (restOfError as any).mark
  const errorWithoutPII = {
    ...restOfError,
    mark: restOfMark,
    message: `bad yaml file: ${configFileName}`,
  } as Error
  throw errorWithoutPII
}

function loadFile(configFileName: string): Record<string, unknown> {
  try {
    const content = readFileSync(configFileName, 'utf8')
    return yaml.load(content) as Record<string, unknown>
  } catch (error) {
    if (error instanceof YAMLException) {
      return handleYAMLError(error, configFileName)
    }
    // If file doesn't exist or other fs error, we might want to throw or return empty
    // Standard behavior often implies throwing if explicit file is missing
    throw error
  }
}

export function createConfig(options?: ConfigModuleOptions) {
  return () => {
    const defaultConfigFile = options?.defaultConfigFile || DEFAULT_CONFIG_PATH
    const configFileName = options?.configFileName || process.env.service_config || defaultConfigFile

    // 1. Load default config
    const defaultConfig = loadFile(defaultConfigFile)

    let config
    if (configFileName !== defaultConfigFile) {
      const serviceConfig = loadFile(configFileName)
      config = merge({}, defaultConfig, serviceConfig)
    } else {
      config = defaultConfig
    }

    return config
  }
}

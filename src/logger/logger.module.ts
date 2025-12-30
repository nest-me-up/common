import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Params, LoggerModule as PinoLoggerModule } from 'nestjs-pino'
import { stdTimeFunctions } from 'pino'
import { ContextInfo, ContextModule, ContextService } from '../context'
import { DEFAULT_MAX_MESSAGE_LENGTH, DEFAULT_REDACTED_KEYS } from './logger.consts'

/*
This is the configuration for the logger module.
It is used to configure the logger
 additionalRedactedKeys: Additional keys to redact from the logs.
 pretty: Whether to pretty print the logs
         Default true in development environment (environment variable NODE_ENV is set to 'local')).
*/
export interface LoggerConfig {
  additionalRedactedKeys: string[]
  pretty: boolean
}

/*
This is a module that creates a pino logger module that is pre configured for best practices
Including:
- Redacting sensitive information from the logs.
- Truncating long messages.
- Adding context information to the logs (using the ContextModule).
- Pretty printing the logs in development environment.
- Audit logging.
*/
@Module({})
export class LoggerModule {
  static forRoot(loggerConfig?: LoggerConfig): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRootAsync({
          imports: [ConfigModule, ContextModule],
          inject: [ConfigService, ContextService],
          useFactory: async (config: ConfigService, contextService: ContextService) => {
            return {
              pinoHttp: {
                redact: [...DEFAULT_REDACTED_KEYS, ...(loggerConfig?.additionalRedactedKeys || [])],
                mixin() {
                  const contextInfo: ContextInfo | undefined = contextService.getContext()
                  if (contextInfo) {
                    const logParameters = createLogParametersFromContext(contextInfo)
                    return logParameters
                  } else {
                    return {}
                  }
                },

                timestamp: stdTimeFunctions.isoTime,
                formatters: {
                  level: (label) => {
                    return { level: label.toUpperCase() }
                  },
                },
                level: config.get('logger')?.level || 'debug',
                transport:
                  loggerConfig?.pretty || process.env.NODE_ENV === 'local'
                    ? {
                        target: 'pino-pretty',
                        options: {
                          colorize: true,
                          hideObject: true,
                        },
                      }
                    : undefined,
                autoLogging: config.get('logger')?.audit || false,
                serializers: {
                  msg: (msg: string) => {
                    // First redact URL tokens, then truncate if needed
                    const redacted = redactUrlTokens(msg)
                    return loggerTruncateMessage(config.get('logger')?.max || DEFAULT_MAX_MESSAGE_LENGTH)(redacted)
                  },
                  err: (err) => {
                    // Redact URL tokens from error objects recursively
                    // This handles when error is passed as first argument: logger.error(error, 'message')
                    return redactUrlTokensRecursive(err)
                  },
                  error: (error) => {
                    // Redact URL tokens from error objects recursively
                    // This handles when error is nested in an object: logger.error({ error: ... }, 'message')
                    return redactUrlTokensRecursive(error)
                  },
                },
              },
            } as Params
          },
        }),
      ],
      exports: [PinoLoggerModule],
    }
  }
}

function loggerTruncateMessage(maxLength: number) {
  return (message: string) => {
    if (message.length > maxLength) {
      return message.substring(0, maxLength) + '...(truncated)'
    }
    return message
  }
}

/**
 * Redacts tokens from URLs that match the pattern: http(s)://...:TOKEN@domain
 * Example: https://x-token-auth:ATCTT3x...@bitbucket.org/...
 * Becomes: https://x-token-auth:***REDACTED***@bitbucket.org/...
 */
function redactUrlTokens(text: string): string {
  if (typeof text !== 'string') {
    return text
  }
  // Match http(s)://...:TOKEN@domain pattern
  // Group 1: http(s)://...: (everything up to and including the colon before the token)
  // Group 2: TOKEN (the token to redact)
  // Group 3: @domain (the @ and everything after)
  return text.replace(/(https?:\/\/[^:]+:)([^@]+)(@[^\s,]+)/g, '$1***REDACTED***$3')
}

/**
 * Recursively processes an object/array/primitive to redact URL tokens from all string values
 * Uses a WeakSet to track visited objects and prevent infinite recursion from circular references
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function redactUrlTokensRecursive(obj: any, visited: WeakSet<object> = new WeakSet()): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    return redactUrlTokens(obj)
  }

  // Handle primitive types that don't need processing
  if (typeof obj !== 'object') {
    return obj
  }

  // Check for circular references
  if (visited.has(obj)) {
    return '[Circular]'
  }

  // Add object to visited set
  visited.add(obj)

  try {
    if (Array.isArray(obj)) {
      return obj.map((item) => redactUrlTokensRecursive(item, visited))
    }

    // Handle special object types that shouldn't be processed
    if (obj instanceof Date || obj instanceof RegExp || obj instanceof Error) {
      // For Error objects, we still want to process their properties
      if (obj instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const redacted: any = {
          name: obj.name,
          message: redactUrlTokens(obj.message),
          stack: obj.stack ? redactUrlTokens(obj.stack) : undefined,
        }
        // Process additional properties
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key) && !['name', 'message', 'stack'].includes(key)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            redacted[key] = redactUrlTokensRecursive((obj as any)[key], visited)
          }
        }
        return redacted
      }
      return obj
    }

    // Handle plain objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redacted: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        redacted[key] = redactUrlTokensRecursive(obj[key], visited)
      }
    }
    return redacted
  } finally {
    // Note: We don't remove from visited set because we want to detect cycles
    // even if the same object appears in different branches
  }
}

function createLogParametersFromContext(contextInfo: ContextInfo) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logParameters: Record<string, any> = {}

  for (const [key, value] of Object.entries(contextInfo)) {
    if (value !== undefined && value !== null) {
      logParameters[`context${capitalizeFirstLetter(key)}`] = value
    }
  }

  return logParameters
}

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

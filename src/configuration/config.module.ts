import { DynamicModule, Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { createConfigLoader, DEFAULT_CONFIG_PATH } from './config-impl'
import { ConfigModuleOptions } from './config.options'
/*
This is a custom implementation of the standard NestJS ConfigModule (from @nestjs/config).
It is designed to:
- Load configuration from YAML files instead of just .env files.
- Support configuration inheritance/merging:
  It loads a default configuration file and then layers a service-specific configuration file on top of it.
- Be Global: It is decorated with @Global(), so you only need to import it once in your root module,
  and its providers (like ConfigService) will be available everywhere.

How it works:
The core logic lies in the createConfigLoader function (imported from ./config-impl).
When the module starts:
- Determine File Paths:
  It looks for a default config (defaults to src/config/default.yml via DEFAULT_CONFIG_PATH).
  It looks for a specific config file. It checks:
  - The options.configFileName passed to forRoot.
  - The service_config environment variable.
  - Falls back to the default config path.
- Load & Merge:
  It reads and parses the default YAML file.
  If a specific config file is different from the default, it reads that too.
  It uses merge to deeply merge the specific config over the default config.
  This allows you to have a base configuration and override specific values per environment or service.

Error Handling:
It includes custom error handling for YAML parsing errors (handleYAMLError),
which sanitizes error messages (removing file snippets) to avoid leaking sensitive information in logs.

How to use it in a NestJS App:
- Step 1: Create your YAML config files
  Ensure you have your configuration files created, for example:
  src/config/default.yml
  src/config/production.yml (optional)
- Step 2: Import in AppModule
  Import ConfigModule into your root application module.
  You typically don't need to pass options if you rely on the defaults or environment variables.
- Step 3: Access Configuration
  Since the module exports the standard NestConfigModule,
  you can inject the standard ConfigService to read values.

  You can switch configurations at runtime using the environment variable defined in the logic:
  Run with a specific config file:
  service_config=src/config/production.yml npm run start

*/
@Global()
@Module({})
export class ConfigModule {
  static forRoot(
    options: ConfigModuleOptions = {
      defaultConfigFile: DEFAULT_CONFIG_PATH,
      configFileName: process.env.service_config || DEFAULT_CONFIG_PATH,
    },
  ): DynamicModule {
    return {
      module: ConfigModule,
      imports: [
        NestConfigModule.forRoot({
          load: [createConfigLoader(options)],
          isGlobal: true,
        }),
      ],
      exports: [NestConfigModule],
    }
  }
}

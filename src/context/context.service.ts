import { Injectable, Logger } from '@nestjs/common'
import { AsyncLocalStorage } from 'async_hooks'
import { ContextInfo } from './context-info.dto'

/*
This is a service that provides a context for the request.
It is used to store the context information and the context storage data.
The context information is stored in the AsyncLocalStorage and is available to the entire request lifecycle.
The context storage data can be used to store any data that is needed for the request lifecycle.
*/

@Injectable()
export class ContextService<T extends ContextInfo> {
  private readonly asyncLocalStorage: AsyncLocalStorage<ContextData<T>>
  private readonly logger = new Logger(ContextService.name)

  constructor() {
    this.asyncLocalStorage = new AsyncLocalStorage<ContextData<T>>()
  }

  /*
  Returns the context information for the current request.
  */
  getContext(): T | undefined {
    return this.asyncLocalStorage.getStore()?.contextInfo
  }

  /*
   Runs the callback method with the context information.
   Used to run a flow with new context information branching off the current context.
  */
  runWithContext<R>(contextInfo: T, callback: () => R): R {
    const newContext: ContextData<T> = {
      contextInfo,
      contextStorage: {},
    }
    return this.asyncLocalStorage.run(newContext, callback)
  }

  /*
  Updates the context information for the current request.
  */
  updateContextInfo(contextInfo: T) {
    const currentContextData = this.asyncLocalStorage.getStore()
    if (currentContextData) {
      currentContextData.contextInfo = contextInfo
    } else {
      this.logger.warn('ContextInfo is not available')
    }
  }

  /*
  Returns the context storage data for the current request.
  */
  getContextStorageData(dataName: string): unknown {
    const currentContext = this.asyncLocalStorage.getStore()
    return currentContext?.contextStorage?.[dataName]
  }

  /*
  Updates the context storage data for the current request.
  Used to store any data that is needed for the request lifecycle.
  */
  updateContextStorageData(dataName: string, data: unknown) {
    const currentContext = this.asyncLocalStorage.getStore()
    if (currentContext) {
      if (!currentContext.contextStorage) {
        currentContext.contextStorage = {}
      }
      currentContext.contextStorage[dataName] = data
    } else {
      this.logger.warn('ContextStorage is not available')
    }
  }
}

interface ContextData<T extends ContextInfo> {
  contextInfo: T
  contextStorage: Record<string, unknown>
}

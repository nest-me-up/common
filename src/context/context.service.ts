import { Injectable, Logger } from '@nestjs/common'
import { AsyncLocalStorage } from 'async_hooks'
import { ContextInfo } from './context.interface'

/*
This is a service that provides a context for the request.
It is used to store the context information and the context storage data.
The context information is stored in the AsyncLocalStorage and is available to the entire request lifecycle.
The context storage data can be used to store any data that is needed for the request lifecycle.
*/

@Injectable()
export class ContextService {
  private readonly asyncLocalStorage: AsyncLocalStorage<ContextData>
  private readonly logger = new Logger(ContextService.name)

  constructor() {
    this.asyncLocalStorage = new AsyncLocalStorage<ContextData>()
  }

  /*
  /*
  Returns the context information for the current request.
  */
  getContext<T extends ContextInfo>(): T {
    return (this.asyncLocalStorage.getStore()?.contextInfo as T) ?? ({} as T)
  }

  /*
   Runs the callback method with the context information.
   Used to run a flow with new context information branching off the current context.
  */
  runWithContext<R>(contextInfo: ContextInfo, callback: () => R): R {
    const newContext: ContextData = {
      contextInfo,
      contextStorage: {},
    }
    return this.asyncLocalStorage.run(newContext, callback)
  }

  /*
  Updates the context information for the current request.
  */
  updateContextInfo(contextInfo: ContextInfo) {
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

interface ContextData {
  contextInfo: ContextInfo
  contextStorage: Record<string, unknown>
}

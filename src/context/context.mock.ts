import { ContextInfo } from './context-info.dto'
import { ContextService } from './context.service'

/*
This is a mock implementation of the ContextService class.
It is used in unit tests to test the context service without actually storing the context information in the AsyncLocalStorage.
*/
export function createContextServiceMock<T extends ContextInfo>(contextInfo?: T): ContextService<T> {
  return {
    getContext: jest.fn().mockReturnValue(contextInfo),
    runWithContext: jest.fn().mockImplementation((_, fn) => fn()),
    updateContextInfo: jest.fn(),
    getContextStorageData: jest.fn(),
    updateContextStorageData: jest.fn(),
  } as unknown as ContextService<T>
}

import { PinoLogger } from 'nestjs-pino'

/*
This is a mock implementation of the PinoLogger interface.
It is used in unit tests to test the logger module without actually logging to a file.
*/
export function getLoggerMock() {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
  } as unknown as PinoLogger
}

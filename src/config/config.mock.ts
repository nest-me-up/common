import { ConfigService } from '@nestjs/config'

export function getConfigServiceMock(): ConfigService {
  return {
    get: jest.fn(),
  } as unknown as ConfigService
}

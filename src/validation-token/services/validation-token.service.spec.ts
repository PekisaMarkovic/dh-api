import { Test, TestingModule } from '@nestjs/testing';
import { ValidationTokenService } from './validation-token.service';

describe('ValidationTokenService', () => {
  let service: ValidationTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationTokenService],
    }).compile();

    service = module.get<ValidationTokenService>(ValidationTokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

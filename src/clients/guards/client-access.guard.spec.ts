import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { ClientsService } from '@/clients/services/clients.service';

describe('ClientAccessGuard', () => {
  let clientsService: { findActive: jest.Mock };
  let guard: ClientAccessGuard;

  const contextOf = (request: object) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    clientsService = { findActive: jest.fn() };
    guard = new ClientAccessGuard(clientsService as unknown as ClientsService);
  });

  it('should let the request in and hand over the client', async () => {
    const client = { clientId: 'abc', companyId: 1 };
    clientsService.findActive.mockResolvedValue(client);
    const request: { headers: object; client?: unknown } = {
      headers: { 'x-access-key': ' abc ' },
    };

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(clientsService.findActive).toHaveBeenCalledWith('abc');
    expect(request.client).toBe(client);
  });

  it('should reject a request without the key', async () => {
    await expect(guard.canActivate(contextOf({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(clientsService.findActive).not.toHaveBeenCalled();
  });

  it('should reject a key of a client that does not exist', async () => {
    clientsService.findActive.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextOf({ headers: { 'x-access-key': 'nope' } })),
    ).rejects.toThrow(UnauthorizedException);
  });
});

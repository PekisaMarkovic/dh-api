import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permissions } from '@/auth/decorators';
import { ClientPermissionEnums } from '@/auth/enums';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';

const [READ, WRITE] = Object.values(
  ClientPermissionEnums,
) as ClientPermissionEnums[];

class FakeController {
  @Permissions(WRITE)
  protected() {}

  open() {}
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  const contextOf = (handler: (...args: never[]) => void, user: object) =>
    ({
      getHandler: () => handler,
      getClass: () => FakeController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('should let everyone in when no permission is required', () => {
    expect(
      guard.canActivate(contextOf(FakeController.prototype.open, {})),
    ).toBe(true);
  });

  it('should let in a user that has the permission directly', () => {
    const user = { permissions: [{ name: WRITE }] };

    expect(
      guard.canActivate(contextOf(FakeController.prototype.protected, user)),
    ).toBe(true);
  });

  it('should let in a user that has the permission through a role', () => {
    const user = { roles: [{ permissions: [{ name: WRITE }] }] };

    expect(
      guard.canActivate(contextOf(FakeController.prototype.protected, user)),
    ).toBe(true);
  });

  it('should keep out a user without the permission', () => {
    const user = { permissions: [{ name: READ }] };

    expect(
      guard.canActivate(contextOf(FakeController.prototype.protected, user)),
    ).toBe(false);
  });

  it('should keep out a user without any permission or role', () => {
    expect(
      guard.canActivate(contextOf(FakeController.prototype.protected, {})),
    ).toBe(false);
  });
});

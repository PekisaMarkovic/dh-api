import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import { RolesGuard } from '@/auth/guards/roles.guard';

@Roles(ClientRoleEnums.SUPER_ADMIN)
class SuperAdminController {
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  admins() {}

  inherited() {}
}

class OpenController {
  open() {}

  @Roles()
  noRoles() {}
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  const contextOf = (
    controller: new () => object,
    handler: (...args: never[]) => void,
    user?: { roles?: { name: ClientRoleEnums }[] },
  ) =>
    ({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const withRoles = (...names: ClientRoleEnums[]) => ({
    roles: names.map((name) => ({ name })),
  });

  it('should let everyone in when no role is required', () => {
    expect(
      guard.canActivate(
        contextOf(OpenController, OpenController.prototype.open, withRoles()),
      ),
    ).toBe(true);
  });

  it('should let everyone in when the list of roles is empty', () => {
    expect(
      guard.canActivate(
        contextOf(
          OpenController,
          OpenController.prototype.noRoles,
          withRoles(),
        ),
      ),
    ).toBe(true);
  });

  it('should let in a user that has one of the roles', () => {
    const context = contextOf(
      SuperAdminController,
      SuperAdminController.prototype.admins,
      withRoles(ClientRoleEnums.ADMIN),
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should keep out a user that has none of the roles', () => {
    const context = contextOf(
      SuperAdminController,
      SuperAdminController.prototype.admins,
      withRoles(ClientRoleEnums.USER),
    );

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should keep out a user without roles', () => {
    const context = contextOf(
      SuperAdminController,
      SuperAdminController.prototype.admins,
      {},
    );

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should take the roles of the method before the roles of the controller', () => {
    // the controller is only for the super admin, the method also lets the admin in
    const context = contextOf(
      SuperAdminController,
      SuperAdminController.prototype.admins,
      withRoles(ClientRoleEnums.ADMIN),
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should use the roles of the controller when the method has none', () => {
    const admin = contextOf(
      SuperAdminController,
      SuperAdminController.prototype.inherited,
      withRoles(ClientRoleEnums.ADMIN),
    );
    const superAdmin = contextOf(
      SuperAdminController,
      SuperAdminController.prototype.inherited,
      withRoles(ClientRoleEnums.SUPER_ADMIN),
    );

    expect(guard.canActivate(admin)).toBe(false);
    expect(guard.canActivate(superAdmin)).toBe(true);
  });
});

import { ClientRoleEnums } from '@/auth/enums';
import {
  getClientPermissions,
  userHasAnyRole,
} from '@/common/helpers/auth.helpers';
import { User } from '@/users/entities/user.entity';

describe('auth.helpers', () => {
  describe('getClientPermissions', () => {
    it('should join the permissions of the roles and the ones given directly', () => {
      const user = {
        roles: [
          { permissions: [{ name: 'read' }] },
          { permissions: [{ name: 'write' }] },
        ],
        permissions: [{ name: 'delete' }],
      } as unknown as User;

      expect(getClientPermissions(user)).toEqual(
        new Set(['read', 'write', 'delete']),
      );
    });

    it('should list a permission once when it comes from more places', () => {
      const user = {
        roles: [{ permissions: [{ name: 'read' }] }],
        permissions: [{ name: 'read' }],
      } as unknown as User;

      expect(getClientPermissions(user)).toEqual(new Set(['read']));
    });

    it('should return nothing for a user without roles and permissions', () => {
      expect(getClientPermissions({})).toEqual(new Set());
    });

    it('should not fail on a role without permissions', () => {
      expect(
        getClientPermissions({ roles: [{ name: 'user' }] } as unknown as User),
      ).toEqual(new Set());
    });
  });

  describe('userHasAnyRole', () => {
    const user = {
      roles: [{ name: ClientRoleEnums.ADMIN }],
    } as unknown as User;

    it('should be true when the user has one of the roles', () => {
      expect(
        userHasAnyRole(user, [
          ClientRoleEnums.SUPER_ADMIN,
          ClientRoleEnums.ADMIN,
        ]),
      ).toBe(true);
    });

    it('should be false when the user has none of the roles', () => {
      expect(userHasAnyRole(user, [ClientRoleEnums.SUPER_ADMIN])).toBe(false);
    });

    it('should be undefined for a user without roles', () => {
      expect(
        userHasAnyRole({} as User, [ClientRoleEnums.ADMIN]),
      ).toBeUndefined();
    });
  });
});

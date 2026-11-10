import { SetMetadata } from '@nestjs/common';
import { ClientRoleEnums } from '@/auth/enums/role.enum';

export const ROLES_METEDATA_KEY = 'roles_decorator_key';

export const Roles = (...roles: ClientRoleEnums[]) =>
  SetMetadata(ROLES_METEDATA_KEY, roles);

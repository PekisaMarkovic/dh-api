import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ROLES_METEDATA_KEY } from '@/auth/decorators/roles.decorator';
import { ClientRoleEnums } from '@/auth/enums';

/** The roles that are allowed to call a method of a controller, undefined when every logged in user is */
export const rolesOf = (handler: object): ClientRoleEnums[] | undefined =>
  Reflect.getMetadata(ROLES_METEDATA_KEY, handler);

/** True when a method of a controller can be called without logging in */
export const isPublic = (handler: object): boolean =>
  Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;

export const ADMINS = [ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN];

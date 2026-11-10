import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PERMISSIONS_METEDATA_KEY } from '@/auth/decorators';
import { ClientPermissionEnums } from '@/auth/enums';
import { getClientPermissions } from '@/common/helpers';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private refector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredClientPermissions = this.refector.getAllAndOverride<
      ClientPermissionEnums[] | undefined
    >(PERMISSIONS_METEDATA_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredClientPermissions || requiredClientPermissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const userPermissions = getClientPermissions(req.user);

    return requiredClientPermissions.some((permission) =>
      userPermissions.has(permission),
    );
  }
}

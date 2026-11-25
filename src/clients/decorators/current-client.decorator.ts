import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClientRequest } from '@/clients/guards/client-access.guard';

/** The client that the ClientAccessGuard found with the access key */
export const CurrentClient = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<ClientRequest>().client,
);

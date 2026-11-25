import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Client } from '@/clients/entities/client.entity';
import { ClientsService } from '@/clients/services/clients.service';

export const ACCESS_KEY_HEADER = 'x-access-key';

export type ClientRequest = Request & { client: Client };

/**
 * For the public routes of a white label site: the site sends the GUID of its client
 * in the `X-Access-Key` header and the guard finds the client (and so the company) with it.
 * The key only says which site is asking, it is not a secret: the public routes return only what the site shows.
 */
@Injectable()
export class ClientAccessGuard implements CanActivate {
  constructor(private readonly clientsService: ClientsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ClientRequest>();
    const key = request.headers[ACCESS_KEY_HEADER];
    const clientId = (Array.isArray(key) ? key[0] : key)?.trim();

    if (!clientId) {
      throw new UnauthorizedException('The access key is missing.');
    }

    const client = await this.clientsService.findActive(clientId);

    if (!client) {
      throw new UnauthorizedException('The access key is not valid.');
    }

    request.client = client;

    return true;
  }
}

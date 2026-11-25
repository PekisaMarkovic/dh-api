import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '@/companies/companies.module';
import { Client } from '@/clients/entities/client.entity';
import { ClientContactedBy } from '@/clients/entities/client-contacted-by.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { PublicContactController } from '@/clients/controllers/public-contact.controller';
import { PublicDrinksController } from '@/clients/controllers/public-drinks.controller';
import { PublicSiteController } from '@/clients/controllers/public-site.controller';
import { WebsiteController } from '@/clients/controllers/website.controller';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { ClientContactsService } from '@/clients/services/client-contacts.service';
import { ClientsService } from '@/clients/services/clients.service';
import { PublicDrinksService } from '@/clients/services/public-drinks.service';
import { SiteRevalidationService } from '@/clients/services/site-revalidation.service';
import { PublicSiteService } from '@/clients/services/public-site.service';
import { WebsiteService } from '@/clients/services/website.service';
import { StorageModule } from '@/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ClientContactedBy, Drink]),
    // the limits are set per route with @Throttle, this is only the default
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    CompaniesModule,
    StorageModule,
  ],
  controllers: [
    PublicDrinksController,
    PublicContactController,
    PublicSiteController,
    WebsiteController,
  ],
  providers: [
    ClientsService,
    PublicDrinksService,
    ClientContactsService,
    PublicSiteService,
    WebsiteService,
    SiteRevalidationService,
    ClientAccessGuard,
  ],
  exports: [ClientsService],
})
export class ClientsModule {}

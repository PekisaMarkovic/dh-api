import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '@/categories/categories.module';
import { CompaniesModule } from '@/companies/companies.module';
import { OrdersModule } from '@/orders/orders.module';
import { Client } from '@/clients/entities/client.entity';
import { ClientContactedBy } from '@/clients/entities/client-contacted-by.entity';
import { Page } from '@/clients/entities/page.entity';
import { PageSection } from '@/clients/entities/page-section.entity';
import { Section } from '@/clients/entities/section.entity';
import { Seo } from '@/clients/entities/seo.entity';
import { Drink } from '@/drinks/entities/drink.entity';
import { PublicContactController } from '@/clients/controllers/public-contact.controller';
import { PublicDrinksController } from '@/clients/controllers/public-drinks.controller';
import { PublicOrdersController } from '@/clients/controllers/public-orders.controller';
import { PublicSiteController } from '@/clients/controllers/public-site.controller';
import { WebsiteController } from '@/clients/controllers/website.controller';
import { ClientAccessGuard } from '@/clients/guards/client-access.guard';
import { ClientContactsService } from '@/clients/services/client-contacts.service';
import { ClientsService } from '@/clients/services/clients.service';
import { PublicDrinksService } from '@/clients/services/public-drinks.service';
import { SiteRevalidationService } from '@/clients/services/site-revalidation.service';
import { PublicSiteService } from '@/clients/services/public-site.service';
import { SitePagesService } from '@/clients/services/site-pages.service';
import { WebsiteService } from '@/clients/services/website.service';
import { StorageModule } from '@/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      ClientContactedBy,
      Drink,
      Page,
      Section,
      PageSection,
      Seo,
    ]),
    // the limits are set per route with @Throttle, this is only the default
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    CompaniesModule,
    StorageModule,
    CategoriesModule,
    OrdersModule,
  ],
  controllers: [
    PublicDrinksController,
    PublicOrdersController,
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
    SitePagesService,
    SiteRevalidationService,
    ClientAccessGuard,
  ],
  exports: [ClientsService],
})
export class ClientsModule {}

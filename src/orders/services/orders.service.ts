import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { In, Repository } from 'typeorm';
import { Client } from '@/clients/entities/client.entity';
import { lineTotalCents } from '@/common/helpers/money.helpers';
import { CompaniesService } from '@/companies/services/companies.service';
import { Drink } from '@/drinks/entities/drink.entity';
import { MailerService } from '@/mailer/services/mailer.service';
import { CreateOrderDto } from '@/orders/dto/create-order.dto';
import { FindOrdersDto } from '@/orders/dto/find-orders.dto';
import { UpdateOrderStatusDto } from '@/orders/dto/update-order-status.dto';
import { Order } from '@/orders/entities/order.entity';
import { OrderItem } from '@/orders/entities/order-item.entity';
import { OrderStatus } from '@/orders/order-status.enum';
import { isPickupDateAllowed } from '@/orders/pickup-date';
import { User } from '@/users/entities/user.entity';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Drink)
    private readonly drinkRepository: Repository<Drink>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly companiesService: CompaniesService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * An order from the site of the client. The names and the prices are taken from the database
   * (never from the site), then the employees and the buyer get an email.
   * @throws ForbiddenException if the site does not allow ordering
   * @throws BadRequestException if the day can not be picked or a drink is not on the menu
   */
  async create(client: Client, dto: CreateOrderDto) {
    if (!client.isOrderingAllowed) {
      throw new ForbiddenException('Ordering is not allowed on this site.');
    }

    if (!isPickupDateAllowed(dto.pickupDate)) {
      throw new BadRequestException(
        'The day of the pick up can be from today (tomorrow after 15:00) to one month ahead.',
      );
    }

    const drinks = await this.drinkRepository.find({
      where: {
        drinkId: In(dto.items.map((item) => item.drinkId)),
        companyId: client.companyId,
      },
    });
    const byId = new Map(drinks.map((drink) => [drink.drinkId, drink]));

    if (byId.size !== dto.items.length) {
      throw new BadRequestException(
        'One of the drinks is no longer on the menu.',
      );
    }

    const items = dto.items.map((item) => {
      const drink = byId.get(item.drinkId)!;

      return {
        drinkId: drink.drinkId,
        code: drink.code ?? null,
        name: drink.name,
        unitPrice: drink.price,
        quantity: item.quantity,
      } as OrderItem;
    });
    const totalCents = items.reduce(
      (sum, item) => sum + lineTotalCents(item.unitPrice, item.quantity),
      0,
    );

    const order = await this.orderRepository.save(
      this.orderRepository.create({
        companyId: client.companyId,
        clientId: client.clientId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        pickupDate: dto.pickupDate,
        total: totalCents / 100,
        items,
      }),
    );

    await this.sendMails(client, order);

    return { orderId: order.orderId };
  }

  /** True when the site of the company of the user lets the visitors order: the dashboard shows "Porudžbine" only then */
  async isEnabled(user: User) {
    if (!user.companyId) {
      return { isOrderingAllowed: false };
    }

    const client = await this.clientRepository.findOne({
      where: { companyId: user.companyId, isOrderingAllowed: true },
      select: { clientId: true },
    });

    return { isOrderingAllowed: !!client };
  }

  /** A page of the orders of the company of the user, the newest first, optionally with one status */
  async findAll(user: User, query: FindOrdersDto) {
    return paginate(this.orderRepository, query, {
      where: {
        companyId: user.companyId ?? -1,
        ...(query.status ? { status: query.status } : {}),
      },
      order: { createdAt: 'DESC', orderId: 'DESC' },
    });
  }

  /** An order with its drinks */
  async findOne(orderId: number, user: User) {
    const order = await this.orderRepository.findOne({
      where: { orderId },
      relations: { items: true },
      order: { items: { orderItemId: 'ASC' } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.companiesService.assertCanAccess(user, order.companyId);

    return order;
  }

  /**
   * Sets the status of the order (any of them, also back). Only a cancellation is told to the buyer:
   * an email with the reason, once (cancelling a cancelled order again sends nothing).
   */
  async updateStatus(orderId: number, dto: UpdateOrderStatusDto, user: User) {
    const order = await this.findOne(orderId, user);
    const isCancelledNow =
      dto.status === OrderStatus.CANCELLED &&
      order.status !== OrderStatus.CANCELLED;

    order.status = dto.status;
    // the reason belongs to a cancelled order, an order that is opened again has none
    order.cancelReason =
      dto.status === OrderStatus.CANCELLED
        ? (dto.reason ?? order.cancelReason ?? null)
        : null;

    const saved = await this.orderRepository.save(order);

    if (isCancelledNow) {
      await this.sendCancelledMail(saved);
    }

    return saved;
  }

  private async sendCancelledMail(order: Order) {
    const client = await this.clientRepository.findOne({
      where: { clientId: order.clientId },
      withDeleted: true,
    });

    await this.mailerService.sendOrderCancelledMail({
      orderId: order.orderId,
      fullName: order.fullName,
      email: order.email,
      phone: order.phone,
      address: order.address,
      pickupDate: order.pickupDate,
      total: order.total,
      items: order.items,
      siteName: client?.name ?? '',
      sitePhone: client?.phone ?? null,
      reason: order.cancelReason,
    });
  }

  /** The emails never stop an order: it is saved, a failure is only logged */
  private async sendMails(client: Client, order: Order) {
    try {
      const users = await this.companiesService.findUsers(client.companyId);

      await this.mailerService.sendOrderMails({
        orderId: order.orderId,
        fullName: order.fullName,
        email: order.email,
        phone: order.phone,
        address: order.address,
        pickupDate: order.pickupDate,
        total: order.total,
        items: order.items,
        siteName: client.name,
        sitePhone: client.phone,
        recipients: users
          .filter((user) => !!user.email)
          .map((user) => ({
            address: user.email,
            name: `${user.firstName} ${user.lastName}`.trim(),
          })),
      });
    } catch (error) {
      this.logger.error(
        `Could not send the emails of the order #${order.orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

import { BadRequestException, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import { User } from '@/users/entities/user.entity';
import { StockAlertsService } from '@/stock-alerts/services/stock-alerts.service';

@Controller('stock-alerts')
@ApiTags('Stock alerts')
@ApiBearerAuth('access-token')
export class StockAlertsController {
  constructor(private readonly stockAlertsService: StockAlertsService) {}

  @Post('digest')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({
    summary:
      'Send the overview of the low stock to all employees of your company now (the same email that goes out at 8:00 and 15:00)',
  })
  sendNow(@CurrentUser() user: User) {
    if (!user.companyId) {
      throw new BadRequestException('You have to be in a company.');
    }

    return this.stockAlertsService.sendDigest(user.companyId);
  }
}

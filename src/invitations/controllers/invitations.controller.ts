import { Body, Controller, Get, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import { User } from '@/users/entities/user.entity';
import { InviteUserDto } from '@/invitations/dto/invite-user.dto';
import { InvitationsService } from '@/invitations/services/invitations.service';

@Controller('invitations')
@ApiTags('Invitations')
@ApiBearerAuth('access-token')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({
    summary: 'Invite an email to the platform (sends the invite mail)',
  })
  @ApiResponse({ status: HttpStatus.CREATED })
  async invite(@Body() dto: InviteUserDto, @CurrentUser() user: User) {
    await this.invitationsService.invite(dto.email, user);

    return true;
  }

  @Get()
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({ summary: 'Invitations of your company with their status' })
  findAll(@CurrentUser() user: User) {
    return this.invitationsService.findByCompany(user.companyId);
  }

  @Post(':invitationId/resend')
  @Roles(ClientRoleEnums.SUPER_ADMIN, ClientRoleEnums.ADMIN)
  @ApiOperation({
    summary:
      'Send the invitation email again and start the 7 days of expiry again',
  })
  resend(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: User,
  ) {
    return this.invitationsService.resend(invitationId, user);
  }

  @Public()
  @Get(':invitationId/valid')
  @ApiOperation({ summary: 'Check if invitation link is still valid' })
  @ApiResponse({ status: HttpStatus.OK, type: Boolean })
  isValid(@Param('invitationId') invitationId: string) {
    return this.invitationsService.isValid(invitationId);
  }
}

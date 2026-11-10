import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles, CurrentUser } from '@/auth/decorators';
import { ClientRoleEnums } from '@/auth/enums';
import { UpdateProfileDto } from '@/users/dto';
import { User } from '@/users/entities/user.entity';
import { UsersService } from '@/users/services/users.service';

@Controller('users')
@ApiTags('Users')
@ApiBearerAuth('access-token')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(ClientRoleEnums.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a users' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return the user.',
    type: [User],
  })
  getUsers() {
    return this.usersService.getUsers();
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get currently logged user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return the user.',
    type: User,
  })
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update phone number, date of birth and language of current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return the user.',
    type: User,
  })
  patchUserProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.patchUserProfile(user.email, dto);
  }
}

import {
  Body,
  Controller,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  RefreshTokenDto,
  LoginUserDto,
  FirstTimeRegisterDto,
} from '@/users/dto';
import { User } from '@/users/entities/user.entity';
import { TokenDto } from '@/auth/dto';
import { UsersService } from '@/users/services/users.service';
import { Public, CurrentUser } from '@/auth/decorators';
import { LocalAuthGuard } from '@/auth/guards';
import { AuthService } from '@/auth/services/auth.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@Controller('auth')
@ApiBearerAuth('access-token')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({
    summary: 'Log in in user in our platform, generate token and refresh token',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Return the tokens.',
    type: TokenDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Throws exception if user is not found.',
    type: NotFoundException,
  })
  async login(@Body() body: LoginUserDto) {
    return this.authService.login(body);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Generates new token and new refresh token.' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Return the tokens.',
    type: TokenDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Throws exception if user/token is not found.',
    type: NotFoundException,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Throws exception if user/token is not found.',
    type: UnauthorizedException,
  })
  async refreshToken(@Body() body: RefreshTokenDto) {
    const { refreshToken } = body;

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    return await this.authService.refreshToken(refreshToken);
  }

  @Public()
  @Post('first-time-register')
  @ApiOperation({
    summary:
      'Finish registration for an invited email, returns access and refresh token',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: TokenDto })
  firstTimeRegister(@Body() dto: FirstTimeRegisterDto) {
    return this.authService.firstTimeRegister(dto);
  }

  @Public()
  @Post('is-user-token-valid')
  @ApiOperation({ summary: 'Check if token is still valid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return the boolean.',
    type: Boolean,
  })
  isUserTokenValid(@Req() request: Request) {
    try {
      const authHeader = request.headers['authorization'];
      const token = authHeader.split(' ')[1];

      return this.authService.isUserTokenValid(token || '');
    } catch {
      return false;
    }
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user, remove all refresh tokens' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return the boolean.',
    type: Boolean,
  })
  async logout(@CurrentUser() user: User) {
    this.authService.logout(user.email);

    return true;
  }
}

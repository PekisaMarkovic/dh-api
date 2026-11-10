import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '@/users/services/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginUser } from '@/users/interface/user';
import { ValidationTokenService } from '@/validation-token/services/validation-token.service';
import { ValidationTokenTypeEnums } from '@/validation-token/enums/VerificationTokenType';
import { ConfigService } from '@nestjs/config';
import { User } from '@/users/entities/user.entity';
import { LoginDto } from '@/auth/dto';
import { Nullable } from '@/common/interface';
import { FirstTimeRegisterDto } from '@/users/dto';
import { InvitationsService } from '@/invitations/services/invitations.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly validationTokenService: ValidationTokenService,
    private readonly configService: ConfigService,
    private readonly invitationsService: InvitationsService,
  ) {}

  /**
   * Check if credetials are valud
   * @param LoginDto - The data to check
   * @returns The user wihtout password | null
   *
   */
  async validateUser({
    email,
    password,
  }: LoginDto): Promise<Nullable<LoginUser>> {
    const user = await this.usersService.getUserByEmailForLogIn(email);

    if (!user) {
      return null;
    }

    try {
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return null;
      }
    } catch {
      return null;
    }

    delete user.password;

    return user;
  }

  /**
   * Login user throgh email
   * @param userDto - The data need to have email
   * @return The object that containes { access_token, refresh_token }
   * @throws Throws exception if there is no user
   *
   */
  async login(userDto: any) {
    const user = await this.usersService.getUserByEmail(userDto.email);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.validationTokenService.removeRefreshTokenByEmail(user.email);

    return this.generateTokenByEmail(user.email);
  }

  /**
   * Finish registration for an invited email: validates the invitation,
   * reads the email from it, creates the user and logs them in.
   * @throws BadRequestException if invitation is invalid/expired/used
   */
  async firstTimeRegister(dto: FirstTimeRegisterDto) {
    const invitation = await this.invitationsService.findUsable(
      dto.invitationId,
    );

    if (!invitation) {
      throw new BadRequestException('Invitation is not valid');
    }

    if (await this.usersService.getUserByEmail(invitation.email)) {
      throw new ConflictException('User already exists');
    }

    const { invitationId: _id, ...data } = dto;
    void _id;

    await this.usersService.createInvitedUser(
      invitation.email,
      data,
      invitation.companyId,
    );
    await this.invitationsService.markAccepted(invitation);

    return this.generateTokenByEmail(invitation.email);
  }

  /**
   * Is token valid
   * @param token - The token is string
   * @returns boolean
   *
   */
  async isUserTokenValid(token: string) {
    try {
      await this.jwtService.verifyAsync(token);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Removes all refresh tokens from db
   * @param email - The email is string
   *
   */
  logout(email: string) {
    this.validationTokenService.removeRefreshTokenByEmail(email);
  }

  /**
   * Generates new refresh token for user
   * @param refreshToken - The token string
   * @returns The user wihtout password | null
   * @throws Throws exception if there is no user/token
   *
   */
  async refreshToken(refreshToken: string) {
    let payload: { email: string; validationTokenId: number };

    try {
      // verifies signature and expiry (JWT_REFRESH_EXPIRE)
      payload = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token is not valid');
    }

    const user = await this.usersService.getUserByEmail(payload.email);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const dbToken = await this.validationTokenService.getRefreshTokenByEmail(
      user.email,
    );

    if (!dbToken || dbToken.validationTokenId !== payload.validationTokenId) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (Number(dbToken.expirationDate) < new Date().getTime()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.validationTokenService.removeRefreshTokenByEmail(dbToken.email);

    return this.generateTokenByEmail(user.email);
  }

  /**
   * Create a new token
   * @param User - The user data to generate token
   * @returns jwt token
   *
   */
  private generateAccessToken = (user: User) => {
    return this.jwtService.sign({
      email: user.email,
      sub: user.userId,
      roles: user.roles || [],
      firstName: user.firstName,
      language: user.language,
      phoneNumber: user.phoneNumber,
      dateOfBirth: user.dateOfBirth,
      lastName: user.lastName,
      companyId: user.companyId,
      expires: new Date().getTime() + 3600000,
    });
  };

  private async generateTokenByEmail(email: string) {
    const user = await this.usersService.getUserByEmail(email);

    const newAccessToken = this.generateAccessToken(user);

    const { token, ...rest } =
      await this.validationTokenService.createValidationToken({
        email: user.email,
        token: newAccessToken,
        validationTokenType: ValidationTokenTypeEnums.REFRESH,
      });

    return {
      access_token: token,
      refresh_token: this.jwtService.sign(rest, {
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRE'),
      }),
    };
  }
}

import { paginate } from 'nestjs-typeorm-paginate';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { toLikePattern } from '@/common/helpers';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { ClientRoleEnums } from '@/auth/enums';
import { Role } from '@/auth/entities/role.entity';
import { Nullable } from '@/common/interface';
import { Repository } from 'typeorm';
import {
  UserRolesAndPermisssionsDto,
  RegisterUserDto,
  RegisterUserOptionsDto,
  UpdateProfileDto,
} from '@/users/dto';
import { User } from '@/users/entities/user.entity';
import { LoginUser } from '@/users/interface/user';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  /**
   * Find all users with pagination
   * @param IPaginationOptions - The pagination parameters
   * @returns An array of users and the total count
   *
   */
  getUsers(): Promise<User[]> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'rolePermission')
      .leftJoinAndSelect('user.permissions', 'permission');

    return query.getMany();
  }

  /**
   * Find a user by id
   * @param cityId - The id of the user to find
   * @returns The found user
   *
   */
  async getUserByUserId(userId: number): Promise<User> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.userId = :userId', { userId })
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'rolePermission')
      .leftJoinAndSelect('user.permissions', 'permission');

    const user = await query.getOne();

    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }

  /**
   * Find a user by email
   * @param email - The email of the user to find
   * @returns The found user | null
   *
   */
  getUserByEmail(email: string): Promise<Nullable<User>> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'rolePermission')
      .leftJoinAndSelect('user.permissions', 'permission');

    return query.getOne();
  }

  /**
   * Find a user by email for log in
   * @param email - The email of the user to find
   * @returns The found user | null
   *
   */
  getUserByEmailForLogIn(email: string): Promise<Nullable<LoginUser>> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'rolePermission')
      .leftJoinAndSelect('user.permissions', 'permission');

    query.addSelect('user.password');

    return query.getOne();
  }

  /**
   * Update a user
   * @param userId - The id of the user to update
   * @param UserRolesAndPermisssionsDto - The data to update the user
   * @returns The updated user
   * @throws NotFoundException if the city/user is not found
   *
   */
  async updateUserRolesAndPermissions(
    userId: number,
    dto: UserRolesAndPermisssionsDto,
  ) {
    const user = await this.userRepository.findOne({ where: { userId } });

    if (!user) {
      throw new NotFoundException();
    }

    const { roles, permissions } = dto;

    user.roles = roles ?? user.roles;
    user.permissions = permissions ?? user.permissions;

    return await this.userRepository.save(user);
  }

  /**
   * Update a user
   * @param email - The email of the user to update
   * @param UpdateProfileDto - The data to update the user
   * @returns The updated user
   * @throws NotFoundException if the city/user is not found
   *
   */
  async patchUserProfile(email: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException();
    }

    if (dto.language) user.language = dto.language;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.dateOfBirth !== undefined) {
      user.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }

    user.updatedAt = new Date();

    try {
      await this.userRepository.save(user);
    } catch (e) {
      if (e?.code === '23505') {
        throw new ConflictException('Phone number is already used');
      }
      throw e;
    }

    return this.getUserByEmail(email);
  }

  /**
   * Create the user that accepted an invitation
   * @returns The created user without password
   */
  async createInvitedUser(
    email: string,
    dto: { firstName: string; lastName: string; password: string },
    companyId: number,
  ): Promise<User> {
    return this.createUser(
      { email, ...dto },
      { roles: [ClientRoleEnums.USER], companyId },
    );
  }

  getUsersByCompany(companyId: number): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.companyId = :companyId', { companyId })
      .leftJoinAndSelect('user.roles', 'role')
      .orderBy('user.firstName', 'ASC')
      .getMany();
  }

  /**
   * A page of the users of a company sorted by first name,
   * searched by first name, last name or email
   */
  async getUsersPageByCompany(companyId: number, query: PaginationQueryDto) {
    const pattern = toLikePattern(query.search);
    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('user.companyId = :companyId', { companyId })
      .leftJoinAndSelect('user.roles', 'role')
      .orderBy('user.firstName', 'ASC')
      .addOrderBy('user.userId', 'ASC');

    if (pattern) {
      qb.andWhere(
        "(user.firstName ILIKE :pattern OR user.lastName ILIKE :pattern OR user.email ILIKE :pattern OR CONCAT(user.firstName, ' ', user.lastName) ILIKE :pattern)",
        { pattern },
      );
    }

    return paginate(qb, query);
  }

  /**
   * Attach every user without a company to the given one (single company era)
   */
  async assignCompanyToUsersWithout(companyId: number) {
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ companyId })
      .where('company_id IS NULL')
      .execute();
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  /**
   * Create a new user
   * @param RegisterUserDto - The data to create a new user
   * @param RegisterUserOptionsDto - The optional addition data for more details
   * @returns The created user without password
   * @throws NotFoundException if the city is not found
   *
   */
  async createUser(
    dto: RegisterUserDto,
    options?: RegisterUserOptionsDto,
  ): Promise<User> {
    const { email, password, firstName, lastName, phone } = dto;

    const salt = await bcrypt.genSalt();
    const hashedPassword =
      password !== null ? await bcrypt.hash(password, salt) : null;
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber: phone,
      companyId: options?.companyId ?? null,
    });

    if (options?.roles) {
      const roles: Role[] = [];

      for (const role of options.roles) {
        const foundRole = await this.roleRepository.findOne({
          where: { name: role },
        });

        roles.push(foundRole);
      }

      user.roles = roles;
    }

    const newUser = await this.userRepository.save(user);

    delete (newUser as Partial<User>).password;

    return newUser;
  }
}

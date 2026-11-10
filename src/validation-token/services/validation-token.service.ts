import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValidationToken } from '@/validation-token/entities/validation-token.entity';
import { CreateValidationToken } from '@/validation-token/dto';
import { ValidationTokenTypeEnums } from '@/validation-token/enums/VerificationTokenType';

@Injectable()
export class ValidationTokenService {
  constructor(
    @InjectRepository(ValidationToken)
    private readonly validationRepository: Repository<ValidationToken>,
  ) {}

  /**
   * Create a new token
   * @param CreateValidationToken - The data to create a new token
   * @returns The created token
   * @throws NotFoundException if the city is not found
   *
   */
  async createValidationToken(createValidationToken: CreateValidationToken) {
    const expirationDate = new Date().getTime() + 180 * 60 * 1000;

    const token = this.validationRepository.create({
      ...createValidationToken,
      expirationDate,
    });

    return this.validationRepository.save(token);
  }

  /**
   * Find all tokenks with pagination
   * @returns An array of tokenks and the total count
   *
   */
  getValidationTokens() {
    return this.validationRepository.find();
  }

  /**
   * Find a token by id
   * @param validationTokenId - The id of the token to find
   * @returns The found token | null
   *
   */
  async getValidationTokenById(validationTokenId: number) {
    return this.validationRepository.findOne({ where: { validationTokenId } });
  }

  /**
   * Find a refresh token by id
   * @param email - The email of the refresh token to find
   * @returns The found refresh token | null
   *
   */
  getRefreshTokenByEmail(email: string) {
    return this.validationRepository.findOne({
      where: { email, validationTokenType: ValidationTokenTypeEnums.REFRESH },
    });
  }

  /**
   * Remove a validationTokenId by slug
   * @param validationTokenId - The id of the token to remove
   * @returns The found token
   * @throws NotFoundException if the token is not found
   *
   */
  async removeValidationTokenById(validationTokenId: number) {
    const token = await this.validationRepository.findOne({
      where: { validationTokenId },
    });

    if (!token) {
      throw new NotFoundException();
    }

    return this.validationRepository.remove(token);
  }

  /**
   * Remove a refresh token by email
   * @param email - The email of the refresh token to find
   * @returns The founds token
   * @throws NotFoundException if the token is not found
   *
   */
  async removeRefreshTokenByEmail(email: string) {
    const tokens = await this.validationRepository.findBy({
      email,
      validationTokenType: ValidationTokenTypeEnums.REFRESH,
    });

    if (!tokens) {
      throw new NotFoundException();
    }

    return this.validationRepository.remove(tokens);
  }
}

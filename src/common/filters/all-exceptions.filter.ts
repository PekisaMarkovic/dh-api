import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

export type ApiErrorBody = {
  statusCode: number;
  error: string;
  /** One readable sentence the dashboard can show as is */
  message: string;
  /** Every single problem, filled for validation errors (one entry per field) */
  errors?: string[];
  path: string;
  timestamp: string;
};

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';
const PG_INVALID_TEXT = '22P02';

/**
 * Turns every thrown error into the same json body, so the dashboard
 * can always read `message` (and `errors`) and show what is wrong.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errors } = this.normalize(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorBody = {
      statusCode,
      error: STATUS_TEXT[statusCode] ?? 'Error',
      message,
      ...(errors?.length ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private normalize(exception: unknown): {
    statusCode: number;
    message: string;
    errors?: string[];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();
      const raw =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ??
            exception.message);

      if (Array.isArray(raw)) {
        return { statusCode, message: raw.join('. '), errors: raw };
      }

      return { statusCode, message: raw };
    }

    if (exception instanceof QueryFailedError) {
      return this.normalizeDatabaseError(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong on our side. Please try again later.',
    };
  }

  private normalizeDatabaseError(error: QueryFailedError) {
    const driverError = error.driverError as {
      code?: string;
      detail?: string;
      column?: string;
    };

    switch (driverError?.code) {
      case PG_UNIQUE_VIOLATION: {
        // detail looks like: Key (email)=(a@b.c) already exists.
        const field = driverError.detail?.match(/\(([^)]+)\)=/)?.[1];

        return {
          statusCode: HttpStatus.CONFLICT,
          message: field
            ? `A record with this ${field} already exists.`
            : 'This record already exists.',
        };
      }
      case PG_FOREIGN_KEY_VIOLATION:
        return {
          statusCode: HttpStatus.CONFLICT,
          message:
            'This record is connected to other data, or the connected record does not exist.',
        };
      case PG_NOT_NULL_VIOLATION:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: driverError.column
            ? `${driverError.column} is required.`
            : 'A required value is missing.',
        };
      case PG_INVALID_TEXT:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'One of the sent values has a wrong format.',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong on our side. Please try again later.',
        };
    }
  }
}

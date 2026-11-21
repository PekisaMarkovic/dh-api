import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let status: jest.Mock;
  let json: jest.Mock;

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/api/drinks' }),
    }),
  } as unknown as ArgumentsHost;

  const bodyOf = () => json.mock.calls[0][0];

  const databaseError = (driverError: object) =>
    new QueryFailedError('INSERT ...', [], driverError as Error);

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    filter = new AllExceptionsFilter();
  });

  describe('errors of http', () => {
    it('should answer with the status, the message and the path of the request', () => {
      filter.catch(new NotFoundException('Drink not found'), host);

      expect(status).toHaveBeenCalledWith(404);
      expect(bodyOf()).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Drink not found',
        path: '/api/drinks',
        timestamp: expect.any(String),
      });
    });

    it('should write the time as an ISO date', () => {
      filter.catch(new NotFoundException(), host);

      expect(new Date(bodyOf().timestamp).toISOString()).toBe(
        bodyOf().timestamp,
      );
    });

    it('should join the messages of a validation error into one sentence and list every problem', () => {
      filter.catch(
        new BadRequestException([
          'name must be a string',
          'price must be a number',
        ]),
        host,
      );

      expect(bodyOf().message).toBe(
        'name must be a string. price must be a number',
      );
      expect(bodyOf().errors).toEqual([
        'name must be a string',
        'price must be a number',
      ]);
    });

    it('should not return the list of errors when there is only a message', () => {
      filter.catch(
        new ConflictException('A drink with this article code already exists.'),
        host,
      );

      expect(bodyOf()).not.toHaveProperty('errors');
    });

    it('should read an error that was thrown with a plain text', () => {
      filter.catch(
        new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
        host,
      );

      expect(bodyOf()).toEqual(
        expect.objectContaining({
          statusCode: 429,
          message: 'Too many requests',
          error: 'Error',
        }),
      );
    });

    it('should not log it, only the errors of the server are logged', () => {
      filter.catch(new NotFoundException(), host);

      expect(Logger.prototype.error).not.toHaveBeenCalled();
    });
  });

  describe('errors that are not expected', () => {
    it('should answer 500 with a general message and not show what went wrong inside', () => {
      filter.catch(new Error('password for user "postgres" failed'), host);

      expect(status).toHaveBeenCalledWith(500);
      expect(bodyOf().message).toBe(
        'Something went wrong on our side. Please try again later.',
      );
      expect(JSON.stringify(bodyOf())).not.toContain('postgres');
    });

    it('should log the error with the request, so it can be found', () => {
      filter.catch(new Error('boom'), host);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'POST /api/drinks',
        expect.stringContaining('boom'),
      );
    });

    it('should handle a thing that was thrown that is not an error', () => {
      filter.catch('just a text', host);

      expect(status).toHaveBeenCalledWith(500);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'POST /api/drinks',
        'just a text',
      );
    });
  });

  describe('errors of the database', () => {
    it('should say which field is taken when a unique value is used twice', () => {
      filter.catch(
        databaseError({
          code: '23505',
          detail: 'Key (email)=(ana@drinkhouse.rs) already exists.',
        }),
        host,
      );

      expect(status).toHaveBeenCalledWith(409);
      expect(bodyOf().message).toBe('A record with this email already exists.');
    });

    it('should still answer 409 when the field is not known', () => {
      filter.catch(databaseError({ code: '23505' }), host);

      expect(bodyOf().message).toBe('This record already exists.');
    });

    it('should answer 409 when a record is connected to other data', () => {
      filter.catch(databaseError({ code: '23503' }), host);

      expect(status).toHaveBeenCalledWith(409);
      expect(bodyOf().message).toContain('connected to other data');
    });

    it('should name the column of a value that is missing', () => {
      filter.catch(databaseError({ code: '23502', column: 'name' }), host);

      expect(status).toHaveBeenCalledWith(400);
      expect(bodyOf().message).toBe('name is required.');
    });

    it('should say a value is missing when the column is not known', () => {
      filter.catch(databaseError({ code: '23502' }), host);

      expect(bodyOf().message).toBe('A required value is missing.');
    });

    it('should answer 400 for a value in a wrong format', () => {
      filter.catch(databaseError({ code: '22P02' }), host);

      expect(status).toHaveBeenCalledWith(400);
      expect(bodyOf().message).toBe(
        'One of the sent values has a wrong format.',
      );
    });

    it('should answer 500 for any other error of the database, without its text', () => {
      filter.catch(
        databaseError({
          code: '42P01',
          detail: 'relation "secret" does not exist',
        }),
        host,
      );

      expect(status).toHaveBeenCalledWith(500);
      expect(JSON.stringify(bodyOf())).not.toContain('secret');
    });
  });
});

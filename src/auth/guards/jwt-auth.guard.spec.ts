import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '@/auth/decorators';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

class FakeController {
  @Public()
  open() {}

  closed() {}
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(new Reflector());
  // the check of the token itself is done by passport
  const passportCanActivate = jest.spyOn(
    AuthGuard('jwt').prototype,
    'canActivate',
  );

  const contextOf = (handler: (...args: never[]) => void) =>
    ({
      getHandler: () => handler,
      getClass: () => FakeController,
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    passportCanActivate.mockReset().mockReturnValue(true);
  });

  it('should let in a request to a public route without a token', () => {
    expect(guard.canActivate(contextOf(FakeController.prototype.open))).toBe(
      true,
    );
    expect(passportCanActivate).not.toHaveBeenCalled();
  });

  it('should ask passport to check the token for any other route', () => {
    const context = contextOf(FakeController.prototype.closed);

    guard.canActivate(context);

    expect(passportCanActivate).toHaveBeenCalledWith(context);
  });

  it('should keep out the request when passport does not accept the token', () => {
    passportCanActivate.mockReturnValue(false);

    expect(guard.canActivate(contextOf(FakeController.prototype.closed))).toBe(
      false,
    );
  });
});

import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { AdminLoginRateLimitService } from './admin-login-rate-limit.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const authService = {
    validateAdmin: jest.fn(),
    getAdminMe: jest.fn(),
  } as unknown as AuthService;

  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const rateLimitService = {
    checkOrThrow: jest.fn(),
    recordFailure: jest.fn(),
    resetAccountIp: jest.fn(),
  } as unknown as AdminLoginRateLimitService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(configService.get).mockReturnValue('admin_session');
    jest.mocked(rateLimitService.checkOrThrow).mockResolvedValue(undefined);
    jest.mocked(rateLimitService.recordFailure).mockResolvedValue(undefined);
    jest.mocked(rateLimitService.resetAccountIp).mockResolvedValue(undefined);
  });

  it('keeps returning 401 before the login rate limit is exceeded', async () => {
    const controller = createController();
    jest.mocked(authService.validateAdmin).mockRejectedValue(
      new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      }),
    );

    await expect(
      controller.login({ loginId: 'admin', password: 'wrong-password' }, createRequest()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(rateLimitService.checkOrThrow).toHaveBeenCalledWith('admin', '127.0.0.1');
    expect(rateLimitService.recordFailure).toHaveBeenCalledWith('admin', '127.0.0.1');
    expect(rateLimitService.resetAccountIp).not.toHaveBeenCalled();
  });

  it('returns 429 without validating credentials after the login rate limit is exceeded', async () => {
    const controller = createController();
    jest.mocked(rateLimitService.checkOrThrow).mockRejectedValue(
      new HttpException(
        {
          code: 'TOO_MANY_LOGIN_ATTEMPTS',
          message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    await expect(
      controller.login({ loginId: 'admin', password: 'wrong-password' }, createRequest()),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

    expect(authService.validateAdmin).not.toHaveBeenCalled();
    expect(rateLimitService.recordFailure).not.toHaveBeenCalled();
    expect(rateLimitService.resetAccountIp).not.toHaveBeenCalled();
  });

  it('resets the loginId and IP counter after successful login', async () => {
    const controller = createController();
    jest.mocked(authService.validateAdmin).mockResolvedValue({
      id: BigInt(1),
      loginId: 'admin',
      passwordHash: 'hashed-password',
      name: '관리자',
      role: 'SUPER',
      isActive: true,
    });

    const response = await controller.login(
      { loginId: 'admin', password: 'correct-password' },
      createRequest(),
    );

    expect(rateLimitService.resetAccountIp).toHaveBeenCalledWith('admin', '127.0.0.1');
    expect(response.data.admin.loginId).toBe('admin');
  });

  function createController(): AuthController {
    return new AuthController(authService, configService, rateLimitService);
  }

  function createRequest(): Request {
    return {
      ip: '127.0.0.1',
      socket: {
        remoteAddress: '127.0.0.1',
      },
      session: {
        save: jest.fn((callback: (error?: Error) => void) => callback()),
      },
    } as unknown as Request;
  }
});

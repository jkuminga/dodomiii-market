import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  assertPrimaryDepositAccountInput,
  normalizeOptional,
} from './domain/admin-account-rules';
import type { AdminAccountResponse } from './admin.types';
import { CreateAdminAccountDto } from './dto/create-admin-account.dto';
import { UpdateAdminAccountDto } from './dto/update-admin-account.dto';

const adminAccountSelect = Prisma.validator<Prisma.AdminSelect>()({
  id: true,
  loginId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  depositBankName: true,
  depositAccountHolder: true,
  depositAccountNumber: true,
  isPrimaryDepositAccount: true,
  createdAt: true,
  updatedAt: true,
});

type AdminAccountRecord = Prisma.AdminGetPayload<{ select: typeof adminAccountSelect }>;

@Injectable()
export class AdminAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccounts(): Promise<{ items: AdminAccountResponse[] }> {
    const admins = await this.prisma.admin.findMany({
      select: adminAccountSelect,
      orderBy: [
        {
          role: 'asc',
        },
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });

    return {
      items: admins.map((admin) => this.mapAdminAccount(admin)),
    };
  }

  async createAccount(dto: CreateAdminAccountDto): Promise<AdminAccountResponse> {
    const loginId = dto.loginId.trim();
    const name = dto.name.trim();
    const email = normalizeOptional(dto.email);
    const phone = normalizeOptional(dto.phone);
    const depositBankName = normalizeOptional(dto.depositBankName);
    const depositAccountHolder = normalizeOptional(dto.depositAccountHolder);
    const depositAccountNumber = normalizeOptional(dto.depositAccountNumber);
    const isPrimaryDepositAccount = dto.isPrimaryDepositAccount ?? false;

    if (!loginId || !name) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '아이디와 이름은 공백일 수 없습니다.',
      });
    }

    assertPrimaryDepositAccountInput({
      isPrimaryDepositAccount,
      depositBankName: depositBankName ?? null,
      depositAccountHolder: depositAccountHolder ?? null,
      depositAccountNumber: depositAccountNumber ?? null,
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (isPrimaryDepositAccount) {
          await tx.admin.updateMany({
            where: { isPrimaryDepositAccount: true },
            data: { isPrimaryDepositAccount: false },
          });
        }

        return tx.admin.create({
          data: {
            loginId,
            passwordHash: await hash(dto.password, 10),
            name,
            email: email ?? null,
            phone: phone ?? null,
            role: dto.role ?? AdminRole.STAFF,
            isActive: dto.isActive ?? true,
            depositBankName: depositBankName ?? null,
            depositAccountHolder: depositAccountHolder ?? null,
            depositAccountNumber: depositAccountNumber ?? null,
            isPrimaryDepositAccount,
          },
          select: adminAccountSelect,
        });
      });

      return this.mapAdminAccount(created);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateAccount(
    accountId: number,
    actorAdminId: number,
    dto: UpdateAdminAccountDto,
  ): Promise<AdminAccountResponse> {
    const targetId = BigInt(accountId);
    const normalizedLoginId = dto.loginId?.trim();
    const normalizedName = dto.name?.trim();
    const email = normalizeOptional(dto.email);
    const phone = normalizeOptional(dto.phone);
    const depositBankName = normalizeOptional(dto.depositBankName);
    const depositAccountHolder = normalizeOptional(dto.depositAccountHolder);
    const depositAccountNumber = normalizeOptional(dto.depositAccountNumber);

    if (normalizedLoginId !== undefined && !normalizedLoginId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '아이디는 공백일 수 없습니다.',
      });
    }

    if (normalizedName !== undefined && !normalizedName) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '이름은 공백일 수 없습니다.',
      });
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.admin.findUnique({
          where: { id: targetId },
          select: adminAccountSelect,
        });

        if (!existing) {
          throw new NotFoundException({
            code: 'ADMIN_ACCOUNT_NOT_FOUND',
            message: '관리자 계정을 찾을 수 없습니다.',
          });
        }

        const nextRole = dto.role ?? existing.role;
        const nextIsActive = dto.isActive ?? existing.isActive;
        const nextDepositBankName = depositBankName !== undefined ? depositBankName : existing.depositBankName;
        const nextDepositAccountHolder =
          depositAccountHolder !== undefined ? depositAccountHolder : existing.depositAccountHolder;
        const nextDepositAccountNumber =
          depositAccountNumber !== undefined ? depositAccountNumber : existing.depositAccountNumber;
        const nextIsPrimaryDepositAccount =
          dto.isPrimaryDepositAccount !== undefined
            ? dto.isPrimaryDepositAccount
            : existing.isPrimaryDepositAccount;

        if (
          Number(existing.id) === actorAdminId &&
          (nextRole !== AdminRole.SUPER || !nextIsActive)
        ) {
          throw new BadRequestException({
            code: 'ADMIN_SELF_UPDATE_FORBIDDEN',
            message: '본인 계정을 staff로 변경하거나 비활성화할 수 없습니다.',
          });
        }

        await this.assertSuperRoleInvariant(tx, existing.id, {
          nextRole,
          nextIsActive,
        });

        assertPrimaryDepositAccountInput({
          isPrimaryDepositAccount: nextIsPrimaryDepositAccount,
          depositBankName: nextDepositBankName,
          depositAccountHolder: nextDepositAccountHolder,
          depositAccountNumber: nextDepositAccountNumber,
        });

        if (
          existing.isPrimaryDepositAccount &&
          dto.isActive === false
        ) {
          throw new BadRequestException({
            code: 'PRIMARY_DEPOSIT_ACCOUNT_DEACTIVATE_FORBIDDEN',
            message: '대표 입금계좌 계정을 비활성화하기 전에 다른 계정을 대표로 지정해주세요.',
          });
        }

        if (nextIsPrimaryDepositAccount) {
          await tx.admin.updateMany({
            where: {
              id: {
                not: existing.id,
              },
              isPrimaryDepositAccount: true,
            },
            data: { isPrimaryDepositAccount: false },
          });
        }

        return tx.admin.update({
          where: { id: existing.id },
          data: {
            loginId: normalizedLoginId,
            passwordHash: dto.password ? await hash(dto.password, 10) : undefined,
            name: normalizedName,
            email,
            phone,
            role: dto.role,
            isActive: dto.isActive,
            depositBankName,
            depositAccountHolder,
            depositAccountNumber,
            isPrimaryDepositAccount: dto.isPrimaryDepositAccount,
          },
          select: adminAccountSelect,
        });
      });

      return this.mapAdminAccount(updated);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async deleteAccount(accountId: number, actorAdminId: number): Promise<{ deleted: boolean }> {
    if (accountId === actorAdminId) {
      throw new BadRequestException({
        code: 'ADMIN_SELF_DELETE_FORBIDDEN',
        message: '본인 계정은 삭제할 수 없습니다.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.admin.findUnique({
        where: { id: BigInt(accountId) },
        select: {
          id: true,
          role: true,
          isActive: true,
          isPrimaryDepositAccount: true,
        },
      });

      if (!existing) {
        throw new NotFoundException({
          code: 'ADMIN_ACCOUNT_NOT_FOUND',
          message: '관리자 계정을 찾을 수 없습니다.',
        });
      }

      if (existing.isPrimaryDepositAccount) {
        throw new BadRequestException({
          code: 'PRIMARY_DEPOSIT_ACCOUNT_DELETE_FORBIDDEN',
          message: '대표 입금계좌 계정은 삭제 전에 다른 계정을 대표로 지정해야 합니다.',
        });
      }

      await this.assertSuperRoleInvariant(tx, existing.id, {
        nextRole: existing.role === AdminRole.SUPER ? AdminRole.STAFF : existing.role,
        nextIsActive: existing.isActive,
      });

      await tx.admin.delete({
        where: { id: existing.id },
      });
    });

    return { deleted: true };
  }

  private async assertSuperRoleInvariant(
    tx: Prisma.TransactionClient,
    currentAdminId: bigint,
    next: {
      nextRole: AdminRole;
      nextIsActive: boolean;
    },
  ) {
    const current = await tx.admin.findUnique({
      where: { id: currentAdminId },
      select: {
        role: true,
        isActive: true,
      },
    });

    if (!current) {
      return;
    }

    const currentIsActiveSuper = current.role === AdminRole.SUPER && current.isActive;
    const nextIsActiveSuper = next.nextRole === AdminRole.SUPER && next.nextIsActive;

    if (currentIsActiveSuper && !nextIsActiveSuper) {
      const activeSuperCount = await tx.admin.count({
        where: {
          role: AdminRole.SUPER,
          isActive: true,
        },
      });

      if (activeSuperCount <= 1) {
        throw new BadRequestException({
          code: 'LAST_SUPER_ADMIN_FORBIDDEN',
          message: '활성화된 SUPER 관리자 계정은 최소 1개 이상 유지되어야 합니다.',
        });
      }
    }
  }

  private mapAdminAccount(admin: AdminAccountRecord): AdminAccountResponse {
    return {
      adminId: Number(admin.id),
      loginId: admin.loginId,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      isActive: admin.isActive,
      depositBankName: admin.depositBankName,
      depositAccountHolder: admin.depositAccountHolder,
      depositAccountNumber: admin.depositAccountNumber,
      isPrimaryDepositAccount: admin.isPrimaryDepositAccount,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };
  }

  private handleWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: 'ADMIN_ACCOUNT_CONFLICT',
        message: '이미 사용 중인 관리자 아이디입니다.',
      });
    }

    throw error;
  }
}

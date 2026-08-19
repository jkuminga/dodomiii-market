import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';

import { AdminOrdersService } from './admin-orders.service';

describe('AdminOrdersService', () => {
  it('deletes an order and returns the deleted order key values', async () => {
    const deleteOrder = jest
      .fn<(input: unknown) => Promise<{ id: bigint; orderNumber: string }>>()
      .mockResolvedValue({
        id: BigInt(27),
        orderNumber: 'D20260819-0027',
      });
    const prisma = {
      order: {
        delete: deleteOrder,
      },
    };
    const service = new AdminOrdersService(prisma as never, {} as never);

    await expect(service.deleteOrder(27)).resolves.toEqual({
      deleted: true,
      orderId: 27,
      orderNumber: 'D20260819-0027',
    });
    expect(deleteOrder).toHaveBeenCalledWith({
      where: {
        id: BigInt(27),
      },
      select: {
        id: true,
        orderNumber: true,
      },
    });
  });

  it('returns ORDER_NOT_FOUND when the order does not exist', async () => {
    const prisma = {
      order: {
        delete: jest.fn<(input: unknown) => Promise<never>>().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Record to delete does not exist.', {
            code: 'P2025',
            clientVersion: '6.11.1',
          }),
        ),
      },
    };
    const service = new AdminOrdersService(prisma as never, {} as never);

    try {
      await service.deleteOrder(99999);
      throw new Error('Expected deleteOrder to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual({
        code: 'ORDER_NOT_FOUND',
        message: '주문을 찾을 수 없습니다.',
      });
    }
  });
});

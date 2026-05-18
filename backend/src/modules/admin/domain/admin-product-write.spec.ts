import { ProductOptionSelectionType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import { normalizeProductImages, normalizeProductOptionGroups } from './admin-product-write';

describe('admin product write rules', () => {
  it('normalizes image sort order while preserving explicit order', () => {
    expect(
      normalizeProductImages([
        {
        imageUrl: 'https://cdn.example.test/thumb-b.jpg',
        },
        {
        imageUrl: 'https://cdn.example.test/thumb-a.jpg',
          sortOrder: 10,
        },
      ]),
    ).toEqual([
      {
        imageUrl: 'https://cdn.example.test/thumb-b.jpg',
        sortOrder: 0,
      },
      {
        imageUrl: 'https://cdn.example.test/thumb-a.jpg',
        sortOrder: 10,
      },
    ]);
  });

  it('normalizes option group and option defaults', () => {
    expect(
      normalizeProductOptionGroups([
        {
          name: '포장',
          selectionType: ProductOptionSelectionType.SINGLE,
          options: [
            {
              name: '기본',
            },
            {
              name: '선물',
              extraPrice: 3000,
              maxQuantity: 2,
              isActive: false,
              sortOrder: 8,
            },
          ],
        },
      ]),
    ).toEqual([
      {
        name: '포장',
        selectionType: ProductOptionSelectionType.SINGLE,
        isRequired: false,
        isActive: true,
        sortOrder: 0,
        options: [
          {
            name: '기본',
            extraPrice: 0,
            maxQuantity: null,
            isActive: true,
            sortOrder: 0,
          },
          {
            name: '선물',
            extraPrice: 3000,
            maxQuantity: 2,
            isActive: false,
            sortOrder: 8,
          },
        ],
      },
    ]);
  });
});

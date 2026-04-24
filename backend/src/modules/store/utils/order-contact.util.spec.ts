import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { normalizeOrderContactAddress } from './order-contact.util';

describe('normalizeOrderContactAddress', () => {
  it('keeps a plain address1 and trims address2', () => {
    const result = normalizeOrderContactAddress({
      address1: '서울 성동구 성수이로 1',
      address2: '  101동 1001호  ',
    });

    expect(result).toEqual({
      address1: '서울 성동구 성수이로 1',
      address2: '101동 1001호',
    });
  });

  it('maps address1=R to roadAddress', () => {
    const result = normalizeOrderContactAddress({
      address1: 'R',
      roadAddress: '경기 성남시 분당구 판교역로 166',
      jibunAddress: '경기 성남시 분당구 백현동 532',
      address2: '카카오 판교 아지트',
    });

    expect(result).toEqual({
      address1: '경기 성남시 분당구 판교역로 166',
      address2: '카카오 판교 아지트',
    });
  });

  it('maps address1=J to jibunAddress', () => {
    const result = normalizeOrderContactAddress({
      address1: 'J',
      roadAddress: '경기 성남시 분당구 판교역로 166',
      jibunAddress: '경기 성남시 분당구 백현동 532',
    });

    expect(result).toEqual({
      address1: '경기 성남시 분당구 백현동 532',
      address2: null,
    });
  });

  it('uses userSelectedType when present', () => {
    const result = normalizeOrderContactAddress({
      address1: '임시값',
      userSelectedType: 'R',
      roadAddress: '서울 종로구 세종대로 175',
      jibunAddress: '서울 종로구 세종로 1-68',
    });

    expect(result).toEqual({
      address1: '서울 종로구 세종대로 175',
      address2: null,
    });
  });

  it('throws when selected type is R without roadAddress', () => {
    expect(() =>
      normalizeOrderContactAddress({
        address1: 'R',
      }),
    ).toThrow(BadRequestException);
  });
});

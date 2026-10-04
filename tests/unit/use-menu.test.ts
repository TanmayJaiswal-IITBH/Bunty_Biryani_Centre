import { describe, expect, it } from 'vitest';
import { menuSwrOptions } from '../../src/client/features/customer/menu/use-menu';

describe('menuSwrOptions', () => {
  it("has no onSuccess key without a callback (undefined would override SWR's default noop)", () => {
    const options = menuSwrOptions();
    expect('onSuccess' in options).toBe(false);
    expect(options).toMatchObject({
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    });
  });

  it('passes the callback through as onSuccess', () => {
    const onFresh = () => undefined;
    expect(menuSwrOptions(onFresh).onSuccess).toBe(onFresh);
  });
});

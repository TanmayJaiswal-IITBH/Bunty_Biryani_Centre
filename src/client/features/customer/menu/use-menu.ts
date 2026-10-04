import type { PublicMenu } from '@shared/api-types.js';
import useSWR, { type SWRResponse } from 'swr';
import type { ApiError } from '../../../lib/api';

export const MENU_KEY = '/api/menu';

/**
 * Today's menu from the server. Call it once per page: SWR's `onSuccess` only fires for the hook
 * instance that started the request, so children should receive the data as props. `onFresh`
 * runs after every successful fetch (the cart reconciles against it).
 */
export function useMenu(onFresh?: (menu: PublicMenu) => void): SWRResponse<PublicMenu, ApiError> {
  return useSWR<PublicMenu, ApiError>(MENU_KEY, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 5_000,
    keepPreviousData: true,
    onSuccess: onFresh,
  });
}

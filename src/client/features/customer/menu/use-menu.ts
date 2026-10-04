import type { PublicMenu } from '@shared/api-types.js';
import useSWR, { type SWRConfiguration, type SWRResponse } from 'swr';
import type { ApiError } from '../../../lib/api';

export const MENU_KEY = '/api/menu';

/**
 * SWR merges configs by object spread, so an `onSuccess: undefined` key would override SWR's
 * default no-op and make every successful fetch throw. Only set `onSuccess` when there is one.
 */
export function menuSwrOptions(
  onFresh?: (menu: PublicMenu) => void,
): SWRConfiguration<PublicMenu, ApiError> {
  return {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 5_000,
    keepPreviousData: true,
    ...(onFresh ? { onSuccess: onFresh } : {}),
  };
}

/**
 * Today's menu from the server. Call it once per page: SWR's `onSuccess` only fires for the hook
 * instance that started the request, so children should receive the data as props. `onFresh`
 * (optional) runs after every successful fetch (the cart reconciles against it).
 */
export function useMenu(onFresh?: (menu: PublicMenu) => void): SWRResponse<PublicMenu, ApiError> {
  return useSWR<PublicMenu, ApiError>(MENU_KEY, menuSwrOptions(onFresh));
}

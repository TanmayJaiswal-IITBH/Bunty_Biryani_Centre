import type { DeliveryOptions } from '@shared/api-types.js';
import useSWR, { type SWRConfiguration, type SWRResponse } from 'swr';
import { api, type ApiError } from '../../../lib/api';

export const DELIVERY_OPTIONS_KEY = '/api/delivery-options';

/** `receivedAt` is `performance.now()` on arrival: the base for the cutoff countdown (§5.4). */
export type LoadedDeliveryOptions = DeliveryOptions & { receivedAt: number };

export async function fetchDeliveryOptions(path: string): Promise<LoadedDeliveryOptions> {
  const options = await api<DeliveryOptions>(path);
  return { ...options, receivedAt: performance.now() };
}

export function deliveryOptionsSwrOptions(
  refreshInterval: number,
): SWRConfiguration<LoadedDeliveryOptions, ApiError> {
  return {
    refreshInterval,
    revalidateOnFocus: true,
    dedupingInterval: 5_000,
    keepPreviousData: true,
  };
}

/** Delivery options from the server, polled every `refreshInterval` ms. */
export function useDeliveryOptions(
  refreshInterval: number,
): SWRResponse<LoadedDeliveryOptions, ApiError> {
  return useSWR<LoadedDeliveryOptions, ApiError>(
    DELIVERY_OPTIONS_KEY,
    fetchDeliveryOptions,
    deliveryOptionsSwrOptions(refreshInterval),
  );
}

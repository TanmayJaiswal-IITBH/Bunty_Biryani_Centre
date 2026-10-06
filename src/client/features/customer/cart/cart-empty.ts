/** Router state checkout sets when it redirects an empty cart back to the menu (§5.2). */
export const CART_EMPTY_STATE = { notice: 'cartEmpty' } as const;

export function isCartEmptyState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'notice' in state &&
    state.notice === CART_EMPTY_STATE.notice
  );
}

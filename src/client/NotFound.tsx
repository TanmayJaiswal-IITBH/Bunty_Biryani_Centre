import { BackToMenuLink } from './components/BackToMenuLink';
import { EmptyState } from './components/EmptyState';
import { copy } from './copy';

export function NotFound() {
  return (
    <EmptyState
      title={copy.common.notFoundTitle}
      message={copy.common.notFoundMessage}
      icon="map-pin"
      action={<BackToMenuLink />}
    />
  );
}

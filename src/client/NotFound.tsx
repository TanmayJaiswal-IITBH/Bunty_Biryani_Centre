import { Link } from 'react-router';
import { EmptyState } from './components/EmptyState';
import { copy } from './copy';

export function NotFound() {
  return (
    <EmptyState
      title={copy.common.notFoundTitle}
      message={copy.common.notFoundMessage}
      icon="map-pin"
      action={
        <Link to="/" className="font-semibold text-brand underline underline-offset-2">
          {copy.common.backToMenu}
        </Link>
      }
    />
  );
}

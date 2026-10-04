import { Link } from 'react-router';
import logo192 from '../assets/logo-192.webp';
import logo96 from '../assets/logo-96.webp';
import { copy } from '../copy';

/** Sun-yellow band with the logo and brand name, used by customer pages. */
export function AppHeader() {
  return (
    <header className="bg-sun">
      <div className="mx-auto flex max-w-120 items-center gap-3 px-4 py-2">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logo96}
            srcSet={`${logo96} 96w, ${logo192} 192w`}
            sizes="48px"
            width={48}
            height={48}
            alt={copy.brand}
            className="size-12 rounded-control"
          />
          <span className="display text-lg leading-tight">{copy.brand}</span>
        </Link>
      </div>
    </header>
  );
}

import { Link } from 'react-router';
import { copy } from '../copy';

/** "Back to the menu" as a 48 px tap target, for empty and error states. */
export function BackToMenuLink() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-12 items-center px-2 font-semibold text-brand underline underline-offset-2"
    >
      {copy.common.backToMenu}
    </Link>
  );
}

import type { AdminSession } from '@shared/api-types.js';
import { useRef, useState, type SyntheticEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useSWRConfig } from 'swr';
import logo192 from '../../../assets/logo-192.webp';
import logo96 from '../../../assets/logo-96.webp';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { TextField } from '../../../components/TextField';
import { copy } from '../../../copy';
import { ApiError, api } from '../../../lib/api';
import { ADMIN_SESSION_KEY, safeNext, useAdminSession } from './useAdminSession';

const t = copy.admin.login;

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'RATE_LIMITED') return t.rateLimited;
    if (error.code === 'NETWORK_ERROR') return t.network;
    // A malformed username is answered like a wrong one: the form never explains which part is off.
    if (error.code === 'INVALID_CREDENTIALS' || error.code === 'VALIDATION_ERROR') {
      return t.invalidCredentials;
    }
  }
  return copy.common.genericError;
}

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const session = useAdminSession();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const bannerRef = useRef<HTMLDivElement>(null);

  // Already logged in.
  if (session.data) return <Navigate to={next} replace />;

  const showError = (message: string) => {
    setFormError(message);
    // Move focus to the banner once it has rendered.
    requestAnimationFrame(() => bannerRef.current?.focus());
  };

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) errors.username = t.usernameRequired;
    if (!password) errors.password = t.passwordRequired;
    setFieldErrors(errors);
    setFormError(null);
    if (errors.username || errors.password) return;

    setSubmitting(true);
    try {
      const result = await api<AdminSession>('/api/admin/login', {
        method: 'POST',
        body: { username, password },
      });
      await mutate(ADMIN_SESSION_KEY, result, { revalidate: false });
      void navigate(next, { replace: true });
    } catch (error) {
      showError(messageFor(error));
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-120 flex-col justify-center gap-6 px-4 py-8">
      <div className="flex flex-col items-center gap-3">
        <img
          src={logo96}
          srcSet={`${logo96} 1x, ${logo192} 2x`}
          width={96}
          height={96}
          alt={copy.brand}
          className="size-24 rounded-card"
        />
        <h1 className="display text-2xl">{t.title}</h1>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        {formError && (
          <Banner tone="danger" ref={bannerRef}>
            {formError}
          </Banner>
        )}
        <TextField
          label={t.username}
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={fieldErrors.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
        />
        <TextField
          label={t.password}
          name="password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          autoComplete="current-password"
          enterKeyHint="go"
          adornment={
            <button
              type="button"
              aria-label={t.showPassword}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              className="flex size-12 items-center justify-center text-ink-muted"
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} />
            </button>
          }
        />
        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? t.submitting : t.submit}
        </Button>
      </form>
    </main>
  );
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Hotel, LogIn, TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api, apiMode } from '@/api'
import { DEV_USERS } from '@/auth/devUsers'
import { safeNextPath } from '@/auth/nextPath'
import { ROLE_LABELS } from '@/auth/permissions'
import { sessionStore } from '@/auth/session'
import { useCurrentUser } from '@/auth/useAuth'
import { Button } from '@/components/common/Button'
import { Field, TextInput } from '@/components/common/FormControls'
import { errorMessage } from '@/hooks/useApiMutation'
import { signInSchema, type SignInValues } from '@/schemas/auth'

/**
 * DEVELOPMENT SIGN-IN. Checks one of the demo accounts (src/auth/devUsers.ts) against the active data source:
 * HTTP Basic against the backend, or the same list in mock mode. Not production authentication.
 */
export function SignInPage() {
  const user = useCurrentUser()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const formId = useId()
  const next = safeNextPath(params.get('next'))
  const expired = sessionStore.lastSignOutReason() === 'expired'

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { username: '', password: '' } })

  const signIn = useMutation({
    mutationFn: ({ username, password }: SignInValues) => api.auth.signIn(username, password),
    onSuccess: (session) => {
      sessionStore.start(session)
      void navigate(next, { replace: true })
    },
  })

  if (user && !signIn.isPending) return <Navigate to={next} replace />

  const fillAccount = (username: string, password: string) => {
    setValue('username', username, { shouldValidate: true })
    setValue('password', password, { shouldValidate: true })
    setFocus('password')
  }

  return (
    <main className="grid min-h-full place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white">
            <Hotel className="size-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold text-ink">Hotel Management</p>
            <p className="text-xs text-ink-subtle">Admin console · {apiMode === 'mock' ? 'Mock data' : 'Live API'}</p>
          </div>
        </div>

        <section className="rounded-xl border border-line bg-surface p-6 shadow-card" aria-labelledby={`${formId}-title`}>
          <h1 id={`${formId}-title`} className="text-lg font-semibold text-ink">
            Sign in
          </h1>
          {expired && (
            <p role="status" className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-ink">
              Your session has ended. Sign in again to continue.
            </p>
          )}

          <form id={formId} className="mt-4 space-y-4" noValidate onSubmit={handleSubmit((values) => signIn.mutate(values))}>
            <Field label="Username" error={errors.username?.message} required>
              {(aria) => <TextInput {...aria} {...register('username')} autoComplete="username" autoCapitalize="none" spellCheck={false} invalid={Boolean(errors.username)} />}
            </Field>
            <Field label="Password" error={errors.password?.message} required>
              {(aria) => <TextInput {...aria} {...register('password')} type="password" autoComplete="current-password" invalid={Boolean(errors.password)} />}
            </Field>
            {signIn.isError && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {errorMessage(signIn.error)}
              </p>
            )}
            <Button type="submit" className="w-full" loading={signIn.isPending} icon={<LogIn className="size-4" aria-hidden />}>
              Sign in
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-dashed border-line bg-surface p-5" aria-labelledby={`${formId}-demo`}>
          <h2 id={`${formId}-demo`} className="flex items-center gap-2 text-sm font-semibold text-ink">
            <TriangleAlert className="size-4 text-warning" aria-hidden />
            Development sign-in
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Demo accounts for trying each role. This is not production authentication; replace it with a real identity provider before deployment.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {DEV_USERS.map((u) => (
              <li key={u.username} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {ROLE_LABELS[u.role]} <span className="font-normal text-ink-subtle">· {u.username}</span>
                  </p>
                  <p className="truncate text-xs text-ink-muted">{u.description}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => fillAccount(u.username, u.password)} aria-label={`Use the ${u.username} account`}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}

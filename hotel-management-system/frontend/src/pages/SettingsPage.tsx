import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Check, Database, Minus, Percent, ShieldCheck } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { apiMode, demoData } from '@/api'
import { apiConfig } from '@/api/config'
import { DEV_USERS } from '@/auth/devUsers'
import { PERMISSION_GROUPS } from '@/auth/permissionLabels'
import { hasPermission, ROLE_LABELS } from '@/auth/permissions'
import { useCan } from '@/auth/useAuth'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Card, CardHeader } from '@/components/common/Card'
import { Field, TextArea, TextInput } from '@/components/common/FormControls'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { Tabs, type TabItem } from '@/components/common/Tabs'
import { DemoDataReset } from '@/components/layout/DemoDataReset'
import { HOTEL_TIME_ZONE } from '@/config/hotel'
import { useHealth } from '@/hooks/useHealth'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { settingsInputSchema, type SettingsFormValues } from '@/schemas/settings'
import type { ApiError } from '@/types/api'
import { USER_ROLES } from '@/types/enums'
import type { HotelSettings, SettingsInput } from '@/types/settings'
import { formatCurrency, formatDate } from '@/utils/format'

type TabKey = 'profile' | 'taxes' | 'roles' | 'data'

const TABS: ReadonlyArray<TabItem<TabKey>> = [
  { key: 'profile', label: 'Hotel profile', icon: Building2 },
  { key: 'taxes', label: 'Taxes', icon: Percent },
  { key: 'roles', label: 'Users & roles', icon: ShieldCheck },
  { key: 'data', label: 'Data', icon: Database },
]

const isTab = (value: string | null): value is TabKey => TABS.some((t) => t.key === value)

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabKey = isTab(requested) ? requested : 'profile'

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Hotel profile, taxes, user roles and the demo data." />
      <Card>
        <Tabs label="Settings sections" idPrefix="settings" tabs={TABS} value={tab} onChange={(key) => setParams(key === 'profile' ? {} : { tab: key })}>
          {tab === 'profile' ? <ProfileSection /> : tab === 'taxes' ? <TaxesSection /> : tab === 'roles' ? <RolesSection /> : <DataSection />}
        </Tabs>
      </Card>
    </div>
  )
}

/** Loads the settings once for the sections that need them. */
function WithSettings({ children }: { children: (settings: HotelSettings) => ReactNode }) {
  const settings = useSettings()
  if (settings.isPending) {
    return (
      <div className="p-5">
        <LoadingState label="Loading settings" rows={5} />
      </div>
    )
  }
  if (settings.isError) return <ErrorState message={settings.error.message} onRetry={() => void settings.refetch()} retrying={settings.isFetching} />
  return children(settings.data)
}

// ------------------------------------------------------------------ hotel profile

function ProfileSection() {
  const canEdit = useCan()('settings.manage')
  return (
    <WithSettings>
      {(settings) =>
        canEdit ? (
          <ProfileForm key={JSON.stringify(settings.hotel) + settings.checkInTime + settings.checkOutTime} settings={settings} />
        ) : (
          <ProfileView settings={settings} />
        )
      }
    </WithSettings>
  )
}

const toFormValues = (s: HotelSettings): SettingsFormValues => ({ ...s.hotel, checkInTime: s.checkInTime, checkOutTime: s.checkOutTime })

function ProfileForm({ settings }: { settings: HotelSettings }) {
  const formId = useId()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues, unknown, SettingsInput>({ resolver: zodResolver(settingsInputSchema), defaultValues: toFormValues(settings) })
  const save = useUpdateSettings({
    onError: (error: ApiError) => {
      const entries = Object.entries(error.fieldErrors ?? {})
      entries.forEach(([field, message]) => setError(field as Path<SettingsFormValues>, { message }))
      return entries.length > 0
    },
  })

  return (
    <form id={formId} noValidate className="space-y-5 p-5" onSubmit={handleSubmit((input) => save.mutate(input))}>
      <p className="text-sm text-ink-muted">Shown on every invoice. Changes apply to invoices immediately, including ones already issued.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Hotel name" error={errors.name?.message} required>
          {(aria) => <TextInput {...aria} {...register('name')} invalid={Boolean(errors.name)} />}
        </Field>
        <Field label="GSTIN" error={errors.gstin?.message} hint="15 characters, e.g. 30ABCDE1234F1Z5" required>
          {(aria) => <TextInput {...aria} {...register('gstin')} autoCapitalize="characters" spellCheck={false} invalid={Boolean(errors.gstin)} />}
        </Field>
        <Field label="Address" error={errors.address?.message} required className="md:col-span-2">
          {(aria) => <TextArea {...aria} {...register('address')} rows={2} invalid={Boolean(errors.address)} />}
        </Field>
        <Field label="Phone" error={errors.phone?.message} required>
          {(aria) => <TextInput {...aria} {...register('phone')} type="tel" autoComplete="tel" invalid={Boolean(errors.phone)} />}
        </Field>
        <Field label="Email" error={errors.email?.message} required>
          {(aria) => <TextInput {...aria} {...register('email')} type="email" autoComplete="email" invalid={Boolean(errors.email)} />}
        </Field>
        <Field label="Check-in time" error={errors.checkInTime?.message} required>
          {(aria) => <TextInput {...aria} {...register('checkInTime')} type="time" invalid={Boolean(errors.checkInTime)} />}
        </Field>
        <Field label="Check-out time" error={errors.checkOutTime?.message} hint="Earlier than check-in, so rooms can be cleaned" required>
          {(aria) => <TextInput {...aria} {...register('checkOutTime')} type="time" invalid={Boolean(errors.checkOutTime)} />}
        </Field>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={() => reset(toFormValues(settings))} disabled={!isDirty || save.isPending}>
          Discard changes
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

function ProfileView({ settings }: { settings: HotelSettings }) {
  const rows: Array<[string, string]> = [
    ['Hotel name', settings.hotel.name],
    ['Address', settings.hotel.address],
    ['Phone', settings.hotel.phone],
    ['Email', settings.hotel.email],
    ['GSTIN', settings.hotel.gstin],
    ['Check-in time', settings.checkInTime],
    ['Check-out time', settings.checkOutTime],
  ]
  return (
    <div className="space-y-4 p-5">
      <p className="text-sm text-ink-muted">Only the administrator can change the hotel profile.</p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-ink-muted">{label}</dt>
            <dd className="text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ------------------------------------------------------------------ taxes

/** "Up to ₹7,500", "Over ₹7,500 up to ₹15,000", "Over ₹15,000". */
function slabLabel(slabs: HotelSettings['taxes']['roomGstSlabs'], index: number): string {
  const slab = slabs[index]!
  const previous = index > 0 ? slabs[index - 1]!.maxRate : null
  const max = slab.maxRate === null ? null : formatCurrency(slab.maxRate)
  if (previous === null) return max ? `Up to ${max}` : 'Any rate'
  return max ? `Over ${formatCurrency(previous)} up to ${max}` : `Over ${formatCurrency(previous)}`
}

function TaxesSection() {
  return (
    <WithSettings>
      {(settings) => (
        <div className="space-y-5 p-5">
          <p className="text-sm text-ink-muted">
            GST is applied to every bill from these rates. They are fixed configuration, not editable here: changing a rate would silently change
            invoices that were already issued. A rate change belongs in a release with dated rates.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full max-w-xl text-sm">
              <caption className="sr-only">GST rates</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th scope="col" className="py-2 font-medium">
                    Charge
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    GST
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {settings.taxes.roomGstSlabs.map((slab, index) => (
                  <tr key={index}>
                    <td className="py-2.5 text-ink">Room tariff: {slabLabel(settings.taxes.roomGstSlabs, index)} per night</td>
                    <td className="py-2.5 text-right tabular-nums">{slab.percent}%</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2.5 text-ink">Food and beverages</td>
                  <td className="py-2.5 text-right tabular-nums">{settings.taxes.foodGstPercent}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <dl className="grid max-w-xl grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-muted">Currency</dt>
            <dd className="text-ink">{settings.currency}</dd>
            <dt className="text-ink-muted">Time zone</dt>
            <dd className="text-ink">{settings.timezone}</dd>
          </dl>
        </div>
      )}
    </WithSettings>
  )
}

// ------------------------------------------------------------------ roles

function RolesSection() {
  return (
    <div className="space-y-6 p-5">
      <p className="text-sm text-ink-muted">
        What each role can do. The API enforces these rules; the app only shows what the signed-in role may use.
      </p>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Permissions by role</caption>
          <thead>
            <tr className="border-b border-line text-xs text-ink-muted">
              <th scope="col" className="py-2 text-left font-medium">
                Capability
              </th>
              {USER_ROLES.map((role) => (
                <th key={role} scope="col" className="px-2 py-2 text-center font-medium">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((group) => (
            <tbody key={group.module} className="border-b border-line">
              <tr>
                <th scope="colgroup" colSpan={USER_ROLES.length + 1} className="pt-3 pb-1 text-left text-xs font-semibold tracking-wide text-ink uppercase">
                  {group.module}
                </th>
              </tr>
              {group.items.map(({ permission, label }) => (
                <tr key={permission}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink">
                    {label}
                  </th>
                  {USER_ROLES.map((role) => (
                    <td key={role} className="px-2 py-1.5 text-center">
                      {hasPermission([role], permission) ? (
                        <>
                          <Check className="inline size-4 text-success" aria-hidden />
                          <span className="sr-only">Allowed</span>
                        </>
                      ) : (
                        <>
                          <Minus className="inline size-4 text-ink-subtle" aria-hidden />
                          <span className="sr-only">Not allowed</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <Card className="shadow-none">
        <CardHeader
          title="Demo accounts"
          subtitle="Development sign-in only: fixed accounts for trying each role, not production authentication. They are listed on the sign-in page."
        />
        <ul className="divide-y divide-line border-t border-line">
          {DEV_USERS.map((u) => (
            <li key={u.username} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <span className="text-sm font-medium text-ink">{u.username}</span>
              <span className="flex items-center gap-2 text-xs text-ink-muted">
                {u.description}
                <Badge tone="brand">{ROLE_LABELS[u.role]}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ data

function DataSection() {
  const health = useHealth()
  const settings = useSettings()
  const apiZone = settings.data?.timezone
  const zoneMismatch = Boolean(apiZone && apiZone !== HOTEL_TIME_ZONE)
  const status = health.isPending ? 'Checking…' : health.isError ? 'Unreachable' : 'Connected'

  return (
    <div className="space-y-5 p-5">
      <dl className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
        <dt className="text-ink-muted">Data source</dt>
        <dd className="text-ink">
          {apiMode === 'mock' ? 'Mock data in this browser (localStorage)' : `Spring Boot API at ${apiConfig.baseUrl}`}
        </dd>
        <dt className="text-ink-muted">Status</dt>
        <dd>
          <Badge tone={health.isError ? 'danger' : health.isPending ? 'neutral' : 'success'}>{status}</Badge>
        </dd>
        <dt className="text-ink-muted">Hotel time zone (app)</dt>
        <dd className="text-ink">
          {HOTEL_TIME_ZONE}
          {zoneMismatch && (
            <p role="alert" className="mt-1 text-xs text-danger">
              The API uses {apiZone}. Set VITE_HOTEL_TIMEZONE={apiZone} so both agree on today’s date.
            </p>
          )}
        </dd>
        {demoData && (
          <>
            <dt className="text-ink-muted">Demo data generated</dt>
            <dd className="text-ink">{formatDate(demoData.seededOn())}</dd>
          </>
        )}
      </dl>

      {demoData ? (
        <div className="space-y-3 rounded-lg border border-line p-4">
          <p className="text-sm text-ink-muted">
            Changes made in this browser are kept until you reset. Resetting restores the original demo data with dates aligned to today.
          </p>
          <DemoDataReset controls={demoData} variant="button" />
        </div>
      ) : (
        <p className="rounded-lg border border-line p-4 text-sm text-ink-muted">
          The backend holds the data in memory. Restart it to restore the original demo data.
        </p>
      )}
    </div>
  )
}

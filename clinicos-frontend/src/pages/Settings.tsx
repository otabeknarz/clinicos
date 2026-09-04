import { useEffect, useState } from 'react'
import { Check, RotateCcw, ShieldCheck } from 'lucide-react'

import { listUsers } from '@/api/auth'
import { getClinic, updateClinic } from '@/api/clinic'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProfileTab } from './settings/ProfileTab'
import { ScheduleTab } from './settings/ScheduleTab'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Select, TextInput } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/Modal'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { resetDb } from '@/mock/db'
import { USE_MOCK } from '@/api/client'
import { ROLE_PERMISSIONS } from '@/lib/permissions'
import { cn } from '@/lib/cn'
import { phone as formatPhone } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { LANGS, useI18n } from '@/i18n'
import type { Lang } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useTheme } from '@/store/theme-context'
import type { ThemeMode } from '@/store/theme-context'
import { useToast } from '@/store/toast-context'
import type { Permission, Role, WorkingHours } from '@/types/models'

type Tab = 'profile' | 'schedule' | 'clinic' | 'users' | 'roles' | 'hours' | 'appearance'

export function SettingsPage() {
  const { t } = useI18n()
  const { can, session } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')

  /*
    Sozlamalar ikkiga bo'linadi:

      shaxsiy   — o'z profili, ish jadvali, ko'rinish. Bular HAR BIR
                  xodimga kerak: ismini tuzatish, rasm qo'yish, tilni
                  almashtirish har kimning o'z ishi.

      klinika   — klinika profili, foydalanuvchilar, rollar, ish
                  vaqti. Bular klinikaning butun ishiga ta'sir qiladi,
                  shuning uchun faqat egasida.
  */
  const canManageClinic = can('settings.manage')
  const canManageUsers = can('users.manage')

  /*
    Ish jadvali — klinika xodimlari uchun. Platforma egasi klinikaning
    shtatida emas: unga bu bo'lim doim bo'sh chiqadi.
  */
  const isClinicStaff = session?.user.role !== 'superadmin'

  return (
    <>
      <PageHeader title={t('settings.title')} />

      <Card padded={false}>
        <div className="hairline px-5 pt-4 sm:px-6">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'profile', label: t('settings.tab.profile') },
              ...(isClinicStaff
                ? [{ value: 'schedule' as const, label: t('schedule.mine') }]
                : []),
              ...(canManageClinic
                ? [{ value: 'clinic' as const, label: t('settings.tab.clinic') }]
                : []),
              ...(canManageUsers
                ? [
                    { value: 'users' as const, label: t('settings.tab.users') },
                    { value: 'roles' as const, label: t('settings.tab.roles') },
                  ]
                : []),
              ...(canManageClinic
                ? [{ value: 'hours' as const, label: t('settings.tab.hours') }]
                : []),
              { value: 'appearance', label: t('settings.appearance') },
            ]}
          />
        </div>

        <div className="p-5 sm:p-6">
          {tab === 'profile' ? <ProfileTab /> : null}
          {tab === 'schedule' && isClinicStaff ? <ScheduleTab /> : null}
          {tab === 'clinic' && canManageClinic ? <ClinicTab /> : null}
          {tab === 'users' ? <UsersTab /> : null}
          {tab === 'roles' ? <RolesTab /> : null}
          {tab === 'hours' ? <HoursTab /> : null}
          {tab === 'appearance' ? <AppearanceTab /> : null}
        </div>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Klinika profili                                                     */
/* ------------------------------------------------------------------ */

function ClinicTab() {
  const { t } = useI18n()
  const toast = useToast()
  const { can } = useAuth()

  const { data, loading, error, reload } = useAsync(() => getClinic(), [])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [slot, setSlot] = useState('30')

  useEffect(() => {
    if (!data) return
    setName(data.name)
    setPhone(data.phone)
    setAddress(data.address)
    setSlot(String(data.slotMinutes))
  }, [data])

  const save = useAction(async () =>
    updateClinic({ name, phone, address, slotMinutes: Number(slot) }),
  )

  if (loading) return <CardSkeleton className="border-0 shadow-none" />
  if (error) return <ErrorState onRetry={reload} />

  const editable = can('settings.manage')

  async function submit() {
    const result = await save.run()
    toast[result ? 'success' : 'error'](result ? t('toast.saved') : t('toast.error'))
    if (result) reload()
  }

  return (
    <div className="max-w-xl space-y-4">
      <TextInput
        label={t('settings.clinic.name')}
        value={name}
        disabled={!editable}
        onChange={(e) => setName(e.target.value)}
      />
      <TextInput
        label={t('common.phone')}
        value={phone}
        disabled={!editable}
        onChange={(e) => setPhone(e.target.value)}
      />
      <TextInput
        label={t('common.address')}
        value={address}
        disabled={!editable}
        onChange={(e) => setAddress(e.target.value)}
      />
      <Select
        label={t('settings.tab.appointments')}
        value={slot}
        disabled={!editable}
        onChange={(e) => setSlot(e.target.value)}
        options={[
          { value: '15', label: `15 ${t('common.min')}` },
          { value: '20', label: `20 ${t('common.min')}` },
          { value: '30', label: `30 ${t('common.min')}` },
          { value: '60', label: `60 ${t('common.min')}` },
        ]}
      />

      {editable ? (
        <Button onClick={submit} loading={save.pending}>
          {t('action.save')}
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Foydalanuvchilar                                                    */
/* ------------------------------------------------------------------ */

function UsersTab() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(() => listUsers(), [])

  if (loading) return <CardSkeleton className="border-0 shadow-none" />
  if (error) return <ErrorState onRetry={reload} />

  return (
    <ul className="divide-y divide-separator">
      {(data ?? []).map((user) => (
        <li key={user.id} className="flex items-center gap-3 py-3 first:pt-0">
          <Avatar name={user.fullName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-subhead font-medium text-label">{user.fullName}</p>
            <p className="truncate text-caption text-label-tertiary">{user.email}</p>
          </div>
          <span className="hidden shrink-0 text-caption tnum text-label-tertiary sm:block">
            {formatPhone(user.phone)}
          </span>
          <Badge tone={user.role === 'owner' ? 'brand' : 'neutral'}>
            {t(`role.${user.role}`)}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Rollar va ruxsatlar                                                 */
/* ------------------------------------------------------------------ */

/**
 * Ruxsatlar matritsasi — faqat KO'RSATISH uchun.
 *
 * Bu jadval nima kimga ochiqligini bir qarashda ko'rsatadi. Tahrirlash
 * imkoniyati keyingi bosqichda qo'shiladi: ruxsatlarni o'zgartirish
 * server tomonda tekshiriladigan amal bo'lishi kerak.
 */
function RolesTab() {
  const { t } = useI18n()

  const roles: Role[] = ['owner', 'receptionist', 'doctor']
  const allPermissions = Array.from(
    new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role])),
  ).sort() as Permission[]

  return (
    <>
      <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent">
        <ShieldCheck size={13} />
        {t('settings.tab.roles')}
      </p>

      <div className="scroll-slim overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="hairline">
              <th className="px-3 pb-2 text-left text-caption font-medium uppercase tracking-wide text-label-tertiary">
                {t('common.actions')}
              </th>
              {roles.map((role) => (
                <th
                  key={role}
                  className="px-3 pb-2 text-center text-caption font-medium uppercase tracking-wide text-label-tertiary"
                >
                  {t(`role.${role}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPermissions.map((permission) => (
              <tr key={permission} className="hairline last:border-b-0">
                <td className="px-3 py-2 font-mono text-caption text-label-secondary">
                  {permission}
                </td>
                {roles.map((role) => (
                  <td key={role} className="px-3 py-2 text-center">
                    {ROLE_PERMISSIONS[role].includes(permission) ? (
                      <Check size={15} className="mx-auto text-ok" />
                    ) : (
                      <span className="text-label-quaternary">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Ish vaqti                                                           */
/* ------------------------------------------------------------------ */

function HoursTab() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(() => getClinic(), [])

  if (loading) return <CardSkeleton className="border-0 shadow-none" />
  if (error) return <ErrorState onRetry={reload} />

  const names = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
  const hours = [...(data?.workingHours ?? [])].sort(
    (a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7),
  )

  return (
    <ul className="max-w-md divide-y divide-separator">
      {hours.map((row: WorkingHours) => (
        <li key={row.weekday} className="flex items-center justify-between py-3 first:pt-0">
          <span className="text-subhead text-label">{names[row.weekday]}</span>
          {row.isClosed ? (
            <Badge tone="neutral">{t('settings.hours.closed')}</Badge>
          ) : (
            <span className="text-subhead tnum text-label-secondary">
              {row.open} — {row.close}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Ko'rinish                                                           */
/* ------------------------------------------------------------------ */

function AppearanceTab() {
  const { t, lang, setLang } = useI18n()
  const { mode, setMode } = useTheme()
  const toast = useToast()
  const [confirmReset, setConfirmReset] = useState(false)

  const themes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'system', label: t('settings.theme.system') },
  ]

  function handleReset() {
    resetDb()
    toast.success(t('toast.updated'))
    setConfirmReset(false)
    // Demo ma'lumot qaytadan yaratilishi uchun sahifani yangilaymiz
    setTimeout(() => window.location.reload(), 400)
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <CardHeader title={t('settings.appearance')} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.value}
              type="button"
              onClick={() => setMode(theme.value)}
              className={cn(
                'rounded-[12px] px-3 py-3 text-subhead font-medium transition-colors duration-150',
                mode === theme.value
                  ? 'bg-accent-soft text-accent ring-1 ring-accent/40 ring-inset'
                  : 'bg-sunken text-label-secondary hover:text-label',
              )}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <CardHeader title={t('settings.language')} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {LANGS.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => setLang(option.code as Lang)}
              className={cn(
                'rounded-[12px] px-3 py-3 text-subhead font-medium transition-colors duration-150',
                lang === option.code
                  ? 'bg-accent-soft text-accent ring-1 ring-accent/40 ring-inset'
                  : 'bg-sunken text-label-secondary hover:text-label',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Demo rejimda ma'lumotni tiklash — backend ulangach bu blok yo'qoladi */}
      {USE_MOCK ? (
        <div className="rounded-[14px] bg-sunken p-4">
          <p className="text-subhead font-medium text-label">Demo ma'lumot</p>
          <p className="mt-1 text-footnote text-label-secondary">
            Siz kiritgan barcha o'zgarishlarni o'chirib, boshlang'ich demo ma'lumotni
            qaytaradi.
          </p>
          <Button
            variant="gray"
            size="sm"
            icon={<RotateCcw size={14} />}
            className="mt-3"
            onClick={() => setConfirmReset(true)}
          >
            {t('action.reset')}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        confirmLabel={t('action.reset')}
      />
    </div>
  )
}

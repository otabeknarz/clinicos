import { useState } from 'react'
import { KeyRound, Pencil, UserMinus, UserPlus, Users } from 'lucide-react'

import {
  createPharmacyStaff,
  firePharmacyStaff,
  resetPharmacyStaffPassword,
  listPharmacyStaff,
  updatePharmacyStaff,
} from '@/api/pharmacy'
import type { PharmacyStaffInput, StaffWithStats } from '@/api/pharmacy'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import {
  buildPlatformEmail,
  EmailLocalInput,
  emailLocalPart,
} from '@/components/ui/EmailLocalInput'
import { Field, PhoneInput, Select, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Tabs'
import { CardSkeleton, EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateShort, money, phoneToE164, weekdaysShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/* Hafta DUSHANBADAN boshlanadi — O'zbekistonda ish haftasi shunday */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]

/**
 * APTEKA XODIMLARI — FAQAT RAHBAR.
 *
 * Ikkita narsa bir joyda: kadr yozuvi (kim, qancha oylik, qaysi
 * kunlari ishlaydi) va ISH NATIJASI (qancha sotdi, kassasi
 * qanday chiqdi). Ular ataylab ajratilmadi — rahbar oylikni
 * natijaga qarab belgilaydi va ikkalasini ikki ekrandan
 * solishtirib o'tirishi noqulay bo'lardi.
 */
export function PharmacyStaffPage() {
  const { t } = useI18n()
  const toast = useToast()

  const [days, setDays] = useState<'30' | '90'>('30')
  const [editing, setEditing] = useState<StaffWithStats | null>(null)
  const [adding, setAdding] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const { data, loading, reload } = useAsync(
    () => listPharmacyStaff(Number(days)),
    [days],
  )
  const rows = data ?? []

  /*
    Server aytgan sabab ko'rsatiladi: "oxirgi rahbar qolishi kerak",
    "o'zingizni chiqara olmaysiz" — umumiy "xatolik" bu yerda hech
    narsani tushuntirmasdi.
  */
  async function onFire(person: StaffWithStats) {
    try {
      await firePharmacyStaff(person.id)
      toast.success(t('pharmacy.staffFired'))
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    }
  }

  async function onResetPassword(person: StaffWithStats) {
    try {
      const done = await resetPharmacyStaffPassword(person.id)
      setCredentials({ name: person.fullName, login: done.login, password: done.password })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t('nav.pharmacyStaff')}
          subtitle={t('pharmacy.periodHint', { count: days })}
          action={
            <div className="flex items-center gap-2">
              <Segmented
                value={days}
                onChange={setDays}
                options={[
                  { value: '30', label: t('pharmacy.days30') },
                  { value: '90', label: t('pharmacy.days90') },
                ]}
              />
              <Button onClick={() => setAdding(true)}>
                <UserPlus size={16} />
                {t('pharmacy.addStaff')}
              </Button>
            </div>
          }
        />
      </Card>

      {loading ? (
        <CardSkeleton />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Users size={22} />} title={t('pharmacy.noStaff')} />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((person) => (
            <StaffCard
              key={person.id}
              person={person}
              onEdit={() => setEditing(person)}
              onFire={() => void onFire(person)}
              onResetPassword={() => void onResetPassword(person)}
            />
          ))}
        </div>
      )}

      <StaffModal
        open={adding || editing !== null}
        person={editing}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        onSaved={(created) => {
          setAdding(false)
          setEditing(null)
          reload()
          if (created) setCredentials(created)
        }}
      />

      <CredentialsModal value={credentials} onClose={() => setCredentials(null)} />
    </div>
  )
}

function StaffCard({
  person,
  onEdit,
  onFire,
  onResetPassword,
}: {
  person: StaffWithStats
  onEdit: () => void
  onFire: () => void
  onResetPassword: () => void
}) {
  const { t } = useI18n()
  const { stats } = person
  const weekLabels = weekdaysShort()

  return (
    <Card className={cn('space-y-4', person.status === 'fired' && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-headline font-semibold text-label">{person.fullName}</p>
            <Badge tone={person.role === 'pharmacy_owner' ? 'accent' : 'neutral'}>
              {t(`role.${person.role}`)}
            </Badge>
            {person.status === 'fired' ? (
              <Badge tone="bad">{t('pharmacy.fired')}</Badge>
            ) : null}
            {person.canReceive && person.role === 'pharmacist' ? (
              <Badge tone="ok">{t('pharmacy.receivesGoods')}</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-caption text-label-tertiary">
            {person.phone} · {person.login} · {t('pharmacy.since')}{' '}
            {dateShort(person.hiredAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton label={t('action.edit')} className="h-8 w-8" onClick={onEdit}>
            <Pencil size={15} />
          </IconButton>
          {person.status === 'active' ? (
            <IconButton
              label={t('pharmacy.resetPassword')}
              className="h-8 w-8"
              onClick={onResetPassword}
            >
              <KeyRound size={15} />
            </IconButton>
          ) : null}
          {person.status === 'active' ? (
            <IconButton label={t('pharmacy.fire')} className="h-8 w-8" onClick={onFire}>
              <UserMinus size={15} />
            </IconButton>
          ) : null}
        </div>
      </div>

      {/* --- Ish sharti --- */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-subhead">
        <span className="text-label-secondary">
          {t('pharmacy.salary')}:{' '}
          <span className="font-semibold text-label">{money(person.salary)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-label-secondary">{t('pharmacy.workdays')}:</span>
          <span className="flex gap-1">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-[7px] text-caption font-medium',
                  person.workdays.includes(day)
                    ? 'bg-accent-soft text-accent'
                    : 'bg-fill-4 text-label-quaternary',
                )}
              >
                {weekLabels[day]}
              </span>
            ))}
          </span>
        </span>
        <span className="text-label-secondary">
          {t('pharmacy.shiftHours')}:{' '}
          <span className="font-semibold tabular-nums text-label">
            {person.shiftStart} — {person.shiftEnd}
          </span>
        </span>
      </div>

      {/* --- Natija --- */}
      <div className="hairline-t grid grid-cols-2 gap-x-4 gap-y-3 pt-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label={t('pharmacy.daysWorked')} value={String(stats.daysWorked)} />
        <Metric label={t('pharmacy.customers')} value={String(stats.customers)} />
        <Metric label={t('pharmacy.revenue')} value={money(stats.revenue)} />
        <Metric label={t('pharmacy.dailyAverage')} value={money(stats.dailyAverage)} />
        <Metric
          label={t('pharmacy.cashShort')}
          value={money(stats.cashShort)}
          tone={stats.cashShort > 0 ? 'bad' : undefined}
        />
        <Metric
          label={t('pharmacy.cashOver')}
          value={money(stats.cashOver)}
          tone={stats.cashOver > 0 ? 'warn' : undefined}
        />
      </div>

      {stats.gapDays > 0 ? (
        <p className="text-caption text-label-tertiary">
          {t('pharmacy.gapDays', { count: stats.gapDays, days: stats.daysWorked })}
        </p>
      ) : stats.daysWorked > 0 ? (
        <p className="text-caption text-good">{t('pharmacy.gapNever')}</p>
      ) : null}
    </Card>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'bad' | 'warn'
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-caption text-label-tertiary">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate text-subhead font-semibold tabular-nums',
          tone === 'bad' && 'text-bad',
          tone === 'warn' && 'text-warn',
          !tone && 'text-label',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function StaffModal({
  open,
  person,
  onClose,
  onSaved,
}: {
  open: boolean
  person: StaffWithStats | null
  onClose: () => void
  onSaved: (created: Credentials | null) => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('+998 ')
  const [login, setLogin] = useState('')
  const [role, setRole] = useState<'pharmacist' | 'pharmacy_owner'>('pharmacist')
  const [salary, setSalary] = useState('')
  const [workdays, setWorkdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [shiftStart, setShiftStart] = useState('09:00')
  const [shiftEnd, setShiftEnd] = useState('18:00')
  const [canReceive, setCanReceive] = useState(false)

  /* Oyna ochilganda to'ldiramiz — tahrirlashda mavjud qiymatlar bilan */
  const weekLabels = weekdaysShort()
  const [ready, setReady] = useState(false)
  if (open && !ready) {
    setReady(true)
    setFullName(person?.fullName ?? '')
    setPhone(person?.phone ?? '+998 ')
    /* Mavjud logindan faqat nom qismi olinadi, domen o'zi qo'shiladi */
    setLogin(emailLocalPart(person?.login ?? ''))
    setRole(person?.role ?? 'pharmacist')
    setSalary(person ? String(person.salary) : '')
    setWorkdays(person?.workdays ?? [1, 2, 3, 4, 5])
    setShiftStart(person?.shiftStart ?? '09:00')
    setShiftEnd(person?.shiftEnd ?? '18:00')
    setCanReceive(person?.canReceive ?? false)
  }
  if (!open && ready) setReady(false)

  const [saving, setSaving] = useState(false)

  function buildInput(): PharmacyStaffInput {
    return {
      fullName: fullName.trim(),
      phone: phoneToE164(phone),
      login: buildPlatformEmail(login),
      role,
      salary: Number(salary) || 0,
      workdays,
      shiftStart,
      shiftEnd,
      status: person?.status ?? 'active',
      hiredAt: person?.hiredAt ?? new Date().toISOString().slice(0, 10),
      /* Rahbarda kirim huquqi doim bor — alohida belgilanmaydi */
      canReceive: role === 'pharmacy_owner' ? true : canReceive,
    }
  }

  async function submit() {
    if (!fullName.trim() || !login.trim()) return
    setSaving(true)
    try {
      if (person) {
        await updatePharmacyStaff(person.id, buildInput())
        toast.success(t('toast.updated'))
        onSaved(null)
      } else {
        const created = await createPharmacyStaff(buildInput())
        toast.success(t('toast.created'))
        /* Vaqtinchalik parol — faqat shu yerda, bir marta */
        onSaved({
          name: created.staff.fullName,
          login: created.staff.login,
          password: created.password,
        })
      }
    } catch (e) {
      /* "login band" kabi sabab aynan ko'rsatiladi */
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={person ? t('pharmacy.editStaff') : t('pharmacy.addStaff')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput
          label={t('patientForm.fullName')}
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <PhoneInput label={t('common.phone')} value={phone} onChange={setPhone} />
          {/*
            DOMEN QO'LDA YOZILMAYDI.

            Barcha hisoblar `@clinic-os.uz` da ochiladi va domenni
            har safar terish faqat xatolik manbai bo'lardi —
            `.uz` o'rniga `.ru`, ortiqcha bo'shliq, bosh harf.
            Klinika xodimlari formasi ham shunday ishlaydi.
          */}
          <EmailLocalInput
            label={t('pharmacy.login')}
            required
            value={login}
            hint={t('pharmacy.loginHint')}
            onChange={setLogin}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('pharmacy.role')}
            value={role}
            onChange={(e) => setRole(e.target.value as 'pharmacist' | 'pharmacy_owner')}
            options={[
              { value: 'pharmacist', label: t('role.pharmacist') },
              { value: 'pharmacy_owner', label: t('role.pharmacy_owner') },
            ]}
          />
          <TextInput
            label={t('pharmacy.salary')}
            inputMode="numeric"
            value={salary}
            onChange={(e) => setSalary(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        {/*
          KIRIM HUQUQI — alohida belgilanadi.

          Rahbarda u doim bor, shuning uchun bu tanlov faqat
          sotuvchida ko'rinadi.
        */}
        {role === 'pharmacist' ? (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] bg-raised px-3 py-2.5">
            <input
              type="checkbox"
              checked={canReceive}
              onChange={(e) => setCanReceive(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="min-w-0">
              <span className="block text-subhead text-label">
                {t('pharmacy.canReceive')}
              </span>
              <span className="block text-caption text-label-tertiary">
                {t('pharmacy.canReceiveHint')}
              </span>
            </span>
          </label>
        ) : null}

        <Field label={t('pharmacy.workdays')}>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day) => {
              const on = workdays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setWorkdays((current) =>
                      on ? current.filter((d) => d !== day) : [...current, day].sort(),
                    )
                  }
                  className={cn(
                    'h-9 w-11 rounded-[9px] text-subhead font-medium transition-colors duration-150',
                    on
                      ? 'bg-accent text-white'
                      : 'bg-fill-4 text-label-secondary hover:bg-fill-3',
                  )}
                >
                  {weekLabels[day]}
                </button>
              )
            })}
          </div>
        </Field>

        {/*
          ISH VAQTI.

          Ish kunlari "qaysi kuni keladi" degan savolga javob beradi,
          lekin bitta kunda ikki sotuvchi ishlaydi — biri ertalab,
          biri kechqurun. Soatsiz "hozir kim kassada" degan savolga
          javob yo'q va savdoni kim qilgani aniqlanmay qoladi.

          Tungi smena ham yoziladi: 20:00 — 08:00 bo'lsa, tizim
          uni ertangi kunga o'tadi deb tushunadi.
        */}
        <Field label={t('pharmacy.shiftHours')} hint={t('pharmacy.shiftHoursHint')}>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-[10px] border border-transparent bg-sunken px-3.5 text-subhead tabular-nums text-label outline-none transition-colors duration-150 focus:border-accent focus:bg-raised"
            />
            <span className="text-label-tertiary">—</span>
            <input
              type="time"
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-[10px] border border-transparent bg-sunken px-3.5 text-subhead tabular-nums text-label outline-none transition-colors duration-150 focus:border-accent focus:bg-raised"
            />
          </div>
        </Field>
      </div>
    </Modal>
  )
}

interface Credentials {
  name: string
  login: string
  password: string
}

/**
 * Kirish ma'lumotlari — BIR MARTA ko'rsatiladi.
 *
 * Bazada faqat parol xeshi saqlanadi, ya'ni oyna yopilgach parolni
 * hech kim ko'ra olmaydi. Yo'qolsa — "Parolni tiklash" bilan yangisi.
 */
function CredentialsModal({
  value,
  onClose,
}: {
  value: Credentials | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  return (
    <Modal
      open={value !== null}
      onClose={onClose}
      title={t('pharmacy.credentialsTitle')}
      footer={<Button onClick={onClose}>{t('action.close')}</Button>}
    >
      {value ? (
        <div className="space-y-4">
          <p className="text-subhead text-label">{value.name}</p>
          <div className="rounded-[12px] bg-fill-4 p-4">
            <p className="text-caption text-label-tertiary">{t('pharmacy.login')}</p>
            <p className="mt-0.5 text-callout font-medium text-label">{value.login}</p>
            <p className="mt-3 text-caption text-label-tertiary">{t('platform.passwordOnce')}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <code className="text-callout font-semibold tnum text-label">{value.password}</code>
              <Button
                size="sm"
                variant="gray"
                onClick={() => {
                  void navigator.clipboard?.writeText(value.password)
                  toast.success(t('platform.copied'))
                }}
              >
                {t('action.copy')}
              </Button>
            </div>
          </div>
          <p className="text-caption text-bad">{t('pharmacy.credentialsHint')}</p>
        </div>
      ) : null}
    </Modal>
  )
}

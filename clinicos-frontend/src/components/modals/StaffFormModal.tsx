import { useEffect, useState } from 'react'
import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react'

import {
  createStaff,
  generatePassword,
  isStrongPassword,
  PAY_TYPES,
  PERCENT_PRESETS,
  POSITIONS_WITH_ACCESS,
  STAFF_POSITIONS,
  updateStaff,
  WORK_RATES,
} from '@/api/staff'
import { Button, IconButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, PhoneInput, Select, TextArea, TextInput } from '@/components/ui/Form'
import { cn } from '@/lib/cn'
import { toISODate } from '@/lib/dates'
import { money, phoneToE164, weekdaysShort } from '@/lib/format'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { PayType, Role, Staff, StaffPosition, StaffStatus } from '@/types/models'

/**
 * Xodim qo'shish / tahrirlash.
 *
 * Uch blokdan iborat: shaxsiy ma'lumot, ish sharti (vaqt, stavka, maosh)
 * va tizimga kirish. Oxirgisi eng nozik — parolni egasining o'zi
 * belgilaydi, lekin u hech qayerda ochiq saqlanmaydi.
 */
export function StaffFormModal({
  open,
  onClose,
  onSaved,
  staff,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  staff?: Staff | null
}) {
  const { t } = useI18n()
  const toast = useToast()
  const editing = Boolean(staff)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('+998 ')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState<StaffPosition>('nurse')
  const [positionTitle, setPositionTitle] = useState('')
  const [department, setDepartment] = useState('')

  const [workdays, setWorkdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [shiftStart, setShiftStart] = useState('08:00')
  const [shiftEnd, setShiftEnd] = useState('17:00')
  const [workRate, setWorkRate] = useState('1')
  const [payType, setPayType] = useState<PayType>('salary')
  const [percentRate, setPercentRate] = useState('30')
  const [salary, setSalary] = useState('')

  const [hiredAt, setHiredAt] = useState('')
  const [status, setStatus] = useState<StaffStatus>('active')

  const [hasAccess, setHasAccess] = useState(false)
  const [role, setRole] = useState<Role>('receptionist')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mustChange, setMustChange] = useState(true)

  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setFullName(staff?.fullName ?? '')
    setPhone(staff?.phone ?? '+998 ')
    setEmail(staff?.email ?? '')
    setPosition(staff?.position ?? 'nurse')
    setPositionTitle(staff?.positionTitle ?? '')
    setDepartment(staff?.department ?? '')
    setWorkdays(staff?.workdays ?? [1, 2, 3, 4, 5])
    setShiftStart(staff?.shiftStart ?? '08:00')
    setShiftEnd(staff?.shiftEnd ?? '17:00')
    setWorkRate(String(staff?.workRate ?? 1))
    setPayType(staff?.payType ?? 'salary')
    setPercentRate(String(staff?.percentRate || 30))
    setSalary(staff ? String(staff.salary) : '')
    setHiredAt(staff?.hiredAt ?? toISODate(new Date()))
    setStatus(staff?.status ?? 'active')
    setHasAccess(staff?.hasSystemAccess ?? false)
    setRole(staff?.role ?? 'receptionist')
    setLogin(staff?.login ?? '')
    setPassword('')
    setShowPassword(false)
    setMustChange(staff ? staff.mustChangePassword : true)
    setNotes(staff?.notes ?? '')
  }, [open, staff])

  /** Lavozim tanlanganda nomi, jadval va kirish huquqi oldindan to'ldiriladi */
  function pickPosition(next: StaffPosition) {
    setPosition(next)
    setPositionTitle(t(`staff.position.${next}`))

    if (editing) return

    const suggested = POSITIONS_WITH_ACCESS.includes(next)
    setHasAccess(suggested)
    if (suggested) {
      setRole(next === 'doctor' ? 'doctor' : next === 'manager' ? 'owner' : 'receptionist')
    }
    // Shifokorlar ko'pincha foiz evaziga ishlaydi
    if (next === 'doctor') {
      setPayType('percent')
      setPercentRate('30')
    }

    // Qorovul tungi smenada va har kuni ishlaydi
    if (next === 'security') {
      setWorkdays([0, 1, 2, 3, 4, 5, 6])
      setShiftStart('20:00')
      setShiftEnd('08:00')
    }
  }

  function toggleWorkday(day: number) {
    setWorkdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    )
  }

  const digits = phone.replace(/\D/g, '')
  // Yangi xodimga parol majburiy; tahrirlashda bo'sh qoldirilsa — eskisi qoladi
  const passwordRequired = hasAccess && !editing

  const errors = {
    fullName: !fullName.trim() ? t('valid.required') : undefined,
    phone: digits.length < 12 ? t('valid.phone') : undefined,
    login: hasAccess && !login.trim() ? t('valid.required') : undefined,
    workdays: workdays.length === 0 ? t('valid.required') : undefined,
    password:
      passwordRequired && !password
        ? t('valid.required')
        : password && !isStrongPassword(password)
          ? t('staff.passwordWeak')
          : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)

  const save = useAction(async () => {
    const payload = {
      fullName: fullName.trim(),
      phone: phoneToE164(phone),
      email: email.trim(),
      position,
      positionTitle: positionTitle.trim() || t(`staff.position.${position}`),
      department: department.trim(),
      workdays,
      shiftStart,
      shiftEnd,
      workRate: Number(workRate),
      payType,
      percentRate: payType === 'salary' ? 0 : Number(percentRate) || 0,
      salary: payType === 'percent' ? 0 : Number(salary) || 0,
      hiredAt,
      status,
      hasSystemAccess: hasAccess,
      role: hasAccess ? role : null,
      login: hasAccess ? login.trim() : '',
      password: password || undefined,
      mustChangePassword: mustChange,
      notes: notes.trim(),
    }
    return staff ? updateStaff(staff.id, payload) : createStaff(payload)
  })

  async function submit() {
    setTouched(true)
    if (!valid) return

    const result = await save.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(editing ? t('toast.updated') : t('toast.created'))
    onSaved()
    onClose()
  }

  const showSalary = payType !== 'percent'
  const showPercent = payType !== 'salary'
  const monthly = showSalary ? (Number(salary) || 0) * (Number(workRate) || 0) : 0
  const staffShare = Number(percentRate) || 0
  const clinicShare = Math.max(0, 100 - staffShare)
  const weekLabels = weekdaysShort()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? t('action.edit') : t('staff.add')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button onClick={submit} loading={save.pending}>
            {editing ? t('action.save') : t('action.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-6 pb-2">
        {/* ============ Shaxsiy ma'lumot ============ */}
        <section className="space-y-4">
          <TextInput
            label={t('patientForm.fullName')}
            required
            value={fullName}
            error={touched ? errors.fullName : undefined}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('staff.col.position')}
              required
              value={position}
              onChange={(e) => pickPosition(e.target.value as StaffPosition)}
              options={STAFF_POSITIONS.map((key) => ({
                value: key,
                label: t(`staff.position.${key}`),
              }))}
            />
            <TextInput
              label={t('staff.positionTitle')}
              value={positionTitle}
              hint={t('common.optional')}
              onChange={(e) => setPositionTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PhoneInput
              label={t('common.phone')}
              required
              value={phone}
              error={touched ? errors.phone : undefined}
              onChange={setPhone}
            />
            <TextInput
              label={t('common.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t('staff.col.department')}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <TextInput
              label={t('staff.col.hiredAt')}
              type="date"
              value={hiredAt}
              onChange={(e) => setHiredAt(e.target.value)}
            />
          </div>
        </section>

        {/* ============ Ish sharti ============ */}
        <section className="rounded-[14px] bg-sunken p-4">
          <p className="mb-4 text-subhead font-medium text-label">{t('staff.workSection')}</p>

          {/* Ish kunlari */}
          <Field label={t('staff.workdays')} error={touched ? errors.workdays : undefined}>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                const active = workdays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWorkday(day)}
                    className={cn(
                      'h-10 min-w-11 rounded-[10px] px-2 text-footnote font-medium',
                      'transition-colors duration-150',
                      active
                        ? 'bg-accent text-white'
                        : 'bg-raised text-label-secondary hover:text-label',
                    )}
                  >
                    {weekLabels[day]}
                  </button>
                )
              })}
            </div>
          </Field>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t('staff.shiftStart')}
              type="time"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
            />
            <TextInput
              label={t('staff.shiftEnd')}
              type="time"
              value={shiftEnd}
              hint={shiftEnd < shiftStart ? t('staff.nightShift') : undefined}
              onChange={(e) => setShiftEnd(e.target.value)}
            />
          </div>

          {/* --- To'lov modeli --- */}
          <div className="mt-4">
            <Field label={t('staff.payType')} hint={t('staff.payTypeHint')}>
              <div className="flex gap-2">
                {PAY_TYPES.map((type) => {
                  const active = payType === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPayType(type)}
                      className={cn(
                        'h-10 flex-1 rounded-[10px] px-2 text-footnote font-medium',
                        'transition-colors duration-150',
                        active
                          ? 'bg-accent text-white'
                          : 'bg-raised text-label-secondary hover:text-label',
                      )}
                    >
                      {t(`staff.payType.${type}`)}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>

          {/* --- Foiz nisbati --- */}
          {showPercent ? (
            <div className="mt-4 rounded-[12px] bg-raised p-3.5">
              <Field
                label={t('staff.percentRate')}
                hint={t('staff.percentSplitHint', {
                  staff: staffShare,
                  clinic: clinicShare,
                })}
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-28">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={percentRate}
                      onChange={(e) => setPercentRate(e.target.value)}
                      className={cn(
                        'h-10 w-full rounded-[10px] bg-sunken px-3.5 pr-8 text-subhead tnum text-label',
                        'border border-transparent outline-none',
                        'transition-colors duration-150 focus:border-accent',
                      )}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-footnote text-label-tertiary">
                      %
                    </span>
                  </div>

                  {/* Nisbatni ko'rsatuvchi chiziq */}
                  <div className="flex h-10 flex-1 overflow-hidden rounded-[10px]">
                    <div
                      className="flex items-center justify-center bg-accent text-caption font-semibold text-white transition-[width] duration-200"
                      style={{ width: `${staffShare}%` }}
                    >
                      {staffShare >= 15 ? `${staffShare}%` : ''}
                    </div>
                    <div
                      className="flex items-center justify-center bg-fill-3 text-caption font-semibold text-label-secondary transition-[width] duration-200"
                      style={{ width: `${clinicShare}%` }}
                    >
                      {clinicShare >= 15 ? `${clinicShare}%` : ''}
                    </div>
                  </div>
                </div>
              </Field>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {PERCENT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPercentRate(String(preset))}
                    className={cn(
                      'h-8 rounded-full px-3 text-caption font-medium transition-colors duration-150',
                      Number(percentRate) === preset
                        ? 'bg-accent-soft text-accent'
                        : 'bg-fill-4 text-label-secondary hover:text-label',
                    )}
                  >
                    {preset} / {100 - preset}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* --- Stavka va maosh --- */}
          {showSalary ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Select
                label={t('staff.workRate')}
                value={workRate}
                hint={t('staff.workRateHint')}
                onChange={(e) => setWorkRate(e.target.value)}
                options={WORK_RATES.map((rate) => ({
                  value: String(rate),
                  label: `${rate} ${t('staff.rateUnit')}`,
                }))}
              />
              <TextInput
                label={t('staff.salaryFull')}
                type="number"
                inputMode="numeric"
                min={0}
                step={100000}
                suffix="so'm"
                value={salary}
                hint={monthly > 0 ? `${t('staff.monthlyActual')}: ${money(monthly)}` : undefined}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
          ) : null}

          <div className="mt-4">
            <Select
              label={t('common.status')}
              value={status}
              onChange={(e) => setStatus(e.target.value as StaffStatus)}
              options={[
                { value: 'active', label: t('staff.status.active') },
                { value: 'on_leave', label: t('staff.status.on_leave') },
                { value: 'fired', label: t('staff.status.fired') },
              ]}
            />
          </div>
        </section>

        {/* ============ Tizimga kirish ============ */}
        <section
          className={cn(
            'rounded-[14px] p-4 transition-colors duration-200',
            hasAccess ? 'bg-accent-soft' : 'bg-sunken',
          )}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={hasAccess}
              onChange={(e) => setHasAccess(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ios-blue)]"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-subhead font-medium text-label">
                <KeyRound size={15} />
                {t('staff.col.access')}
              </span>
              <span className="mt-0.5 block text-caption text-label-secondary">
                {t('staff.accessHint')}
              </span>
            </span>
          </label>

          {hasAccess ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label={t('staff.login')}
                  required
                  value={login}
                  error={touched ? errors.login : undefined}
                  hint={t('staff.loginHint')}
                  onChange={(e) => setLogin(e.target.value)}
                />
                <Select
                  label={t('staff.role')}
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  options={[
                    { value: 'owner', label: t('role.owner') },
                    { value: 'receptionist', label: t('role.receptionist') },
                    { value: 'doctor', label: t('role.doctor') },
                  ]}
                />
              </div>

              {/* --- Parol --- */}
              <Field
                label={editing ? t('staff.newPassword') : t('auth.password')}
                required={passwordRequired}
                error={touched ? errors.password : undefined}
                hint={editing ? t('staff.passwordKeepHint') : t('staff.passwordHint')}
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      autoComplete="new-password"
                      placeholder={editing ? '••••••••' : ''}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(
                        'h-10 w-full rounded-[10px] bg-raised px-3.5 pr-11 font-mono text-subhead text-label',
                        'border outline-none transition-colors duration-150',
                        touched && errors.password
                          ? 'border-bad'
                          : 'border-transparent focus:border-accent',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={t('action.view')}
                      className="absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-[8px] text-label-tertiary hover:bg-fill-4"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <IconButton
                    label={t('staff.generatePassword')}
                    onClick={() => {
                      setPassword(generatePassword())
                      setShowPassword(true)
                    }}
                    className="bg-raised"
                  >
                    <RefreshCw size={16} />
                  </IconButton>

                  <IconButton
                    label={t('action.more')}
                    disabled={!password}
                    onClick={() => {
                      void navigator.clipboard?.writeText(password)
                      toast.success(t('staff.passwordCopied'))
                    }}
                    className="bg-raised"
                  >
                    <Copy size={16} />
                  </IconButton>
                </div>
              </Field>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={mustChange}
                  onChange={(e) => setMustChange(e.target.checked)}
                  className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[var(--ios-blue)]"
                />
                <span className="text-footnote text-label-secondary">
                  {t('staff.mustChangePassword')}
                </span>
              </label>
            </div>
          ) : null}
        </section>

        <TextArea
          label={t('common.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  )
}

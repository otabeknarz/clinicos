import { useState } from 'react'
import { Check, KeyRound, Pencil, Plus, Trash2, UserRound } from 'lucide-react'

import {
  createMember,
  deleteMember,
  listTeam,
  updateMember,
} from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PhoneInput, TextInput } from '@/components/ui/Form'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateRelative, phone as fmtPhone, phoneToE164 } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { PlatformMember, PlatformPermission } from '@/types/models'

/**
 * Ruxsatlar guruhlarga bo'lingan — shunda tanlash oson bo'ladi.
 *
 * Tartib ataylab og'irlik bo'yicha: eng zararsizdan eng nozikkacha.
 * Ro'yxatning oxiridagi ikkitasi — bemorlar ro'yxati va jamoani
 * boshqarish — hammaga berilmasligi kerak.
 */
const PERMISSION_GROUPS: { key: string; items: PlatformPermission[] }[] = [
  { key: 'clinics', items: ['clinics.view', 'clinics.manage', 'clinics.impersonate'] },
  { key: 'billing', items: ['billing.view', 'billing.manage'] },
  { key: 'data', items: ['data.view', 'registry.doctors', 'registry.patients'] },
  { key: 'team', items: ['team.manage'] },
]

/** Alohida e'tibor talab qiladigan ruxsatlar */
const SENSITIVE: PlatformPermission[] = ['registry.patients', 'team.manage']

/**
 * PLATFORMA JAMOASI.
 *
 * Bu yerda ClinicOS ning o'z xodimlari boshqariladi: kim tizimga
 * kiradi va nimani ko'radi.
 *
 * NEGA MAYDA RUXSATLAR: platformadagi ma'lumotlarning og'irligi bir
 * xil emas. Sotuv menejeriga klinikalar ro'yxati kerak, bemorlar
 * ro'yxati esa kerak emas. Hammaga hamma narsani berish — eng
 * oson va eng xavfli yo'l; bir xodim ketganda butun baza u bilan
 * ketadi.
 */
export function PlatformTeamPage() {
  const { t } = useI18n()
  const toast = useToast()

  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState<PlatformMember | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<PlatformMember | null>(null)

  const { data, loading, error, reload } = useAsync(() => listTeam(), [version])

  async function remove(member: PlatformMember) {
    try {
      await deleteMember(member.id)
      toast.success(t('toast.deleted'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('team.title')}
        subtitle={t('team.subtitle')}
        primaryAction={{
          icon: <Plus size={16} />,
          label: t('team.add'),
          shortLabel: t('action.add'),
          onClick: () => setCreating(true),
        }}
      />

      {error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : loading && !data ? (
        <CardSkeleton className="min-h-64" />
      ) : (data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserRound size={24} strokeWidth={1.75} />}
            title={t('team.empty')}
            description=""
            className="py-12"
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(data ?? []).map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onEdit={() => setEditing(member)}
              onDelete={() => setDeleting(member)}
            />
          ))}
        </div>
      )}

      <MemberModal
        open={creating || editing !== null}
        member={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSaved={() => setVersion((v) => v + 1)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t('team.deleteConfirm')}
        description={deleting?.fullName ?? ''}
        confirmLabel={t('action.delete')}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void remove(deleting)
          setDeleting(null)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: PlatformMember
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()

  return (
    <Card className={cn('min-w-0', !member.isActive && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <Avatar name={member.fullName} size="md" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-headline text-label">{member.fullName}</p>
          <p className="truncate text-footnote text-label-secondary">{member.position}</p>
        </div>

        <div className="flex shrink-0 gap-1">
          <IconButton label={t('action.edit')} onClick={onEdit}>
            <Pencil size={15} />
          </IconButton>
          <IconButton label={t('action.delete')} className="hover:text-bad" onClick={onDelete}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5">
        <dd className="truncate text-footnote text-label">{member.email}</dd>
        <dd className="text-footnote tnum text-label-secondary">
          {fmtPhone(member.phone)}
        </dd>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={member.isActive ? 'ok' : 'neutral'} dot>
          {t(member.isActive ? 'team.active' : 'team.inactive')}
        </Badge>

        {member.lastActiveAt ? (
          <span className="text-caption text-label-tertiary">
            {dateRelative(member.lastActiveAt)}
          </span>
        ) : (
          <span className="text-caption text-label-tertiary">{t('team.neverSignedIn')}</span>
        )}
      </div>

      {/* --- Ruxsatlar --- */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {member.permissions.length === 0 ? (
          <span className="text-caption text-label-quaternary">{t('team.noAccess')}</span>
        ) : (
          member.permissions.map((permission) => (
            <span
              key={permission}
              className={cn(
                'inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-caption-2 font-medium',
                SENSITIVE.includes(permission)
                  ? 'bg-warn-soft text-warn'
                  : 'bg-fill-4 text-label-secondary',
              )}
            >
              {SENSITIVE.includes(permission) ? <KeyRound size={10} /> : null}
              {t(`team.perm.${permission}`)}
            </span>
          ))
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function MemberModal({
  open,
  member,
  onClose,
  onSaved,
}: {
  open: boolean
  member: PlatformMember | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('+998 ')
  const [position, setPosition] = useState('')
  const [permissions, setPermissions] = useState<PlatformPermission[]>([])
  const [isActive, setIsActive] = useState(true)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState<string | null>(null)

  // Forma qiymatlarini tahrirlanayotgan xodimdan olamiz
  const formKey = member?.id ?? (open ? 'new' : null)
  if (open && ready !== formKey) {
    setReady(formKey)
    setTouched(false)
    setFullName(member?.fullName ?? '')
    setEmail(member?.email ?? '')
    setPhone(member?.phone ?? '+998 ')
    setPosition(member?.position ?? '')
    setPermissions(member?.permissions ?? [])
    setIsActive(member?.isActive ?? true)
  }

  const errors = {
    name: !fullName.trim() ? t('valid.required') : undefined,
    email: !email.trim() ? t('valid.required') : undefined,
  }
  const valid = !errors.name && !errors.email

  function toggle(permission: PlatformPermission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    )
  }

  async function submit() {
    setTouched(true)
    if (!valid) return

    setSaving(true)
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phoneToE164(phone),
        position: position.trim(),
        permissions,
        isActive,
      }

      if (member) await updateMember(member.id, payload)
      else await createMember(payload)

      toast.success(t(member ? 'toast.saved' : 'toast.created'))
      onSaved()
      onClose()
      setReady(null)
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? t('team.edit') : t('team.add')}
      description={t('team.modalHint')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} onClick={submit}>
            {t(member ? 'action.save' : 'action.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <TextInput
          label={t('patientForm.fullName')}
          required
          value={fullName}
          error={touched ? errors.name : undefined}
          onChange={(e) => setFullName(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t('common.email')}
            type="email"
            required
            hint={t('team.emailHint')}
            value={email}
            error={touched ? errors.email : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />

          <PhoneInput label={t('common.phone')} value={phone} onChange={setPhone} />
        </div>

        <TextInput
          label={t('team.position')}
          placeholder={t('team.positionPh')}
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />

        {/* --- Ruxsatlar --- */}
        <div>
          <p className="text-footnote font-medium text-label">{t('team.permissions')}</p>
          <p className="mt-0.5 text-caption text-label-tertiary">
            {t('team.permissionsHint')}
          </p>

          <div className="mt-3 space-y-4">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.key}>
                <p className="text-caption-2 font-semibold uppercase tracking-wide text-label-tertiary">
                  {t(`team.group.${group.key}`)}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {group.items.map((permission) => {
                    const on = permissions.includes(permission)
                    const sensitive = SENSITIVE.includes(permission)

                    return (
                      <button
                        key={permission}
                        type="button"
                        onClick={() => toggle(permission)}
                        title={t(`team.permHint.${permission}`)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5',
                          'text-caption font-medium transition-colors duration-150',
                          on
                            ? sensitive
                              ? 'bg-warn text-white'
                              : 'bg-accent-soft text-accent'
                            : 'bg-fill-4 text-label-secondary hover:bg-fill-3',
                        )}
                      >
                        {on ? <Check size={12} strokeWidth={3} /> : null}
                        {sensitive && !on ? <KeyRound size={11} /> : null}
                        {t(`team.perm.${permission}`)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- Holat --- */}
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-[12px] bg-sunken px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-footnote font-medium text-label">
              {t('team.accessTitle')}
            </span>
            <span className="block text-caption text-label-tertiary">
              {t('team.accessHint')}
            </span>
          </span>
          <Badge tone={isActive ? 'ok' : 'neutral'} dot>
            {t(isActive ? 'team.active' : 'team.inactive')}
          </Badge>
        </button>
      </div>
    </Modal>
  )
}

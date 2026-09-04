import { useState } from 'react'
import { Gift, KeyRound, Star, UserPlus, Users } from 'lucide-react'

import { listStaff } from '@/api/staff'
import { PageHeader } from '@/components/layout/PageHeader'
import { AttendanceTab } from './staff/AttendanceTab'
import { PenaltiesTab } from './staff/PenaltiesTab'
import { BonusesTab } from './staff/BonusesTab'
import { StaffListTab } from './staff/StaffListTab'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/KpiCard'
import { Tabs } from '@/components/ui/Tabs'
import { moneyShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { effectiveSalary } from '@/types/models'

type Tab = 'list' | 'attendance' | 'bonuses' | 'penalties'

/**
 * Xodimlar bo'limi — egasi uchun.
 *
 * Uchta tab: shtat ro'yxati, davomat jadvali va bonuslar. Hammasi bitta
 * joyda, chunki egasi uchun bular bir savolning uch tomoni: "kim qanday
 * ishlayapti va unga qancha to'layapman?"
 */
export function StaffPage() {
  const { t } = useI18n()
  const { can } = useAuth()

  const [tab, setTab] = useState<Tab>('list')
  const [formOpen, setFormOpen] = useState(false)
  const [version, setVersion] = useState(0)

  const { data, loading } = useAsync(() => listStaff(), [version])

  const rows = data ?? []
  const activeCount = rows.filter((s) => s.status === 'active').length
  const accessCount = rows.filter((s) => s.hasSystemAccess).length

  /**
   * Oylik fond = maoshlar + foizli daromadlar + bonuslar.
   *
   * Foizli modelda ishlayotgan xodimning "maoshi" yo'q - uning daromadi
   * o'zi keltirgan tushumdan kelib chiqadi. Fondni hisoblashda buni
   * e'tiborsiz qoldirsak, real xarajat ko'rinmay qoladi.
   */
  const payroll = rows
    .filter((s) => s.status !== 'fired')
    .reduce((sum, s) => sum + effectiveSalary(s) + s.performance.percentEarnings, 0)

  const bonusTotal = rows.reduce((sum, s) => sum + s.performance.bonusThisPeriod, 0)

  const rated = rows.filter((s) => s.performance.rating !== null)
  const averageRating = rated.length
    ? rated.reduce((sum, s) => sum + (s.performance.rating ?? 0), 0) / rated.length
    : null

  return (
    <>
      <PageHeader
        title={t('staff.title')}
        subtitle={loading ? undefined : t('staff.subtitle', { count: rows.length })}
        primaryAction={
          can('staff.manage')
            ? {
                icon: <UserPlus size={16} />,
                label: t('staff.add'),
                shortLabel: t('action.add'),
                onClick: () => {
                  // Forma faqat ro'yxat tabida mavjud - avval o'sha yerga o'tamiz,
                  // aks holda tugma bosilgani bilan hech narsa ochilmaydi
                  setTab('list')
                  setFormOpen(true)
                },
              }
            : undefined
        }
      />

      {/* --- Yuqori ko'rsatkichlar --- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          loading={loading}
          icon={<Users size={14} />}
          tone="accent"
          label={t('staff.status.active')}
          value={String(activeCount)}
        />
        <StatCard
          loading={loading}
          icon={<Star size={14} />}
          tone="brand"
          label={t('staff.rating')}
          value={averageRating !== null ? averageRating.toFixed(1) : '—'}
        />
        <StatCard
          loading={loading}
          icon={<KeyRound size={14} />}
          tone="neutral"
          label={t('staff.col.access')}
          value={String(accessCount)}
        />
        <StatCard
          loading={loading}
          icon={<Gift size={14} />}
          tone="ok"
          label={t('staff.payrollTotal')}
          value={moneyShort(payroll + bonusTotal)}
        />
      </div>

      <Card padded={false} className="mt-5">
        <div className="hairline px-5 pt-4 sm:px-6">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'list', label: t('staff.title') },
              ...(can('attendance.view')
                ? [{ value: 'attendance' as const, label: t('attendance.title') }]
                : []),
              ...(can('bonus.manage')
                ? [{ value: 'bonuses' as const, label: t('bonus.title') }]
                : []),
              ...(can('staff.manage')
                ? [{ value: 'penalties' as const, label: t('penalty.title') }]
                : []),
            ]}
          />
        </div>

        {tab === 'list' ? (
          <StaffListTab
            formOpen={formOpen}
            onFormOpenChange={setFormOpen}
            onDataChange={() => setVersion((v) => v + 1)}
          />
        ) : null}

        {tab === 'attendance' ? <AttendanceTab /> : null}

        {tab === 'penalties' ? <PenaltiesTab /> : null}

        {tab === 'bonuses' ? (
          <BonusesTab onDataChange={() => setVersion((v) => v + 1)} />
        ) : null}
      </Card>
    </>
  )
}

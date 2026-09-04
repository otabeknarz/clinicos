/**
 * Xodimlar, davomat va bonuslar uchun demo ma'lumot.
 */

import type { Random } from './random'
import { addDays, toISODate } from '@/lib/dates'
import type {
  Attendance,
  AttendanceStatus,
  Bonus,
  BonusRule,
  Doctor,
  PayType,
  Staff,
  StaffPosition,
  User,
} from '@/types/models'

/* ================================================================== */
/* SHTAT JADVALI                                                      */
/* ================================================================== */

interface StaffPlan {
  position: StaffPosition
  title: string
  count: number
  /** To'liq stavkadagi maosh */
  salary: number
  department: string
  shiftStart: string
  shiftEnd: string
  workdays: number[]
}

const WEEKDAYS = [1, 2, 3, 4, 5]
const WITH_SATURDAY = [1, 2, 3, 4, 5, 6]
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

const STAFF_PLAN: StaffPlan[] = [
  {
    position: 'nurse',
    title: 'Hamshira',
    count: 6,
    salary: 4_500_000,
    department: 'Tibbiyot',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    workdays: WITH_SATURDAY,
  },
  {
    position: 'nurse',
    title: 'Bosh hamshira',
    count: 1,
    salary: 6_500_000,
    department: 'Tibbiyot',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    workdays: WEEKDAYS,
  },
  {
    position: 'lab_tech',
    title: 'Laborant',
    count: 2,
    salary: 5_000_000,
    department: 'Laboratoriya',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    workdays: WITH_SATURDAY,
  },
  {
    position: 'accountant',
    title: 'Buxgalter',
    count: 1,
    salary: 8_000_000,
    department: 'Moliya',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    workdays: WEEKDAYS,
  },
  {
    position: 'manager',
    title: 'Xo‘jalik mudiri',
    count: 1,
    salary: 7_000_000,
    department: 'Xo‘jalik',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    workdays: WEEKDAYS,
  },
  {
    position: 'cleaner',
    title: 'Farrosh',
    count: 4,
    salary: 3_000_000,
    department: 'Xo‘jalik',
    shiftStart: '07:00',
    shiftEnd: '15:00',
    workdays: WITH_SATURDAY,
  },
  {
    position: 'security',
    title: 'Qorovul',
    count: 3,
    salary: 3_500_000,
    department: 'Xavfsizlik',
    shiftStart: '20:00',
    shiftEnd: '08:00',
    workdays: EVERY_DAY,
  },
  {
    position: 'driver',
    title: 'Haydovchi',
    count: 1,
    salary: 4_000_000,
    department: 'Xo‘jalik',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    workdays: WEEKDAYS,
  },
]

export function generateStaff(
  r: Random,
  clinicId: string,
  today: Date,
  doctors: Doctor[],
  users: User[],
  maleNames: readonly string[],
  femaleNames: readonly string[],
  surnames: readonly string[],
  makePhone: () => string,
): Staff[] {
  const iso = (d: Date) => d.toISOString()
  const staff: Staff[] = []
  let seq = 0

  const push = (row: Omit<Staff, 'id' | 'clinicId' | 'createdAt'>) => {
    seq++
    staff.push({
      id: `stf_${seq}`,
      clinicId,
      createdAt: iso(addDays(today, -r.int(30, 700))),
      ...row,
    })
  }

  /* --- Egasi --- */
  const owner = users.find((u) => u.role === 'owner')
  if (owner) {
    push({
      fullName: owner.fullName,
      phone: owner.phone,
      email: owner.email,
      position: 'manager',
      positionTitle: 'Klinika egasi',
      department: 'Boshqaruv',
      workdays: WEEKDAYS,
      shiftStart: '09:00',
      shiftEnd: '18:00',
      workRate: 1,
      payType: 'salary',
      percentRate: 0,
      salary: 0,
      hiredAt: toISODate(addDays(today, -400)),
      status: 'active',
      hasSystemAccess: true,
      role: 'owner',
      login: owner.email,
      credentialsSetAt: iso(addDays(today, -400)),
      mustChangePassword: false,
      doctorId: null,
      avatarUrl: null,
      notes: '',
    })
  }

  /* --- Shifokorlar --- */
  for (const doctor of doctors) {
    push({
      fullName: doctor.fullName,
      phone: doctor.phone,
      email: doctor.email,
      position: 'doctor',
      positionTitle: 'Shifokor',
      department: 'Tibbiyot',
      workdays: doctor.workdays,
      shiftStart: doctor.shiftStart,
      shiftEnd: doctor.shiftEnd,
      // Ba'zi shifokorlar yarim stavkada ishlaydi
      workRate: r.weighted<number>([
        [1, 6],
        [0.5, 2],
        [1.5, 1],
      ]),
      // O'zbekistonda shifokorlar ko'pincha foiz evaziga ishlaydi:
      // tushumning 30-40% i shifokorga, qolgani klinikaga.
      payType: r.weighted<PayType>([
        ['percent', 4],
        ['salary_percent', 3],
        ['salary', 3],
      ]),
      percentRate: r.weighted<number>([
        [30, 4],
        [35, 3],
        [40, 2],
        [25, 1],
      ]),
      salary: r.int(9, 18) * 1_000_000,
      hiredAt: doctor.hiredAt,
      status: doctor.status === 'on_leave' ? 'on_leave' : 'active',
      hasSystemAccess: true,
      role: 'doctor',
      login: doctor.email,
      credentialsSetAt: doctor.createdAt,
      mustChangePassword: false,
      doctorId: doctor.id,
      avatarUrl: null,
      notes: '',
    })
  }

  /* --- Administratorlar --- */
  for (const user of users.filter((u) => u.role === 'receptionist')) {
    push({
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      position: 'receptionist',
      positionTitle: 'Administrator',
      department: 'Registratura',
      workdays: WITH_SATURDAY,
      shiftStart: '08:00',
      shiftEnd: '19:00',
      workRate: 1,
      payType: 'salary',
      percentRate: 0,
      salary: 5_500_000,
      hiredAt: toISODate(addDays(today, -r.int(120, 400))),
      status: 'active',
      hasSystemAccess: true,
      role: 'receptionist',
      login: user.email,
      credentialsSetAt: user.createdAt,
      mustChangePassword: false,
      doctorId: null,
      avatarUrl: null,
      notes: '',
    })
  }

  /* --- Qolgan shtat --- */
  for (const plan of STAFF_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      const female = r.chance(
        plan.position === 'nurse' || plan.position === 'cleaner' ? 0.9 : 0.2,
      )
      const first = female ? r.pick(femaleNames) : r.pick(maleNames)
      const stem = r.pick(surnames)

      push({
        fullName: `${first} ${stem}${female ? 'ova' : 'ov'}`,
        phone: makePhone(),
        email: '',
        position: plan.position,
        positionTitle: plan.title,
        department: plan.department,
        workdays: plan.workdays,
        shiftStart: plan.shiftStart,
        shiftEnd: plan.shiftEnd,
        workRate: r.weighted<number>([
          [1, 8],
          [0.5, 2],
        ]),
        // Laborant tahlillardan foiz olishi mumkin, qolganlari - oylik
        payType: plan.position === 'lab_tech' && r.chance(0.5) ? 'salary_percent' : 'salary',
        percentRate: plan.position === 'lab_tech' ? 15 : 0,
        salary: plan.salary,
        hiredAt: toISODate(addDays(today, -r.int(20, 600))),
        status: r.chance(0.06) ? 'on_leave' : 'active',
        // Farrosh, qorovul, haydovchiga login kerak emas
        hasSystemAccess: false,
        role: null,
        login: '',
        credentialsSetAt: null,
        mustChangePassword: false,
        doctorId: null,
        avatarUrl: null,
        notes: '',
      })
    }
  }

  return staff
}

/* ================================================================== */
/* DAVOMAT                                                            */
/* ================================================================== */

/**
 * Kunlik davomat.
 *
 * Har bir xodimning o'z "intizom darajasi" bor: ko'pchilik deyarli
 * hech qachon kechikmaydi, bir-ikkitasi tez-tez kechikadi. Shu tufayli
 * reyting jadvalida haqiqiy farq ko'rinadi.
 */
export function generateAttendance(
  r: Random,
  clinicId: string,
  today: Date,
  staff: Staff[],
  days: number,
): Attendance[] {
  const rows: Attendance[] = []
  let seq = 0

  for (const person of staff) {
    if (person.status === 'fired') continue

    // Xodimning intizom darajasi: 0 = juda tartibli, 1 = tez-tez kechikadi.
    // Taqsimot ataylab keng - aks holda hamma bir xil "a'lo" bo'lib
    // chiqadi va reyting hech narsani ajratmaydi.
    const sloppiness = r.weighted<number>([
      [0.03, 2],
      [0.1, 4],
      [0.2, 4],
      [0.35, 2],
      [0.5, 1],
    ])

    for (let offset = -days; offset <= 0; offset++) {
      const day = addDays(today, offset)
      const date = toISODate(day)
      const isWorkday = person.workdays.includes(day.getDay())

      let status: AttendanceStatus = 'day_off'
      let lateMinutes = 0
      let workedMinutes = 0
      let checkInAt: string | null = null
      let checkOutAt: string | null = null

      if (isWorkday && person.status === 'active') {
        const roll = r.next()

        if (roll < sloppiness * 0.25) {
          status = 'absent'
        } else if (roll < sloppiness * 0.35) {
          status = 'excused'
        } else if (roll < sloppiness) {
          status = 'late'
          lateMinutes = r.int(5, 45)
        } else {
          status = 'present'
        }

        if (status === 'present' || status === 'late') {
          const [h, m] = person.shiftStart.split(':').map(Number)
          const start = new Date(day)
          start.setHours(h, m + lateMinutes, 0, 0)

          const [eh, em] = person.shiftEnd.split(':').map(Number)
          const end = new Date(day)
          // Tungi smena (qorovul) ertasi kuni tugaydi
          if (eh < h) end.setDate(end.getDate() + 1)
          end.setHours(eh, em, 0, 0)

          checkInAt = start.toISOString()
          checkOutAt = end.toISOString()
          workedMinutes = Math.max(
            0,
            Math.round((end.getTime() - start.getTime()) / 60_000),
          )
        }
      } else if (person.status === 'on_leave' && isWorkday) {
        status = 'excused'
      }

      // Kelish vaqti — smena boshi + kechikish
      let arrivedAt: string | null = null
      if (status === 'present' || status === 'late') {
        const [h, m] = person.shiftStart.split(':').map(Number)
        const total = h * 60 + m + lateMinutes
        arrivedAt = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(
          total % 60,
        ).padStart(2, '0')}`
      }

      /**
       * Demo uchun bir nechta shubhali yozuv: kelish vaqti odam
       * kelgan paytda emas, bir necha soatdan keyin yozilgan.
       * Egasi bunday holatlarni ko'rishi kerak — shuning uchun
       * namunada ham bo'lsin.
       */
      const flagged = status === 'late' && lateMinutes > 25 && r.chance(0.18)

      /*
        Yozuv tizimga qachon kiritilgani. Odatiy holda — kelish
        vaqtining o'zi. Shubhali yozuvda esa bir necha soat keyin:
        aynan shu farq uni bayroqlaydi.
      */
      const markedAt = checkInAt
        ? new Date(
            new Date(checkInAt).getTime() + (flagged ? r.int(3, 7) * 60 : 2) * 60_000,
          ).toISOString()
        : day.toISOString()

      seq++
      rows.push({
        id: `att_${seq}`,
        clinicId,
        staffId: person.id,
        date,
        status,
        checkInAt,
        checkOutAt,
        arrivedAt,
        lateMinutes,
        workedMinutes,
        note: '',
        markedBy: 'usr_reception_1',
        markedByName: 'Kamola Sobirova',
        markedAt,
        flagged,
        flagReason: flagged ? 'backdated' : '',
        createdAt: day.toISOString(),
      })
    }
  }

  return rows
}

/* ================================================================== */
/* BONUS QOIDALARI VA BONUSLAR                                        */
/* ================================================================== */

export function generateBonusRules(clinicId: string, today: Date): BonusRule[] {
  const iso = addDays(today, -200).toISOString()

  return [
    {
      id: 'brl_1',
      clinicId,
      name: 'Shifokor rejasi bajarilgani uchun',
      positions: ['doctor'],
      minPerformance: 100,
      minRating: 0,
      rewardType: 'percent_of_salary',
      rewardValue: 10,
      isActive: true,
      createdAt: iso,
    },
    {
      id: 'brl_2',
      clinicId,
      name: 'Yuqori reyting uchun',
      positions: [],
      minPerformance: 0,
      minRating: 4.5,
      rewardType: 'fixed',
      rewardValue: 500_000,
      isActive: true,
      createdAt: iso,
    },
    {
      id: 'brl_3',
      clinicId,
      name: 'Kassa aniqligi uchun',
      positions: ['receptionist'],
      minPerformance: 95,
      minRating: 0,
      rewardType: 'fixed',
      rewardValue: 700_000,
      isActive: true,
      createdAt: iso,
    },
  ]
}

/** O'tgan oylardagi to'langan bonuslar — tarix ko'rinib tursin */
export function generateBonuses(
  r: Random,
  clinicId: string,
  today: Date,
  staff: Staff[],
): Bonus[] {
  const rows: Bonus[] = []
  let seq = 0

  const active = staff.filter((s) => s.status === 'active' && s.salary > 0)

  for (let monthsBack = 1; monthsBack <= 3; monthsBack++) {
    const month = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1)
    const period = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    const paidAt = new Date(month.getFullYear(), month.getMonth() + 1, 5).toISOString()

    for (const person of active) {
      if (!r.chance(0.3)) continue

      seq++
      rows.push({
        id: `bns_${seq}`,
        clinicId,
        staffId: person.id,
        staffName: person.fullName,
        period,
        amount: r.int(3, 12) * 100_000,
        reason: r.pick(BONUS_REASONS),
        source: r.chance(0.6) ? 'rule' : 'manual',
        ruleId: null,
        status: 'paid',
        createdBy: 'usr_owner',
        createdAt: paidAt,
        paidAt,
      })
    }
  }

  return rows
}

const BONUS_REASONS = [
  'Oylik reja bajarilgani uchun',
  'Bemorlarning yuqori bahosi uchun',
  'Qo‘shimcha smenalar uchun',
  'Kassada kamomad bo‘lmagani uchun',
  'Intizom va davomat uchun',
]

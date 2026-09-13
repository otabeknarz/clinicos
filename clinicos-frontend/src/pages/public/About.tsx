import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { Lang } from '@/pages/public/about-i18n'
import { Icon } from './PublicIcons'
import type { PublicIconName } from './PublicIcons'
import { AudienceSwitch, FaqList, FeatureGrid, StartSteps, StoryShell } from './StoryShell'
import { useDemoChange } from './story-motion'

/**
 * KLINIKALAR UCHUN TAQDIMOT — `/about/klinika`.
 *
 * SOTUV TAQDIMOTI: mijoz o'zi kirib, uchrashuvda beriladigan savollarga
 * javobni shu yerdan o'qiydi, sotuvchi esa yangi mijozga shu sahifa
 * bilan tushuntiradi. Shuning uchun faqat tizimda HAQIQATDA bor
 * narsa yoziladi — va'da ertasiga mijozning savoliga aylanadi.
 *
 * Foydalanuvchi tasdiqlagan yakuniy dizayn (3-variant), prototipdan
 * aynan ko'chirilgan: kompozitsiya, o'lchamlar, animatsiyalar.
 * Uslublar `story.css` da va `.story-page` ichiga cheklangan.
 *
 * SAHIFADAGI ISMLAR, SUMMALAR VA GRAFIKLAR — NAMUNA. Ular mahsulot
 * nima qilishini ko'rsatish uchun, haqiqiy mijoz yoki natija emas;
 * har bir blokda buni aytuvchi "Demo" yozuvi bor va olib tashlanmasin.
 *
 * Uch tilda: matn JSX da o'zbekcha turadi, tarjimasi `about-i18n.tsx` da.
 */

type Scene = 'owner' | 'reception' | 'doctor'
type Step = 'appointment' | 'visit' | 'payment'

const SCENES: Record<Scene, { name: string; initials: string; nav: number }> = {
  owner: { name: 'Klinika egasi', initials: 'KE', nav: 0 },
  reception: { name: 'Registrator', initials: 'RG', nav: 1 },
  doctor: { name: 'Shifokor', initials: 'SH', nav: 3 },
}

const REGISTER = '/login?mode=register'

const SIDE_NAV: { icon: PublicIconName; label: string }[] = [
  { icon: 'grid', label: 'Bosh sahifa' },
  { icon: 'calendar', label: 'Qabullar' },
  { icon: 'users', label: 'Bemorlar' },
  { icon: 'doctor', label: 'Shifokorlar' },
  { icon: 'wallet', label: 'To‘lovlar' },
  { icon: 'chart', label: 'Hisobotlar' },
]

export function ClinicAboutPage() {
  const dashboard = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)

  const [scene, setScene] = useState<Scene>('owner')
  const [step, setStep] = useState<Step>('appointment')

  useDemoChange(scene, dashboard)
  useDemoChange(step, flow)

  const current = SCENES[scene]

  return (
    <StoryShell
      title="Klinikangizga tartib. Sizga xotirjamlik."
      registerTo={REGISTER}
      nav={[
        { href: '#imkoniyatlar', label: 'Imkoniyatlar' },
        { href: '#bemor', label: 'Bemorlar uchun' },
        { href: '#nazorat', label: 'Moliya nazorati' },
        { href: '#savollar', label: 'Savollar' },
      ]}
    >
      <Lang>
        <>
          {/* ================= HERO ================= */}
          <section className="v3-hero" aria-labelledby="v3-title">
            <div className="v3-wrap">
              <div className="v3-hero-heading">
                <AudienceSwitch current="clinic" />
                <span className="v3-label">Xususiy klinikalar uchun yaratilgan</span>
                <h1 id="v3-title">
                  Klinikangizga tartib.
                  <br />
                  Sizga <span className="v3-highlight">xotirjamlik.</span>
                </h1>
                <p>
                  Qabullar, bemorlar, jamoa va moliya — bir tizimda.
                  <br />
                  Klinikangizdagi har bir jarayonni aniq ko‘rib boring.
                </p>
                <div className="v3-hero-actions">
                  <Link className="button" to={REGISTER}>
                    14 kun bepul sinash <Icon name="arrow" />
                  </Link>
                  <a className="button light" href="#demo">
                    Tizimni ko‘rib chiqish
                  </a>
                </div>
                <span className="v3-hero-annotation">
                  Klinikangizning
                  <br />
                  yangi ish tartibi.
                </span>
              </div>

              <div className="v3-workspace" id="demo">
                <div className="v3-rolebar">
                  <span className="v3-demo-label">
                    <Icon name="grid" /> Bir klinika. Har kimga o‘z ish joyi.
                  </span>
                  <div className="v3-role-picker" role="group" aria-label="Demo uchun rolni tanlang">
                    <RoleButton value="owner" icon="chart" current={scene} onPick={setScene}>
                      Klinika egasi
                    </RoleButton>
                    <RoleButton value="reception" icon="calendar" current={scene} onPick={setScene}>
                      Registrator
                    </RoleButton>
                    <RoleButton value="doctor" icon="doctor" current={scene} onPick={setScene}>
                      Shifokor
                    </RoleButton>
                  </div>
                </div>

                <div className="v3-console">
                  <aside className="v3-side" aria-label="Mahsulot menyusi namunasi">
                    <div className="v3-side-logo">
                      <Icon name="pulse" /> ClinicOS
                    </div>
                    <div className="v3-side-section">KLINIKA BOSHQARUVI</div>
                    <div className="v3-side-nav">
                      {SIDE_NAV.map((item, index) => (
                        <div key={item.label} className={index === current.nav ? 'active' : ''}>
                          <Icon name={item.icon} />
                          {item.label}
                        </div>
                      ))}
                    </div>
                    <div className="v3-side-person">
                      <span className="v3-avatar">{current.initials}</span>
                      <div>
                        <span>{current.name}</span>
                        <small>Namunaviy ish joyi</small>
                      </div>
                    </div>
                  </aside>
                  <div
                    ref={dashboard}
                    className="v3-console-main"
                    id="v3Dashboard"
                    role="region"
                    aria-label="Tanlangan rolning ish joyi"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {scene === 'owner' ? <OwnerScene /> : null}
                    {scene === 'reception' ? <ReceptionScene /> : null}
                    {scene === 'doctor' ? <DoctorScene /> : null}
                  </div>
                </div>

                <div className="v3-under-console">
                  <span>Rollarni almashtirib, ish joylari bilan tanishing. Bu — demo.</span>
                  <Link to="/login">Hisobingiz bormi? Kirish ↗</Link>
                </div>
              </div>

              <div className="v3-trust">
                <span>
                  <Icon name="globe" /> O‘zbek · Русский · English
                </span>
                <span>
                  <Icon name="telegram" /> Telegram bilan bog‘langan
                </span>
                <span>
                  <Icon name="shield" /> Rollar bo‘yicha kirish
                </span>
                <span>
                  <Icon name="pulse" /> Qabuldan kassagacha
                </span>
              </div>
            </div>
          </section>

          {/* ================= IMKONIYATLAR ================= */}
          <section className="v3-section" id="imkoniyatlar" aria-labelledby="v3-features-title">
            <div className="v3-wrap">
              <div className="v3-section-heading">
                <div>
                  <span className="v3-label">Bitta tizim. Butun klinika.</span>
                  <h2 id="v3-features-title">
                    Har bir ishga —
                    <br />
                    o‘z yechimi.
                  </h2>
                </div>
                <p>
                  Klinika hayoti ko‘p jarayondan iborat. ClinicOS ularni bitta tushunarli ish
                  tartibiga birlashtiradi.
                </p>
              </div>

              <div className="v3-bento">
                <article className="v3-card v3-calendar-card">
                  <div className="v3-card-copy">
                    <div className="v3-card-tag">
                      <Icon name="calendar" /> Qabul va jadval
                    </div>
                    <h3>
                      Navbat tartibli.
                      <br />
                      Qabul o‘z vaqtida.
                    </h3>
                    <p>
                      Shifokorlar jadvalini bir ekranda ko‘ring. Har bir bemorga kerakli vaqtni
                      ajrating.
                    </p>
                  </div>
                  <div className="v3-calendar-art">
                    <div className="v3-schedule">
                      <div className="v3-schedule-top">
                        Bugungi qabullar <span>11-sentabr · Demo</span>
                      </div>
                      <ScheduleGrid long />
                    </div>
                  </div>
                </article>

                <article className="v3-card v3-telegram-card">
                  <div className="v3-card-copy">
                    <div className="v3-card-tag">
                      <Icon name="telegram" /> Telegram integratsiyasi
                    </div>
                    <h3>
                      Kerakli xabar.
                      <br />
                      Kerakli odamga.
                    </h3>
                    <p>
                      Yangi qabul haqida shifokor telefonidan xabar oladi. Tugmani bossa — ko‘rik
                      formasi ochiladi.
                    </p>
                  </div>
                  <div className="v3-telegram-art">
                    <div className="v3-phone-msg">
                      <div className="v3-msg-head">
                        <Icon name="telegram" />
                        <div>
                          ClinicOS<small>Yangi qabul · Namuna</small>
                        </div>
                      </div>
                      <p>
                        <strong>Madina Rasulova</strong>
                        <br />
                        Terapevt ko‘rigi
                        <br />
                        Bugun, soat 09:00
                      </p>
                      <div className="v3-msg-action">Tashrifni ko‘rish ↗</div>
                    </div>
                  </div>
                </article>

                <article className="v3-card v3-patient-card">
                  <div className="v3-card-copy">
                    <div className="v3-card-tag">
                      <Icon name="users" /> Bemor profili
                    </div>
                    <h3>
                      Tarix bor.
                      <br />
                      Tasavvur to‘liq.
                    </h3>
                    <p>
                      Avvalgi tashriflar, tashxis, rentgen suratlari va to‘lovlar — bemorning
                      yagona profilida.
                    </p>
                  </div>
                  <div className="v3-record">
                    <div className="v3-record-head">
                      <span className="v3-avatar">MR</span>
                      <div>
                        Madina Rasulova<small>Bemor kartasi · Demo</small>
                      </div>
                    </div>
                    <div className="v3-record-line">
                      11-sentabr<strong>Terapevt ko‘rigi</strong>
                    </div>
                    <div className="v3-record-line">
                      4-sentabr<strong>Qayta konsultatsiya</strong>
                    </div>
                    <div className="v3-record-line">
                      28-avgust<strong>Birlamchi tashrif</strong>
                    </div>
                  </div>
                </article>

                <article className="v3-card v3-permissions-card">
                  <div className="v3-card-copy">
                    <div className="v3-card-tag">
                      <Icon name="shield" /> Jamoa va ruxsatlar
                    </div>
                    <h3>
                      Har kim o‘z
                      <br />
                      ishini ko‘radi.
                    </h3>
                    <p>
                      Shifokor ko‘rik yozadi, registrator to‘lov oladi, siz nazorat qilasiz. Hech
                      kim o‘z ishini o‘zi tekshirmaydi.
                    </p>
                  </div>
                  <div className="v3-permissions">
                    <div className="v3-role-chip">
                      <Icon name="chart" />
                      <strong>Klinika egasi</strong>
                      <small>Nazorat qiladi</small>
                    </div>
                    <div className="v3-role-chip">
                      <Icon name="calendar" />
                      <strong>Registrator</strong>
                      <small>To‘lov oladi</small>
                    </div>
                    <div className="v3-role-chip">
                      <Icon name="doctor" />
                      <strong>Shifokor</strong>
                      <small>Ko‘rik yozadi</small>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>

          {/* ================= JARAYON ================= */}
          <section className="v3-section v3-process" id="jarayon" aria-labelledby="v3-process-title">
            <div className="v3-wrap v3-process-grid">
              <div className="v3-process-copy">
                <span className="v3-label">Bemorning bitta tashrifi</span>
                <h2 id="v3-process-title">
                  Uch bosqich.
                  <br />
                  Uzluksiz jarayon.
                </h2>
                <p>
                  Bosqichni tanlang va qabuldan to‘lovgacha ma’lumotlar qanday bog‘lanishini
                  ko‘ring.
                </p>
                <div className="v3-steps" role="group" aria-label="Tashrif bosqichini tanlang">
                  <StepButton value="appointment" number="01" current={step} onPick={setStep}>
                    <strong>Qabulga yozish</strong>
                    <small>Registrator vaqtni belgilaydi</small>
                  </StepButton>
                  <StepButton value="visit" number="02" current={step} onPick={setStep}>
                    <strong>Ko‘rikni qayd etish</strong>
                    <small>Shifokor tashrifni yozadi</small>
                  </StepButton>
                  <StepButton value="payment" number="03" current={step} onPick={setStep}>
                    <strong>To‘lovni qabul qilish</strong>
                    <small>Registrator tushumni qayd etadi</small>
                  </StepButton>
                </div>
              </div>
              <div className="v3-process-stage">
                <div
                  ref={flow}
                  className="v3-flow-card"
                  id="v3Flow"
                  role="region"
                  aria-label="Tanlangan tashrif bosqichi"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <Flow step={step} />
                </div>
              </div>
            </div>
          </section>

          {/* ================= BEMOR UCHUN ================= */}
          <section className="v3-section" id="bemor" aria-labelledby="lx-patient-title">
            <div className="v3-wrap lx-split">
              <div className="lx-split-copy">
                <span className="v3-label">Bemor kelmay qolmasin</span>
                <h2 id="lx-patient-title">
                  Eslatma o‘zi boradi.
                  <br />
                  Bemor o‘zi tasdiqlaydi.
                </h2>
                <p>
                  Qabuldan 3 kun va 1 kun oldin bemorga Telegram orqali eslatma yuboriladi.
                  «Qabul qildim» tugmasini bossa, registraturada qabul tasdiqlangan bo‘lib
                  ko‘rinadi.
                </p>
                <ul className="lx-points light">
                  <li>
                    <Icon name="phone" /> Bemor kabineti: tashriflar tarixi va qarzi — telefonida
                  </li>
                  <li>
                    <Icon name="star" /> Tashrifdan keyin anonim izoh — shifokor reytingiga qo‘shiladi
                  </li>
                  <li>
                    <Icon name="shield" /> Raqam Telegram orqali tasdiqlanadi — begona odam kira olmaydi
                  </li>
                </ul>
              </div>
              <div className="lx-split-art" aria-hidden="true">
                <div className="lx-phone-stack">
                  <div className="v3-phone-msg">
                    <div className="v3-msg-head">
                      <Icon name="telegram" />
                      <div>
                        Bemor kabineti<small>Eslatma · Namuna</small>
                      </div>
                    </div>
                    <p>
                      Assalomu alaykum, Madina! 3 kundan keyin — seshanba, soat 10:00 da qabulingiz
                      bor.
                    </p>
                    <div className="v3-msg-action">Qabul qildim</div>
                  </div>
                  <div className="v3-phone-msg lx-phone-second">
                    <div className="v3-msg-head">
                      <Icon name="check" />
                      <div>
                        Registratura<small>Bugungi qabullar · Namuna</small>
                      </div>
                    </div>
                    <div className="v3-mini-row">
                      <div className="v3-mini-person">
                        <span className="v3-avatar">MR</span>
                        <div>
                          <strong>Madina Rasulova</strong>
                          <small>Seshanba · 10:00</small>
                        </div>
                      </div>
                      <span className="v3-state">Tasdiqlangan</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= MOLIYA NAZORATI ================= */}
          <section className="v3-section v3-money" id="nazorat" aria-labelledby="v3-money-title">
            <div className="v3-wrap v3-money-grid">
              <div className="v3-money-copy">
                <span className="v3-label">Klinika egasi uchun</span>
                <h2 id="v3-money-title">
                  Kun tugaganda
                  <br />
                  <span>savol qolmasin.</span>
                </h2>
                <p>
                  Tizimdagi tushum va kassadagi naqd pulni solishtiring. Tafovut bo‘lsa, qayerdan
                  kelganini tekshiring.
                </p>
                <ul className="lx-points">
                  <li>
                    <Icon name="lock" /> Yozilgan to‘lov o‘chirilmaydi — xato faqat qaytarish yozuvi bilan tuzatiladi
                  </li>
                  <li>
                    <Icon name="wallet" /> Qarzdorlar ro‘yxati to‘lovlardan o‘zi hisoblanadi
                  </li>
                  <li>
                    <Icon name="bell" /> Ko‘rikdan keyin registratorga to‘lov haqida xabar boradi
                  </li>
                </ul>
              </div>
              <div className="v3-money-panel">
                <div className="v3-money-top">
                  Kun yakuni <small>Demo</small>
                </div>
                <div className="v3-comparison">
                  <div className="v3-money-number">
                    <span>TIZIM BO‘YICHA</span>
                    <strong>4 850 000</strong>
                    <small>so‘m · naqd tushum</small>
                  </div>
                  <div className="v3-money-number">
                    <span>SANALGAN NAQD</span>
                    <strong>4 850 000</strong>
                    <small>so‘m · kassada</small>
                  </div>
                </div>
                <div className="v3-reconcile">
                  <span>
                    <Icon name="check" /> Hisoblar mos keldi
                  </span>
                  <strong>0 so‘m</strong>
                </div>
                <p>Namunaviy solishtiruv. Haqiqiy klinika ko‘rsatkichlari emas.</p>
              </div>
            </div>
          </section>

          {/* ================= KENGROQ IMKONIYATLAR ================= */}
          <section className="v3-section" aria-labelledby="v3-more-title">
            <div className="v3-wrap">
              <div className="v3-section-heading">
                <div>
                  <span className="v3-label">Kengroq imkoniyatlar</span>
                  <h2 id="v3-more-title">
                    Klinikangizning
                    <br />
                    boshqa ishlari ham.
                  </h2>
                </div>
                <p>Kundalik qabuldan tashqari — rahbarga kerak bo‘ladigan ishlar ham bir joyda.</p>
              </div>
              <FeatureGrid
                items={[
                  {
                    icon: 'bed',
                    title: 'Statsionar',
                    text: 'Palatalar, bo‘sh yotoqlar va yotqizilgan bemorlar. Yotgan kunlar bo‘yicha hisob o‘zi chiqadi.',
                  },
                  {
                    icon: 'face',
                    title: 'Yuz bilan davomat',
                    text: 'Xodim ishga kelganini planshet kamerasi orqali belgilaydi. Har bir belgilash jurnalga yoziladi.',
                  },
                  {
                    icon: 'star',
                    title: 'Izohlar va reyting',
                    text: 'Bemor tashrifdan keyin anonim baho qoldiradi. Har bir shifokorning reytingi ko‘rinadi.',
                  },
                  {
                    icon: 'pill',
                    title: 'Onlayn retsept',
                    text: 'Shifokor retseptni tizimda yozadi — bemorga uchta apteka narxi bilan taklif qilinadi.',
                  },
                  {
                    icon: 'image',
                    title: 'Rentgen va suratlar',
                    text: 'Rentgen yoki tish surati tashrifga biriktiriladi va keyingi shifokorga ham ko‘rinadi.',
                  },
                  {
                    icon: 'wallet',
                    title: 'Shifokor qo‘yadigan narx',
                    text: 'Operatsiya kabi xizmatlarga oraliq narx qo‘yiladi — aniq summani shifokor ko‘rikdan keyin yozadi.',
                  },
                  {
                    icon: 'trend',
                    title: 'Tahlil va prognoz',
                    text: 'Tushum, shifokorlar ishi, kelmay qolganlar ulushi va keyingi oylar prognozi.',
                  },
                  {
                    icon: 'file',
                    title: 'Excel va Google Sheets',
                    text: 'Bemorlar va xizmatlar jadvaldan ko‘chiriladi. Hisobotlar Excel’da ochiladigan faylga yoki Google Sheets’ga.',
                  },
                ]}
              />
            </div>
          </section>

          {/* ================= QANDAY BOSHLAYMIZ ================= */}
          <section className="v3-section v3-process" id="boshlash" aria-labelledby="lx-start-title">
            <div className="v3-wrap">
              <div className="v3-section-heading">
                <div>
                  <span className="v3-label">Qanday boshlaymiz?</span>
                  <h2 id="lx-start-title">
                    Bugun ro‘yxatdan o‘ting,
                    <br />
                    ertaga ishlang.
                  </h2>
                </div>
                <p>Dastur o‘rnatilmaydi — kompyuter, planshet yoki telefonda brauzer orqali ishlaydi.</p>
              </div>
              <StartSteps
                steps={[
                  {
                    icon: 'phone',
                    title: 'Ro‘yxatdan o‘ting',
                    text: 'Raqamingiz Telegram orqali tasdiqlanadi. Yo‘nalishni tanlaysiz — bo‘limlar shunga moslab ochiladi.',
                  },
                  {
                    icon: 'file',
                    title: 'Ma’lumotlarni ko‘chiring',
                    text: 'Bemorlar va xizmatlar ro‘yxatini Excel jadvalidan (CSV) yuklang.',
                  },
                  {
                    icon: 'users',
                    title: 'Jamoani qo‘shing',
                    text: 'Shifokor va registratorga o‘z logini. Shifokor Telegram’ga bir tugma bilan ulanadi.',
                  },
                  {
                    icon: 'rocket',
                    title: '14 kun bepul ishlang',
                    text: 'Karta ma’lumoti so‘ralmaydi. Sinov davomida menejerimiz siz bilan bog‘lanadi.',
                  },
                ]}
              />
              <div className="lx-chips">
                <span>Umumiy klinika</span>
                <span>Stomatologiya</span>
                <span>Ko‘z klinikasi</span>
                <span>Laboratoriya</span>
              </div>
            </div>
          </section>

          {/* ================= SAVOLLAR ================= */}
          <section className="v3-section v3-faq" id="savollar" aria-labelledby="v3-faq-title">
            <div className="v3-wrap v3-faq-grid">
              <div className="v3-faq-copy">
                <span className="v3-label">Savol-javob</span>
                <h2 id="v3-faq-title">
                  Boshlashdan
                  <br />
                  oldin.
                </h2>
                <p>Klinika egalari uchrashuvda eng ko‘p so‘raydigan savollar.</p>
              </div>
              <FaqList
                items={[
                  {
                    q: 'Narxi qancha? Bepul sinab ko‘rsa bo‘ladimi?',
                    a: 'Birinchi 14 kun — bepul, karta ma’lumoti so‘ralmaydi. Keyin tarif 3, 6 yoki 12 oyga olinadi. Aniq narxni menejerimiz klinikangiz hajmiga qarab aytadi.',
                  },
                  {
                    q: 'Qancha vaqtda ishga tushiramiz?',
                    a: 'Ro‘yxatdan o‘tish bir necha daqiqa. Bemorlar va xizmatlarni Excel jadvalidan yuklab, xodimlarga login bersangiz — o‘sha kuniyoq qabul yozishni boshlaysiz.',
                  },
                  {
                    q: 'Bemorlar ro‘yxatini qaytadan kiritib chiqamizmi?',
                    a: 'Yo‘q. Bemorlar va xizmatlar ro‘yxati Excel jadvalidan (CSV fayl) yuklanadi. Tizim avval nima qo‘shilishini ko‘rsatadi, bor yozuvlar esa takrorlanmaydi.',
                  },
                  {
                    q: 'Shifokor kompyuterdan uzoqda bo‘lsa-chi?',
                    a: 'Shifokor ClinicOS’ni Telegram ichida, telefonidan ochadi. Yangi qabul haqida xabar keladi, tugmani bossa ko‘rik formasi ochiladi.',
                  },
                  {
                    q: 'Registrator pulni yashirsa, bilamanmi?',
                    a: 'To‘lovni registrator yozadi, nazoratni siz qilasiz. Yozilgan to‘lov o‘chirilmaydi — xato faqat qaytarish yozuvi bilan tuzatiladi. Kun oxirida tizimdagi naqd tushum kassadagi pul bilan solishtiriladi.',
                  },
                  {
                    q: 'Bemorlar qabulga kelmay qolsa-chi?',
                    a: 'Qabuldan 3 kun va 1 kun oldin bemorga Telegram orqali eslatma boradi va u qabulni tasdiqlaydi. Kelmay qolganlar alohida belgilanadi — ularning ulushini hisobotda ko‘rasiz.',
                  },
                  {
                    q: 'Xodimlar barcha ma’lumotlarni ko‘radimi?',
                    a: 'Kirish huquqlari rolga bog‘liq. Shifokor ko‘rikni qayd etadi, registrator to‘lovni qabul qiladi, klinika egasi esa natijalarni nazorat qiladi.',
                  },
                  {
                    q: 'Ma’lumotlarimiz xavfsizmi?',
                    a: 'Har bir klinikaning ma’lumoti alohida — boshqa klinika sizning bemorlaringizni ko‘rmaydi. Fayllar yopiq omborda saqlanadi, ishdan ketgan xodimning kirishi esa o‘sha zahoti yopiladi.',
                  },
                  {
                    q: 'Qaysi tillarda ishlash mumkin?',
                    a: 'Mahsulot interfeysida o‘zbek, rus va ingliz tillari mavjud.',
                  },
                  {
                    q: 'Hisobim bor. Qayerdan kiraman?',
                    a: (
                      <>
                        Yuqoridagi «Kirish» tugmasini bosing. U sizni{' '}
                        <Link className="text-button" to="/login">
                          hisobga kirish sahifasiga
                        </Link>{' '}
                        olib o‘tadi.
                      </>
                    ),
                  },
                  {
                    q: 'Demodagi raqamlar haqiqiy ma’lumotlarmi?',
                    a: 'Yo‘q. Sahifadagi ismlar, grafik va summalar imkoniyatlarni ko‘rsatish uchun tayyorlangan namunalardir.',
                  },
                ]}
              />
            </div>
          </section>

          <section className="v3-section" style={{ paddingTop: 0 }}>
            <div className="v3-wrap v3-final">
              <div>
                <h2>
                  Klinikangizni
                  <br />
                  14 kun bepul sinang.
                </h2>
                <p>Ro‘yxatdan o‘tish bir necha daqiqa. Karta ma’lumoti so‘ralmaydi.</p>
              </div>
              <div className="v3-final-actions">
                <Link className="button" to={REGISTER}>
                  Bepul boshlash <Icon name="arrow" />
                </Link>
                <Link to="/login">Allaqachon hisobingiz bormi? Kirish ↗</Link>
              </div>
            </div>
          </section>
        </>
      </Lang>
    </StoryShell>
  )
}

/* ------------------------------------------------------------------ */
/* Tanlagichlar                                                        */
/* ------------------------------------------------------------------ */

function RoleButton({
  value,
  icon,
  current,
  onPick,
  children,
}: {
  value: Scene
  icon: PublicIconName
  current: Scene
  onPick: (scene: Scene) => void
  children: ReactNode
}) {
  return (
    <Lang>
      <button
        type="button"
        aria-pressed={current === value}
        aria-controls="v3Dashboard"
        onClick={() => onPick(value)}
      >
        <Icon name={icon} />
        {children}
      </button>
    </Lang>
  )
}

function StepButton({
  value,
  number,
  current,
  onPick,
  children,
}: {
  value: Step
  number: string
  current: Step
  onPick: (step: Step) => void
  children: ReactNode
}) {
  return (
    <Lang>
      <button
        type="button"
        className="v3-step"
        aria-pressed={current === value}
        aria-controls="v3Flow"
        onClick={() => onPick(value)}
      >
        <span>{number}</span>
        <span>{children}</span>
      </button>
    </Lang>
  )
}

/* ------------------------------------------------------------------ */
/* Rol ish joylari — NAMUNA                                            */
/* ------------------------------------------------------------------ */

function ConsoleTop({ title, text }: { title: string; text: string }) {
  return (
    <Lang>
      <div className="v3-console-top">
        <div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
        <span className="v3-console-date">
          <Icon name="calendar" /> 11-sentabr, juma
        </span>
      </div>
    </Lang>
  )
}

function Metric({
  label,
  icon,
  value,
  unit,
  note,
}: {
  label: string
  icon: PublicIconName
  value: string
  unit: string
  note: string
}) {
  return (
    <Lang>
      <div className="v3-metric">
        <span>{label}</span>
        <Icon name={icon} />
        <strong>
          {value} <small>{unit}</small>
        </strong>
        <small>{note}</small>
      </div>
    </Lang>
  )
}

function MiniRow({
  initials,
  name,
  sub,
  state,
  blue,
}: {
  initials: string
  name: string
  sub: string
  state: string
  blue?: boolean
}) {
  return (
    <Lang>
      <div className="v3-mini-row">
        <div className="v3-mini-person">
          <span className="v3-avatar">{initials}</span>
          <div>
            <strong>{name}</strong>
            <small>{sub}</small>
          </div>
        </div>
        <span className={cn('v3-state', blue && 'blue')}>{state}</span>
      </div>
    </Lang>
  )
}

function TodayRows() {
  return (
    <Lang>
      <>
        <MiniRow initials="MR" name="Madina Rasulova" sub="Terapevt · 09:00" state="Yakunlandi" />
        <MiniRow initials="DA" name="Dilnoza Akbarova" sub="Konsultatsiya · 09:30" state="Qabulda" blue />
        <MiniRow initials="BS" name="Behzod Salimov" sub="Terapevt · 10:00" state="Kutilmoqda" blue />
      </>
    </Lang>
  )
}

function ConsoleNote() {
  return (
    <Lang>
      <div className="v3-console-note">
        <span>
          <Icon name="shield" /> Klinikangiz ma’lumotlari bir joyda
        </span>
        <span>Demo · Ismlar va raqamlar namunaviy</span>
      </div>
    </Lang>
  )
}

/** Jadval — "Imkoniyatlar" kartasida to'liq, registrator ish joyida qisqa yozuvlar bilan */
function ScheduleGrid({ long, style }: { long?: boolean; style?: React.CSSProperties }) {
  return (
    <Lang>
      <div className="v3-grid" style={style}>
        <div className="v3-grid-head" />
        <div className="v3-grid-head">A. Karimov</div>
        <div className="v3-grid-head">N. Usmonova</div>
        <div className="v3-grid-head">S. Aliyev</div>
        <div className="v3-grid-time">09:00</div>
        <div className="v3-slot">
          <strong>M. Rasulova</strong>
          <small>{long ? 'Terapevt ko‘rigi' : 'Terapevt'}</small>
        </div>
        <div />
        <div className="v3-slot pink">
          <strong>A. Umarov</strong>
          <small>{long ? 'Qayta ko‘rik' : 'Ko‘rik'}</small>
        </div>
        <div className="v3-grid-time">09:30</div>
        <div />
        <div className="v3-slot green">
          <strong>D. Akbarova</strong>
          <small>Konsultatsiya</small>
        </div>
        <div />
        <div className="v3-grid-time">10:00</div>
        <div className="v3-slot">
          <strong>B. Salimov</strong>
          <small>{long ? 'Terapevt ko‘rigi' : 'Terapevt'}</small>
        </div>
        <div />
        <div className="v3-slot pink">
          <strong>N. Rahimova</strong>
          <small>{long ? 'Qayta ko‘rik' : 'Ko‘rik'}</small>
        </div>
      </div>
    </Lang>
  )
}

function OwnerScene() {
  return (
    <Lang>
      <>
        <ConsoleTop title="Klinikangiz bugun" text="Tushum, qabullar va jamoa — umumiy ko‘rinishda." />
        <div className="v3-metrics">
          <Metric label="Bugungi tushum" icon="wallet" value="8 450 000" unit="so‘m" note="Naqd va karta orqali" />
          <Metric label="Bugungi qabullar" icon="calendar" value="32" unit="qabul" note="24 ta ko‘rik yakunlandi" />
          <Metric label="Navbatdagi bemorlar" icon="users" value="8" unit="bemor" note="Qabul kutilmoqda" />
        </div>
        <div className="v3-console-panels">
          <div className="v3-chart-panel">
            <div className="v3-panel-title">
              Haftalik tushum <span>Namunaviy ko‘rinish</span>
            </div>
            <svg
              className="v3-chart-svg"
              viewBox="0 0 400 125"
              role="img"
              aria-label="Namunaviy haftalik tushum chizig‘i"
            >
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#bdd2ff" stopOpacity=".65" />
                  <stop offset="1" stopColor="#ecf3ff" stopOpacity=".1" />
                </linearGradient>
              </defs>
              <g stroke="#edf1f8" strokeDasharray="3 4">
                <path d="M0 15h400M0 45h400M0 75h400M0 105h400" />
              </g>
              <path
                d="M0 95C25 95 30 75 60 77S98 92 130 64 165 74 198 43 233 70 263 43 301 61 328 29 366 42 400 10V125H0Z"
                fill="url(#chartFill)"
              />
              <path
                d="M0 95C25 95 30 75 60 77S98 92 130 64 165 74 198 43 233 70 263 43 301 61 328 29 366 42 400 10"
                fill="none"
                stroke="#5387f5"
                strokeWidth="2.5"
              />
              <circle cx="263" cy="43" r="5" fill="#5387f5" stroke="white" strokeWidth="2" />
            </svg>
            <div className="v3-chart-days">
              <span>Du</span>
              <span>Se</span>
              <span>Ch</span>
              <span>Pa</span>
              <span>Ju</span>
              <span>Sh</span>
              <span>Ya</span>
            </div>
          </div>
          <div className="v3-list-panel">
            <div className="v3-panel-title">
              Bugungi qabullar <span>Hammasi hisobda</span>
            </div>
            <TodayRows />
          </div>
        </div>
        <ConsoleNote />
      </>
    </Lang>
  )
}

function ReceptionScene() {
  return (
    <Lang>
      <>
        <ConsoleTop title="Bugungi qabul" text="Bemorlar, jadval va to‘lovlar — bir ekranda." />
        <div className="v3-metrics">
          <Metric label="Bugungi qabullar" icon="calendar" value="32" unit="qabul" note="Shifokorlar jadvali bo‘yicha" />
          <Metric label="Navbatda" icon="users" value="8" unit="bemor" note="Qabul kutilmoqda" />
          <Metric label="To‘lov kutilmoqda" icon="wallet" value="4" unit="bemor" note="Xizmatlar bo‘yicha" />
        </div>
        <div className="v3-console-panels">
          <div className="v3-chart-panel">
            <div className="v3-schedule" style={{ boxShadow: 'none', border: 0 }}>
              <div className="v3-schedule-top" style={{ padding: '0 0 12px' }}>
                Qabul jadvali <span>Bugun</span>
              </div>
              <ScheduleGrid style={{ padding: '12px 0 0' }} />
            </div>
          </div>
          <div className="v3-list-panel">
            <div className="v3-panel-title">
              Navbatdagi bemorlar <span>Namuna</span>
            </div>
            <TodayRows />
          </div>
        </div>
        <ConsoleNote />
      </>
    </Lang>
  )
}

function DoctorScene() {
  return (
    <Lang>
      <>
        <ConsoleTop
          title="Bugungi bemorlaringiz"
          text="Qabullar va ko‘rik qaydlariga e’tibor qarating."
        />
        <div className="v3-metrics">
          <Metric label="Bugungi qabullar" icon="calendar" value="12" unit="qabul" note="Shaxsiy jadvalingiz" />
          <Metric label="Ko‘rik yakunlandi" icon="check" value="7" unit="bemor" note="Tashriflar qayd etilgan" />
          <Metric label="Qolgan qabullar" icon="users" value="5" unit="bemor" note="Ko‘rik kutilmoqda" />
        </div>
        <div className="v3-console-panels">
          <div className="v3-list-panel">
            <div className="v3-panel-title">
              Sizning qabullaringiz <span>Namuna</span>
            </div>
            <TodayRows />
          </div>
          <div className="v3-chart-panel">
            <div className="v3-panel-title">
              Bemor profili <span>Demo</span>
            </div>
            <div className="v3-mini-person">
              <span className="v3-avatar">MR</span>
              <div>
                <strong style={{ fontSize: 11 }}>Madina Rasulova</strong>
                <small style={{ display: 'block', fontSize: 8, color: '#8c9bb1' }}>
                  Terapevt ko‘rigi · 09:00
                </small>
              </div>
            </div>
            <dl className="v3-flow-dl" style={{ marginTop: 15 }}>
              <div>
                <dt>Oldingi tashrif</dt>
                <dd>4-sentabr</dd>
              </div>
              <div>
                <dt>Ko‘rik turi</dt>
                <dd>Qayta konsultatsiya</dd>
              </div>
              <div>
                <dt>Shifokor</dt>
                <dd>A. Karimov</dd>
              </div>
            </dl>
          </div>
        </div>
        <ConsoleNote />
      </>
    </Lang>
  )
}

/* ------------------------------------------------------------------ */
/* Tashrif bosqichlari — NAMUNA                                        */
/* ------------------------------------------------------------------ */

const FLOWS: Record<
  Step,
  {
    icon: PublicIconName
    badge: string
    title: string
    text: string
    rows: [string, string][]
    confirm: string
  }
> = {
  appointment: {
    icon: 'calendar',
    badge: 'REGISTRATURA',
    title: 'Bemor qabulga yozildi.',
    text: 'Shifokor, xizmat va vaqt — barchasi belgilangan.',
    rows: [
      ['Bemor', 'Madina Rasulova'],
      ['Shifokor', 'Aziz Karimov'],
      ['Qabul vaqti', '11-sentabr · 09:00'],
    ],
    confirm: 'Qabul jadvalga qo‘shildi',
  },
  visit: {
    icon: 'doctor',
    badge: 'SHIFOKOR',
    title: 'Ko‘rik qayd etildi.',
    text: 'Yangi tashrif bemor tarixiga qo‘shildi. Oldingi ma’lumotlar ham qo‘l ostida.',
    rows: [
      ['Bemor', 'Madina Rasulova'],
      ['Xizmat', 'Terapevt ko‘rigi'],
      ['Holati', 'Ko‘rik yakunlandi'],
    ],
    confirm: 'Tashrif bemor tarixida saqlandi',
  },
  payment: {
    icon: 'wallet',
    badge: 'KASSA',
    title: 'To‘lov qabul qilindi.',
    text: 'Ko‘rsatilgan xizmat va tushum bog‘landi. Natija klinika hisobida ko‘rinadi.',
    rows: [
      ['Bemor', 'Madina Rasulova'],
      ['To‘lov usuli', 'Naqd'],
      ['Summa', '150 000 so‘m'],
    ],
    confirm: 'To‘lov qayd etildi · Namuna',
  },
}

function Flow({ step }: { step: Step }) {
  const data = FLOWS[step]
  return (
    <Lang>
      <>
        <span className="v3-flow-badge">
          <Icon name={data.icon} /> {data.badge}
        </span>
        <h3>{data.title}</h3>
        <p>{data.text}</p>
        <dl className="v3-flow-dl">
          {data.rows.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="v3-flow-confirm">
          <Icon name="check" /> {data.confirm}
        </div>
      </>
    </Lang>
  )
}

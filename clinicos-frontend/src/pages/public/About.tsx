import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'
import { Lang, translateText } from '@/pages/public/about-i18n'
import { Icon, IconSprite } from './PublicIcons'
import type { PublicIconName } from './PublicIcons'
import './public-base.css'
import './story.css'

/**
 * TANISHTIRUV SAHIFASI — `/about`.
 *
 * Foydalanuvchi tasdiqlagan yakuniy dizayn (3-variant), prototipdan
 * aynan ko'chirilgan: kompozitsiya, o'lchamlar, animatsiyalar.
 * Uslublar `story.css` da va `.story-page` ichiga cheklangan.
 *
 * SAHIFADAGI ISMLAR, SUMMALAR VA GRAFIKLAR — NAMUNA. Ular mahsulot
 * nima qilishini ko'rsatish uchun, haqiqiy mijoz yoki natija emas;
 * har bir blokda buni aytuvchi "Demo" yozuvi bor va olib tashlanmasin.
 *
 * Matn faqat o'zbekcha — dizayn shunday tasdiqlangan.
 */

type Scene = 'owner' | 'reception' | 'doctor'
type Step = 'appointment' | 'visit' | 'payment'

const SCENES: Record<Scene, { name: string; initials: string; nav: number }> = {
  owner: { name: 'Klinika egasi', initials: 'KE', nav: 0 },
  reception: { name: 'Registrator', initials: 'RG', nav: 1 },
  doctor: { name: 'Shifokor', initials: 'SH', nav: 3 },
}

const SIDE_NAV: { icon: PublicIconName; label: string }[] = [
  { icon: 'grid', label: 'Bosh sahifa' },
  { icon: 'calendar', label: 'Qabullar' },
  { icon: 'users', label: 'Bemorlar' },
  { icon: 'doctor', label: 'Shifokorlar' },
  { icon: 'wallet', label: 'To‘lovlar' },
  { icon: 'chart', label: 'Hisobotlar' },
]

const DEMO_CHANGE = 'clinicos:demo-change'

export function AboutPage() {
  const { lang } = useI18n()
  const root = useRef<HTMLDivElement>(null)
  const dashboard = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)

  const [scene, setScene] = useState<Scene>('owner')
  const [step, setStep] = useState<Step>('appointment')
  const [menuOpen, setMenuOpen] = useState(false)

  useStoryMotion(root)
  useStorySpotlight(root)
  useDemoChange(scene, dashboard)
  useDemoChange(step, flow)

  useEffect(() => {
    const previous = document.title
    /* Sarlavha ham tilga ergashadi — u qidiruvda va tabda ko'rinadi */
    document.title = `ClinicOS — ${translateText(lang, 'Klinikangizga tartib.')} ${translateText(
      lang,
      'Sizga',
    )} ${translateText(lang, 'xotirjamlik.')}`
    return () => {
      document.title = previous
    }
  }, [lang])

  /* --- Mobil menyu: Escape, tashqariga bosish, ekran o'lchami --- */
  useEffect(() => {
    const mobile = window.matchMedia('(max-width:800px)')
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }
    function onClick(event: MouseEvent) {
      if (!(event.target as Element).closest('.header')) setMenuOpen(false)
    }
    const onChange = () => setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    mobile.addEventListener('change', onChange)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
      mobile.removeEventListener('change', onChange)
    }
  }, [menuOpen])

  function onNavClick(event: React.MouseEvent) {
    if ((event.target as Element).closest('a')) {
      if (window.matchMedia('(max-width:800px)').matches) menuButton.current?.focus()
      setMenuOpen(false)
    }
  }

  const current = SCENES[scene]

  return (
    <Lang>
      <div className="story-page" ref={root}>
        <IconSprite />
        <a href="#main" className="skip">
          Asosiy mazmunga o‘tish
        </a>

        <header className="header">
          <div className="wrap header-inner">
            <Link className="logo" to="/about" aria-label="ClinicOS bosh sahifa">
              <span className="logo-mark">
                <Icon name="pulse" />
              </span>
              <span>
                Clinic<em>OS</em>
              </span>
            </Link>
            <nav
              className={cn('nav', menuOpen && 'open')}
              id="navigation"
              aria-label="Asosiy navigatsiya"
              onClick={onNavClick}
            >
              <a href="#imkoniyatlar">Imkoniyatlar</a>
              <a href="#jarayon">Qanday ishlaydi</a>
              <a href="#nazorat">Moliya nazorati</a>
              <a href="#savollar">Savollar</a>
            </nav>
            <div className="header-actions">
              <Link className="login-button" to="/login">
                <Icon name="login" /> Kirish
              </Link>
              <Link className="button" to="/login?mode=register">
                Ro‘yxatdan o‘tish <Icon name="arrow" />
              </Link>
              <button
                ref={menuButton}
                type="button"
                className="menu-button"
                aria-label={menuOpen ? 'Menyuni yopish' : 'Menyuni ochish'}
                aria-controls="navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Icon name="menu" />
              </button>
            </div>
          </div>
        </header>

        <main id="main">
          {/* ================= HERO ================= */}
          <section className="v3-hero" aria-labelledby="v3-title">
            <div className="v3-wrap">
              <div className="v3-hero-heading">
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
                  <a className="button" href="#demo">
                    Tizimni ko‘rib chiqish <Icon name="arrow" />
                  </a>
                  <a className="button light" href="#jarayon">
                    Qanday ishlaydi?
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
                    <p>Yangi qabul haqida shifokor o‘z telefonidan xabar topadi.</p>
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
                      Avvalgi tashriflar, ko‘rik qaydlari va to‘lovlar — bemorning yagona
                      profilida.
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
                    <p>Vazifalar taqsimlangan. Har bir rolga kerakli imkoniyatlar ochilgan.</p>
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
                <div className="v3-money-proof">
                  <Icon name="shield" /> To‘lov qaydi va nazorat — alohida vazifalar.
                </div>
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
                <p>
                  Kundalik qabullardan tashqari, statsionar va dorixona uchun ham alohida
                  bo‘limlar.
                </p>
              </div>
              <div className="v3-extras">
                <article className="v3-extra">
                  <div className="v3-extra-visual">
                    <Icon name="bed" />
                  </div>
                  <div>
                    <h3>Statsionar</h3>
                    <p>Palatalar, bo‘sh yotoqlar va yotqizilgan bemorlarni kuzatib boring.</p>
                  </div>
                </article>
                <article className="v3-extra">
                  <div className="v3-extra-visual">
                    <Icon name="grid" />
                  </div>
                  <div>
                    <h3>Dorixona</h3>
                    <p>Dori zaxirasi, xarid va savdolarni alohida ish joyida boshqaring.</p>
                  </div>
                </article>
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
                <p>Mahsulot bilan tanishishda kerak bo‘ladigan asosiy javoblar.</p>
              </div>
              <div>
                <details open>
                  <summary>ClinicOS kimlar uchun mo‘ljallangan?</summary>
                  <p>
                    O‘zbekistondagi xususiy klinikalar uchun. Klinika egasi, registrator va
                    shifokor o‘z vazifasiga mos ish joyidan foydalanadi.
                  </p>
                </details>
                <details>
                  <summary>Qaysi tillarda ishlash mumkin?</summary>
                  <p>Mahsulot interfeysida o‘zbek, rus va ingliz tillari mavjud.</p>
                </details>
                <details>
                  <summary>Xodimlar barcha ma’lumotlarni ko‘radimi?</summary>
                  <p>
                    Kirish huquqlari rolga bog‘liq. Shifokor ko‘rikni qayd etadi, registrator
                    to‘lovni qabul qiladi, klinika egasi esa natijalarni nazorat qiladi.
                  </p>
                </details>
                <details>
                  <summary>Hisobim bor. Qayerdan kiraman?</summary>
                  <p>
                    Yuqoridagi «Kirish» tugmasini bosing. U sizni{' '}
                    <Link className="text-button" to="/login">
                      hisobga kirish sahifasiga
                    </Link>{' '}
                    olib o‘tadi.
                  </p>
                </details>
                <details>
                  <summary>Demodagi raqamlar haqiqiy ma’lumotlarmi?</summary>
                  <p>
                    Yo‘q. Sahifadagi ismlar, grafik va summalar imkoniyatlarni ko‘rsatish uchun
                    tayyorlangan namunalardir.
                  </p>
                </details>
              </div>
            </div>
          </section>

          <section className="v3-section" style={{ paddingTop: 0 }}>
            <div className="v3-wrap v3-final">
              <div>
                <h2>
                  Klinikangizga
                  <br />
                  bir nazar yetarli.
                </h2>
                <p>ClinicOS ish joylari bilan tanishishni boshlang.</p>
              </div>
              <div className="v3-final-actions">
                <a className="button" href="#demo">
                  Demoni ko‘rish <Icon name="arrow" />
                </a>
                <Link to="/login">Allaqachon hisobingiz bormi? Kirish ↗</Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="v3-footer">
          <div className="v3-wrap">
            <div className="v3-footer-top">
              <div>
                <Link className="logo" to="/about" aria-label="ClinicOS bosh sahifa">
                  <span className="logo-mark">
                    <Icon name="pulse" />
                  </span>
                  <span>
                    Clinic<em>OS</em>
                  </span>
                </Link>
                <p>Qabuldan kassagacha — bitta tizimda.</p>
              </div>
              <nav className="v3-footer-nav" aria-label="Pastki navigatsiya">
                <a href="#imkoniyatlar">Imkoniyatlar</a>
                <a href="#jarayon">Qanday ishlaydi</a>
                <a href="#savollar">Savollar</a>
                <Link to="/login">Kirish</Link>
              </nav>
            </div>
            <div className="v3-footer-bottom">
              <span>© {new Date().getFullYear()} ClinicOS</span>
              <span>Xususiy klinikalar uchun boshqaruv tizimi.</span>
            </div>
          </div>
        </footer>
      </div>
    </Lang>
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

/* ------------------------------------------------------------------ */
/* Harakat                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rol yoki bosqich almashganda — yangi mazmun chizilgach — harakat
 * qatlamiga xabar beradi. Birinchi chizishda xabar yo'q: prototipda
 * ham boshlang'ich holat animatsiyasiz turadi.
 */
function useDemoChange(value: string, target: RefObject<HTMLElement | null>) {
  const previous = useRef(value)
  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    if (target.current) {
      document.dispatchEvent(new CustomEvent(DEMO_CHANGE, { detail: { target: target.current } }))
    }
  }, [value, target])
}

/**
 * HARAKAT QATLAMI — TIZIM ICHIDAGI HARAKAT TILI.
 *
 * Ilgari bu yerda prototipdagi `about-v3.js` ning o'z egri chizig'i
 * va o'z masofasi bor edi. Endi ish panellaridagi bilan BIR XIL:
 * tanishuv sahifasidan ichkariga kirgan odam boshqa mahsulotga
 * tushgandek bo'lmasligi kerak.
 *
 * Ya'ni (`index.css` dagi `admin-enter`, `admin-pop`, `count-in`):
 *
 * - kirish: 22px pastdan, 0.97 masshtab va yengil xiralik bilan;
 * - ikonkalar sakrab joyiga tushadi (prujinali egri);
 * - raqamlar pastdan chiqib o'tiradi;
 * - chiziq chapdan o'ngga to'ladi;
 * - cheksiz takrorlanadigan harakat yo'q (fondagi sekin dog'lardan
 *   boshqa — u ham `transform`, sahifani qayta chizmaydi).
 *
 * "Harakatni kamaytirish" yoqilgan bo'lsa hech narsa o'ynamaydi, ish
 * paytida yoqilsa esa davom etayotganlari o'sha zahoti to'xtatiladi.
 * CSS o'tishlari `story.css` dagi media so'rov bilan o'chadi.
 */
function useStoryMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const active = new Set<Animation>()
    const chartSeen = new WeakSet<Element>()
    /* Ish panellaridagi egri chiziqlar (`--ease-out-soft`, `--ease-spring`) */
    const ease = 'cubic-bezier(0.16, 1, 0.3, 1)'
    const spring = 'cubic-bezier(0.34, 1.4, 0.64, 1)'

    function play(
      element: Element | null | undefined,
      frames: Keyframe[],
      options: KeyframeAnimationOptions = {},
    ) {
      if (preference.matches || !element || !('animate' in element)) return
      const animation = element.animate(frames, {
        duration: 700,
        easing: ease,
        fill: 'backwards',
        ...options,
      })
      active.add(animation)
      animation.finished.catch(() => {}).finally(() => active.delete(animation))
      return animation
    }

    /**
     * Kirish — `admin-enter` ning aynan o'zi.
     *
     * Xiralik (`blur`) ataylab: karta "chizilib" emas, fokusga
     * kelgandek chiqadi. Panellarda shu ish qilingan.
     */
    function enter(element: Element | null | undefined, delay = 0, distance = 14) {
      play(
        element,
        [
          { opacity: 0, translate: `0 ${distance}px`, scale: '0.97', filter: 'blur(5px)' },
          { offset: 0.6, filter: 'blur(0px)' },
          { opacity: 1, translate: '0 0', scale: '1', filter: 'blur(0px)' },
        ],
        { duration: 760, delay },
      )

      /* Ikonka sakrab tushadi — `admin-pop` */
      element
        ?.querySelectorAll?.('.v3-card-tag .icon, .v3-extra-visual .icon')
        .forEach((icon, index) =>
          play(
            icon,
            [
              { opacity: 0, scale: '0.4', rotate: '-14deg' },
              { opacity: 1, scale: '1', rotate: '0deg' },
            ],
            { duration: 640, delay: delay + 160 + index * 80, easing: spring },
          ),
        )

      /* Raqamlar — `count-in` */
      element
        ?.querySelectorAll?.('.v3-metric strong, .v3-money-panel strong')
        .forEach((value, index) =>
          play(
            value,
            [
              { opacity: 0, translate: '0 6px', scale: '0.96' },
              { opacity: 1, translate: '0 0', scale: '1' },
            ],
            { duration: 620, delay: delay + 220 + index * 90, easing: spring },
          ),
        )
    }

    function drawChart(svg: Element) {
      if (chartSeen.has(svg)) return
      chartSeen.add(svg)
      const line = svg.querySelector<SVGPathElement>('path[stroke="#5387f5"]')
      if (!line) return
      const length = line.getTotalLength()
      play(
        line,
        [
          { strokeDasharray: String(length), strokeDashoffset: String(length) },
          { strokeDasharray: String(length), strokeDashoffset: '0' },
        ],
        /* Panellardagi `draw-line` bilan bir xil vaqt */
        { duration: 900 },
      )
    }

    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue
                const element = entry.target as HTMLElement
                observer?.unobserve(element)
                if (element.matches('.v3-chart-svg')) drawChart(element)
                else enter(element, Number(element.dataset.motionDelay || 0))
              }
            },
            { threshold: 0.12 },
          )
        : null

    const hero = root.querySelector('.v3-hero-heading')
    if (hero) {
      Array.from(hero.children)
        .filter((element) => !element.matches('.v3-hero-annotation'))
        .forEach((element, index) => enter(element, index * 90, 12))
    }

    root
      .querySelectorAll<HTMLElement>(
        '.v3-workspace,.v3-section-heading,.v3-card,.v3-process-copy,.v3-process-stage,.v3-money-copy,.v3-money-panel,.v3-extra,.v3-faq-copy,.v3-final',
      )
      .forEach((element, index) => {
        if (element.matches('.v3-card,.v3-extra')) {
          /* Panellardagi kartalar navbati bilan chiqqanidek */
          element.dataset.motionDelay = String((index % 2) * 90)
        }
        observer?.observe(element)
      })
    root.querySelectorAll('.v3-chart-svg').forEach((svg) => observer?.observe(svg))

    function onDemoChange(event: Event) {
      const target = (event as CustomEvent<{ target: HTMLElement }>).detail.target
      target.getAnimations().forEach((animation) => animation.cancel())
      play(
        target,
        [
          { opacity: 0.45, translate: '0 8px' },
          { opacity: 1, translate: '0 0' },
        ],
        { duration: 300 },
      )
      target.querySelectorAll('.v3-metric').forEach((item, index) => {
        play(
          item,
          [
            { opacity: 0.35, translate: '0 5px' },
            { opacity: 1, translate: '0 0' },
          ],
          { duration: 280, delay: index * 35 },
        )
      })
      target.querySelectorAll('.v3-chart-svg').forEach((svg) => observer?.observe(svg))
      const confirmation = target.querySelector('.v3-flow-confirm')
      if (confirmation) {
        play(
          confirmation,
          [
            { opacity: 0, translate: '0 6px' },
            { opacity: 1, translate: '0 0' },
          ],
          { duration: 280, delay: 90 },
        )
      }
    }

    const details = Array.from(root.querySelectorAll('details'))
    const onToggle = (event: Event) => {
      const element = event.currentTarget as HTMLDetailsElement
      if (element.open) enter(element.querySelector('p'), 0, 5)
    }

    function onPreference(event: MediaQueryListEvent) {
      if (event.matches) active.forEach((animation) => animation.cancel())
    }

    document.addEventListener(DEMO_CHANGE, onDemoChange)
    details.forEach((element) => element.addEventListener('toggle', onToggle))
    preference.addEventListener('change', onPreference)

    return () => {
      observer?.disconnect()
      document.removeEventListener(DEMO_CHANGE, onDemoChange)
      details.forEach((element) => element.removeEventListener('toggle', onToggle))
      preference.removeEventListener('change', onPreference)
      active.forEach((animation) => animation.cancel())
    }
  }, [rootRef])
}

/**
 * SICHQONCHA ORTIDAN YURADIGAN YORUG'LIK — kartalar ustida.
 *
 * Ish panellarida shu effekt bor (`useCardSpotlight`) va tanishuv
 * sahifasi undan farq qilib turmasligi kerak: odam ichkariga
 * kirganda bir xil "his" bo'lishi kerak.
 *
 * Bitta tinglovchi ildizda turadi — har bir kartaga alohida
 * qo'yilsa, o'nlab tinglovchi paydo bo'lardi. Kadrga bir martadan
 * ko'p yozilmaydi, barmoqli ekranda esa umuman ishlamaydi: u
 * yerda "sichqoncha ortidan" degan narsaning ma'nosi yo'q.
 */
function useStorySpotlight(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const target = event.target as Element | null
      const { clientX, clientY } = event

      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const card = target?.closest<HTMLElement>('.v3-card, .v3-extra, .v3-final')
        if (!card) return
        const rect = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${clientX - rect.left}px`)
        card.style.setProperty('--my', `${clientY - rect.top}px`)
      })
    }

    root.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      root.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [rootRef])
}

import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/api/auth'
import { USE_MOCK } from '@/api/client'
import { PLATFORM_EMAIL_DOMAIN } from '@/components/ui/EmailLocalInput'
import { cn } from '@/lib/cn'
import { LANGS, useI18n } from '@/i18n'
import { getDb } from '@/mock/db'
import { useAuth } from '@/store/auth-context'
import { usePatient } from '@/store/patient-context'
import { Icon, IconSprite } from '@/pages/public/PublicIcons'
import careImage from '@/pages/public/assets/clinicos-care.png'
import '@/pages/public/public-base.css'

type Mode = 'login' | 'register'

/**
 * KIRISH SAHIFASI — foydalanuvchi tasdiqlagan yakuniy dizayn.
 *
 * Chapda kirish va ro'yxatdan o'tish, o'ngda katta tanishtiruv
 * paneli. Panelning istalgan joyi bosilsa `/about` — to'liq
 * tanishtiruv ochiladi, u yerdagi "Kirish" esa shu sahifaga qaytaradi.
 *
 * USLUBLAR `public-base.css` da va `.auth-page` ichiga cheklangan —
 * ilovaning qolgan sahifalariga tegmaydi (izohi o'sha faylda).
 *
 * RO'YXATDAN O'TISH SERVERGA ULANMAGAN va bu ataylab: backendda
 * o'z-o'zidan klinika ochish yo'li yo'q — klinikani platforma egasi
 * ochadi. Shuning uchun forma hech narsa yubormaydi va buni ochiq
 * aytadi. Ishlayotgandek ko'rsatish mijozni aldash bo'lardi: u
 * "yozildim" deb kutib o'tirardi, unga esa hech kim qo'ng'iroq
 * qilmasdi.
 */
export function LoginPage() {
  const { t, lang, setLang } = useI18n()
  const { session, login, loading, error } = useAuth()
  const { enter } = usePatient()

  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('mode') === 'register' ? 'register' : 'login'
  const registering = mode === 'register'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const loginTab = useRef<HTMLButtonElement>(null)
  const registerTab = useRef<HTMLButtonElement>(null)

  /* --- Pastki xabar (prototipdagi `.toast`) --- */
  const [toast, setToast] = useState('')
  const [toastShown, setToastShown] = useState(false)
  const toastTimer = useRef<number | undefined>(undefined)

  function notify(message: string) {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    setToastShown(true)
    toastTimer.current = window.setTimeout(() => setToastShown(false), 5500)
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  /* Sahifa sarlavhasi rejimga qarab — chiqqanda avvalgisi qaytadi */
  useEffect(() => {
    const previous = document.title
    document.title = registering ? t('login.titleRegister') : t('login.titleLogin')
    return () => {
      document.title = previous
    }
  }, [registering, t])

  if (session) return <Navigate to="/" replace />

  function switchMode(next: Mode) {
    setParams(next === 'register' ? { mode: 'register' } : {}, { replace: true })
    ;(next === 'register' ? registerTab : loginTab).current?.focus()
  }

  /**
   * Tilni almashtirish — dizayndagi "O'zbekcha" yozuvi o'rnida.
   *
   * Ko'rinishi o'zgarmagan, faqat bosiladigan bo'ldi: ilova uch
   * tilda ishlaydi va kirish sahifasi ilgari ham tanlangan tilga
   * ergashardi — buni yo'qotib bo'lmasdi.
   */
  function nextLanguage() {
    const index = LANGS.findIndex((one) => one.code === lang)
    setLang(LANGS[(index + 1) % LANGS.length].code)
  }

  /**
   * Demo bemor sifatida kabinetga kirish.
   *
   * Tashrifi BOR bemor tanlanadi — aks holda kabinet bo'm-bo'sh
   * ochilib, nima ko'rsatishini tushunib bo'lmasdi.
   */
  async function enterCabinet() {
    const db = getDb()
    const withVisits = new Set(db.visits.all().map((v) => v.patientId))
    const target =
      db.patients.all().find((p) => withVisits.has(p.id)) ?? db.patients.all()[0]
    if (target) await enter(target.id)
  }

  /*
    FAQAT NOM TERILSA HAM KIRSIN.

    Xodimning logini `ism.familiya@clinic-os.uz` ko'rinishida
    ochiladi va egasi ko'pincha faqat nomni aytadi — domen
    formada o'zgarmas yozuv bo'lib turgani uchun u "login"
    emasdek ko'rinadi. Nom terilganda kirish rad etilardi va
    sabab "email yoki parol noto'g'ri" ostida yashiringan edi.

    `@` bor bo'lsa TEGMAYMIZ: eski hisoblar boshqa domenda
    (`@shifomed.uz`) va ularni buzib qo'ymaslik kerak.
  */
  function fullEmail(value: string): string {
    const clean = value.trim().toLowerCase()
    return clean.includes('@') ? clean : `${clean}@${PLATFORM_EMAIL_DOMAIN}`
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    try {
      await login(fullEmail(email), password)
    } catch {
      /* xato AuthContext'da saqlanadi va forma ichida ko'rsatiladi */
    }
  }

  function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    notify(t('login.registerToast'))
  }

  function signInAsDemo(demoEmail: string) {
    setEmail(demoEmail)
    setPassword(DEMO_PASSWORD)
    void login(demoEmail, DEMO_PASSWORD).catch(() => {})
  }

  const language = LANGS.find((one) => one.code === lang) ?? LANGS[0]

  return (
    <div className="auth-page auth-body">
      <IconSprite />
      <a className="skip" href="#main">
        {t('login.skip')}
      </a>

      <main className="auth-layout" id="main">
        <section className="auth-left" aria-labelledby="authTitle">
          <div className="auth-logo-row">
            <Link className="logo" to="/login" aria-label={t('login.home')}>
              <span className="logo-mark">
                <Icon name="pulse" />
              </span>
              <span>
                Clinic<em>OS</em>
              </span>
            </Link>
            <button
              type="button"
              className="auth-language"
              onClick={nextLanguage}
              aria-label={t('login.langLabel')}
            >
              <Icon name="globe" /> {language.label}
            </button>
          </div>

          <div className="auth-content">
            <h1 className="auth-title" id="authTitle">
              {registering ? t('login.startTitle') : t('login.welcome')}
            </h1>
            <p className="auth-description" id="authDescription">
              {registering ? t('login.startHint') : t('login.welcomeHint')}
            </p>

            <div className="auth-tabs" role="group" aria-label={t('login.tabsLabel')}>
              <button
                ref={loginTab}
                type="button"
                aria-pressed={!registering}
                aria-controls="loginForm"
                onClick={() => switchMode('login')}
              >
                {t('login.tabLogin')}
              </button>
              <button
                ref={registerTab}
                type="button"
                aria-pressed={registering}
                aria-controls="registerForm"
                onClick={() => switchMode('register')}
              >
                {t('login.tabRegister')}
              </button>
            </div>

            {/* ================= KIRISH ================= */}
            <form id="loginForm" hidden={registering} onSubmit={submit}>
              <div className="form-field">
                <label htmlFor="loginEmail">{t('login.email')}</label>
                <input
                  id="loginEmail"
                  /*
                    `type="email"` EMAS: brauzer `@` siz qiymatni o'zi
                    rad etadi va forma umuman yuborilmasdi — xodim faqat
                    nomini tersa, hech qanday xabarsiz turib qolardi.
                  */
                  type="text"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('login.emailPlaceholder')}
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="loginPassword">{t('login.password')}</label>
                <div className="password-field">
                  <input
                    id="loginPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('login.passwordPlaceholder')}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <Icon name="eye" />
                  </button>
                </div>
              </div>

              {/*
                SERVER AYTGAN SABAB KO'RSATILADI.

                Server parolga aloqasi yo'q sabablarni ham qaytaradi:
                "Klinika arxivlangan", "Klinika hisobi to'xtatilgan",
                "Apteka to'xtatilgan". Hammasini "email yoki parol
                noto'g'ri" deb ko'rsatsak, egasi to'g'ri parolini terib
                parolini qidirib yurardi — muammo esa obunada edi.

                `auth.invalid` — tarjima kaliti (demo rejim va noma'lum
                xato shu bilan keladi), qolgani serverdan kelgan matn.
              */}
              {error ? (
                <p className="auth-error" role="alert">
                  {error === 'auth.invalid' ? t('auth.invalid') : error}
                </p>
              ) : null}

              <div className="auth-options">
                <span>{t('login.options')}</span>
                {/*
                  Parolni tiklash yo'li — odam orqali: pochta xizmati
                  ulanmagan. Havola emas, yo'l-yo'riq: ishlamaydigan
                  "tiklash" sahifasidan ko'ra kimga murojaat qilishni
                  aytgan yozuv foydaliroq.
                */}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => notify(t('login.forgotToast'))}
                >
                  {t('login.forgot')}
                </button>
              </div>

              <button
                type="submit"
                className="button auth-submit"
                disabled={loading}
                aria-busy={loading}
              >
                {t('login.submit')} <Icon name="arrow" />
              </button>

              <p className="auth-bottom-link">
                {t('login.noAccount')}{' '}
                <button type="button" className="text-button" onClick={() => switchMode('register')}>
                  {t('login.tabRegister')}
                </button>
              </p>

              {/*
                --- Demo hisoblar ---

                FAQAT demo rejimda. Haqiqiy backend ulanganda bu hisoblar
                mavjud emas: tugma bosilsa kirish rad etiladi, va sahifa
                o'z-o'zidan hammaga ko'rinadigan parolni yozib turadi.
              */}
              {USE_MOCK ? (
                <div className="auth-demo">
                  <p className="auth-demo-title">{t('auth.demoTitle')}</p>
                  <p className="auth-demo-hint">{t('auth.demoHint')}</p>
                  <div className="auth-demo-list">
                    {DEMO_ACCOUNTS.map((account) => (
                      <button
                        key={account.email}
                        type="button"
                        disabled={loading}
                        onClick={() => signInAsDemo(account.email)}
                      >
                        <span>
                          {t(`role.${account.role}`)}
                          <small>{account.email}</small>
                        </span>
                        <em>{t('login.submit')}</em>
                      </button>
                    ))}
                    {/*
                      BEMOR KABINETI — boshqa turdagi kirish. Bemorning parol
                      bilan kiradigan hisobi yo'q: haqiqiy ishlashda u Telegram
                      mini app orqali kiradi. Bu tugma o'sha yo'lning demosi.
                    */}
                    <button type="button" disabled={loading} onClick={() => void enterCabinet()}>
                      <span>
                        {t('cabinet.demoAccount')}
                        <small>{t('cabinet.medicalNotice')}</small>
                      </span>
                      <em>{t('login.submit')}</em>
                    </button>
                  </div>
                </div>
              ) : null}
            </form>

            {/* ================= RO'YXATDAN O'TISH ================= */}
            <form id="registerForm" hidden={!registering} onSubmit={submitRegister}>
              <div className="form-field">
                <label htmlFor="clinicName">{t('login.clinicName')}</label>
                <input
                  id="clinicName"
                  type="text"
                  placeholder={t('login.clinicNamePlaceholder')}
                  autoComplete="organization"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="registerName">{t('login.fullName')}</label>
                <input
                  id="registerName"
                  type="text"
                  placeholder={t('login.fullNamePlaceholder')}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="registerEmail">{t('login.email')}</label>
                <input
                  id="registerEmail"
                  type="email"
                  placeholder={t('login.contactEmailPlaceholder')}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="registerPassword">{t('login.password')}</label>
                <div className="password-field">
                  <input
                    id="registerPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder={t('login.newPasswordPlaceholder')}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={
                      showNewPassword ? t('login.hidePassword') : t('login.showPassword')
                    }
                    aria-pressed={showNewPassword}
                    onClick={() => setShowNewPassword((v) => !v)}
                  >
                    <Icon name="eye" />
                  </button>
                </div>
              </div>

              <button type="submit" className="button auth-submit">
                {t('login.registerSubmit')} <Icon name="arrow" />
              </button>
              <p className="form-note">{t('login.registerNote')}</p>
              <p className="auth-bottom-link">
                {t('login.haveAccount')}{' '}
                <button type="button" className="text-button" onClick={() => switchMode('login')}>
                  {t('login.tabLogin')}
                </button>
              </p>
            </form>
          </div>

          <footer className="auth-footer">
            <span>© {new Date().getFullYear()} ClinicOS</span>
            <Link to="/about">{t('login.about')}</Link>
          </footer>
        </section>

        {/* ================= TANISHTIRUV PANELI ================= */}
        <Link className="promo-panel" to="/about" aria-label={t('login.promoLabel')}>
          <span className="promo-tag">
            <Icon name="pulse" /> {t('login.promoTag')}
          </span>
          <h2 className="promo-title">
            <span>{t('login.promoTitle1')}</span>
            <br />
            {t('login.promoTitle2')}
            <br />
            {t('login.promoTitle3')}
          </h2>
          <p className="promo-description">
            {t('login.promoText1')}
            <br />
            {t('login.promoText2')}
          </p>
          <div className="promo-art">
            <img src={careImage} width={1536} height={1024} alt="" fetchPriority="high" />
          </div>
          <span className="promo-cta">
            {t('login.promoCta')} <Icon name="arrow" />
          </span>
          <div className="promo-footer">
            <span>
              <Icon name="calendar" /> {t('login.promoAppointments')}
            </span>
            <span>
              <Icon name="users" /> {t('login.promoPatients')}
            </span>
            <span>
              <Icon name="wallet" /> {t('login.promoFinance')}
            </span>
          </div>
        </Link>
      </main>

      <div className={cn('toast', toastShown && 'show')} id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}

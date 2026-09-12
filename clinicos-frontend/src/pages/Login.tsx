import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import {
  CLINIC_DIRECTIONS,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  LEAD_POSITIONS,
  register,
  registerStatus,
  STAFF_COUNTS,
} from '@/api/auth'
import { USE_MOCK } from '@/api/client'
import { PLATFORM_EMAIL_DOMAIN } from '@/components/ui/EmailLocalInput'
import { cn } from '@/lib/cn'
import { LANGS, useI18n } from '@/i18n'
import { getDb } from '@/mock/db'
import { useAuth } from '@/store/auth-context'
import { usePatient } from '@/store/patient-context'
import { AuthSelect } from '@/pages/public/AuthSelect'
import { Icon, IconSprite } from '@/pages/public/PublicIcons'
import careImage from '@/pages/public/assets/clinicos-care.png'
import '@/pages/public/public-base.css'

type Mode = 'login' | 'register'

/**
 * VILOYATLAR.
 *
 * Qo'lda yozilganda "Toshkent", "toshkent sh.", "Tashkent" — uchta
 * boshqa qiymat bo'lib tushardi va sotuvda hududni ajratib
 * bo'lmasdi. Ro'yxat bitta shaklni kafolatlaydi.
 */
const REGIONS = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Andijon viloyati',
  'Buxoro viloyati',
  'Farg‘ona viloyati',
  'Jizzax viloyati',
  'Xorazm viloyati',
  'Namangan viloyati',
  'Navoiy viloyati',
  'Qashqadaryo viloyati',
  'Qoraqalpog‘iston Respublikasi',
  'Samarqand viloyati',
  'Sirdaryo viloyati',
  'Surxondaryo viloyati',
] as const

/** Parol shuncha belgidan qisqa bo'lsa — ro'yxatdan o'tib bo'lmaydi */
const MIN_PASSWORD = 8

/**
 * Raqamni o'qiladigan qilib ajratadi: "90 123 45 67".
 *
 * Ajratilmasa `900000000000000000` ko'rinishida qo'shilib ketardi
 * va odam qayerda xato qilganini ko'rmasdi. Faqat raqamlar
 * qoldiriladi, uzunligi 9 ta bilan cheklanadi — kod (`+998`)
 * maydonning o'zida yozib qo'yilgan.
 */
function formatLocalPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)]
  return parts.filter(Boolean).join(' ')
}

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
  const { session, login, loading, error, applySession } = useAuth()
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

  /* --- Ro'yxatdan o'tish formasi --- */
  const [reg, setReg] = useState({
    clinicName: '',
    fullName: '',
    phone: '',
    position: 'owner' as (typeof LEAD_POSITIONS)[number],
    direction: 'general' as (typeof CLINIC_DIRECTIONS)[number],
    city: '',
    staffCount: '' as '' | (typeof STAFF_COUNTS)[number],
    password: '',
  })
  const [regBusy, setRegBusy] = useState(false)
  const [regError, setRegError] = useState('')
  /* Telegramda tasdiqlashni kutayotgan yozuv */
  const [verify, setVerify] = useState<{ code: string; url: string; phone: string } | null>(
    null,
  )

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

  /*
    TASDIQLANISHINI KUTAMIZ.

    Odam Telegramda tugmani bosishi bilan server sessiyani tayyor
    qilib qo'yadi; bu yerda uni olib, ichkariga kiritamiz. Har 3
    soniyada bir marta — bot javobi shu tartibda keladi va tez-tez
    so'rashning foydasi yo'q.
  */
  useEffect(() => {
    if (!verify) return
    let stop = false

    const timer = setInterval(async () => {
      if (stop) return
      try {
        const status = await registerStatus(verify.code)
        if (status.status === 'ready' && status.session) {
          stop = true
          clearInterval(timer)
          applySession(status.session)
        }
        if (status.status === 'expired') {
          stop = true
          clearInterval(timer)
          setVerify(null)
          setRegError(t('login.verifyExpired'))
        }
      } catch {
        /* Tarmoq uzilishi — keyingi urinishda qayta so'raladi */
      }
    }, 3000)

    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [verify, applySession, t])

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
    if (clean.includes('@')) return clean

    /*
      TELEFON BO'LSA TEGMAYMIZ.

      Yangi klinikalar raqam bilan ro'yxatdan o'tadi. Domen
      qo'shilsa `+998901234567@clinic-os.uz` bo'lib ketardi va
      hech qachon topilmasdi — sabab esa ataylab umumiy xabar
      ostida ko'rinmasdi.
    */
    if (/\d/.test(clean) && clean.replace(/\D/g, '').length >= 7) return clean

    return `${clean}@${PLATFORM_EMAIL_DOMAIN}`
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

  /**
   * RO'YXATDAN O'TISH — IKKI QADAM.
   *
   * Birinchi qadamda server hech narsa yaratmaydi: u Telegram
   * havolasini qaytaradi. Klinika odam raqamini ulashgandan keyin
   * ochiladi — ya'ni birovning raqami bilan hisob ochib bo'lmaydi.
   * Bepul SMS xizmati yo'q, Telegram esa raqamni o'zi tasdiqlaydi.
   */

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    if (regBusy) return

    setRegError('')
    setRegBusy(true)
    try {
      const started = await register({
        clinicName: reg.clinicName.trim(),
        fullName: reg.fullName.trim(),
        phone: `+998 ${reg.phone}`.trim(),
        position: reg.position,
        direction: reg.direction,
        city: reg.city.trim() || undefined,
        staffCount: reg.staffCount || undefined,
        password: reg.password,
      })
      /*
        HAVOLA O'ZI OCHILMAYDI.

        `window.open` ni server javobidan keyin chaqirsak, brauzer
        uni "foydalanuvchi bosmagan oyna" deb bloklaydi va odam
        hech narsa ko'rmay qolardi. Shuning uchun keyingi qadamda
        katta tugma chiqadi — uni bosish o'zi harakat bo'ladi.
      */
      setVerify(started)
    } catch (error) {
      setRegError(error instanceof Error ? error.message : t('toast.error'))
    } finally {
      setRegBusy(false)
    }
  }

  function signInAsDemo(demoEmail: string) {
    setEmail(demoEmail)
    setPassword(DEMO_PASSWORD)
    void login(demoEmail, DEMO_PASSWORD).catch(() => {})
  }

  /*
    RO'YXATDAN O'TISH TUGMASI QACHON YONADI.

    Barcha majburiy maydon to'ldirilgan va parol yetarli uzun
    bo'lgandagina. Yarim to'ldirilgan formani yuborib, server
    xatosini o'qib o'tirish — eng yomon birinchi taassurot.
  */
  const canRegister =
    reg.clinicName.trim().length >= 2 &&
    reg.fullName.trim().length >= 3 &&
    reg.phone.replace(/\D/g, '').length === 9 &&
    reg.city !== '' &&
    reg.password.length >= MIN_PASSWORD

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
              {/*
                TASDIQLASH QADAMI.

                Forma to'ldirilgach shu ko'rinish chiqadi va sahifa
                javobni kutib turadi. Odam Telegramda tugmani
                bosishi bilan o'zi ichkariga kiradi — qaytib kelib
                yana parol terib o'tirmaydi.
              */}
              {verify ? (
                <div className="auth-verify">
                  <p className="auth-verify-title">{t('login.verifyTitle')}</p>
                  <p className="auth-verify-text">
                    {t('login.verifyText', { phone: verify.phone })}
                  </p>
                  <a
                    className="button auth-submit"
                    href={verify.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('login.verifyOpen')} <Icon name="arrow" />
                  </a>
                  <p className="form-note">{t('login.verifyWaiting')}</p>
                  <p className="auth-bottom-link">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setVerify(null)}
                    >
                      {t('action.back')}
                    </button>
                  </p>
                </div>
              ) : (
                <>
              <div className="form-field">
                <label htmlFor="clinicName">{t('login.clinicName')}</label>
                <input
                  id="clinicName"
                  type="text"
                  placeholder={t('login.clinicNamePlaceholder')}
                  autoComplete="organization"
                  required
                  value={reg.clinicName}
                  onChange={(e) => setReg((v) => ({ ...v, clinicName: e.target.value }))}
                />
              </div>

              <AuthSelect
                id="registerDirection"
                label={t('login.direction')}
                value={reg.direction}
                options={CLINIC_DIRECTIONS.map((key) => ({
                  value: key,
                  label: t(`direction.${key}`),
                }))}
                onChange={(value) =>
                  setReg((v) => ({
                    ...v,
                    direction: value as (typeof CLINIC_DIRECTIONS)[number],
                  }))
                }
              />

              <div className="form-field">
                <label htmlFor="registerName">{t('login.fullName')}</label>
                <input
                  id="registerName"
                  type="text"
                  placeholder={t('login.fullNamePlaceholder')}
                  autoComplete="name"
                  required
                  value={reg.fullName}
                  onChange={(e) => setReg((v) => ({ ...v, fullName: e.target.value }))}
                />
              </div>

              <AuthSelect
                id="registerPosition"
                label={t('login.position')}
                value={reg.position}
                options={LEAD_POSITIONS.map((key) => ({
                  value: key,
                  label: t(`leadPosition.${key}`),
                }))}
                onChange={(value) =>
                  setReg((v) => ({
                    ...v,
                    position: value as (typeof LEAD_POSITIONS)[number],
                  }))
                }
              />

              {/*
                TELEFON — EMAIL O'RNIGA.

                Klinika rahbari pochtasini kamdan-kam ishlatadi,
                telefon esa har doim yonida. Kirish ham shu raqam
                bilan bo'ladi va sotuv ham shu raqamga qo'ng'iroq
                qiladi.
              */}
              <div className="form-field">
                <label htmlFor="registerPhone">{t('login.phone')}</label>
                {/*
                  KOD MAYDONNING O'ZIDA TURADI.

                  Odam faqat qolganini teradi va raqamlar bo'lakka
                  ajralib boradi — bir qarashda to'g'ri terilganini
                  ko'radi.
                */}
                <div className="phone-field">
                  <span className="phone-prefix">+998</span>
                  <input
                    id="registerPhone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="90 123 45 67"
                    autoComplete="tel-national"
                    required
                    value={reg.phone}
                    onChange={(e) =>
                      setReg((v) => ({ ...v, phone: formatLocalPhone(e.target.value) }))
                    }
                  />
                </div>
              </div>

              <AuthSelect
                id="registerCity"
                label={t('login.city')}
                value={reg.city}
                placeholder={t('login.cityPlaceholder')}
                options={REGIONS.map((region) => ({ value: region, label: region }))}
                onChange={(value) => setReg((v) => ({ ...v, city: value }))}
              />

              <AuthSelect
                id="registerSize"
                label={t('login.staffCount')}
                value={reg.staffCount}
                placeholder={t('login.staffCountPlaceholder')}
                options={STAFF_COUNTS.map((key) => ({
                  value: key,
                  label: t('login.staffCountValue', { range: key }),
                }))}
                onChange={(value) =>
                  setReg((v) => ({
                    ...v,
                    staffCount: value as '' | (typeof STAFF_COUNTS)[number],
                  }))
                }
              />

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
                    value={reg.password}
                    onChange={(e) => setReg((v) => ({ ...v, password: e.target.value }))}
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

              {/*
                PAROL UZUNLIGI KO'RINIB TURADI.

                Maydonda nuqtalar turadi va odam ularni ko'z bilan
                sanay olmaydi — "yetdimi yoki yo'qmi" degan savol
                javobsiz qolardi. Shuning uchun: sakkizta katakcha
                to'lib boradi va yonida aniq son turadi. Tugma ham
                shu shart bajarilmaguncha yonmaydi.
              */}
              <div className="pw-meter" aria-live="polite">
                <div className="pw-meter-track">
                  {Array.from({ length: MIN_PASSWORD }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'pw-meter-cell',
                        index < reg.password.length && 'is-filled',
                        reg.password.length >= MIN_PASSWORD && 'is-done',
                      )}
                    />
                  ))}
                </div>
                <span
                  className={cn(
                    'pw-meter-count',
                    reg.password.length >= MIN_PASSWORD && 'is-done',
                  )}
                >
                  {Math.min(reg.password.length, MIN_PASSWORD)}/{MIN_PASSWORD}
                </span>
              </div>

              {regError ? (
                <p className="auth-error" role="alert">
                  {regError}
                </p>
              ) : null}

              <button
                type="submit"
                className="button auth-submit"
                disabled={regBusy || !canRegister}
                aria-busy={regBusy}
              >
                {t('login.registerSubmit')} <Icon name="arrow" />
              </button>
              <p className="form-note">{t('login.registerNote')}</p>
                </>
              )}
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

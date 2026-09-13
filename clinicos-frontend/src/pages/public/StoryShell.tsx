import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'
import { Lang, translateText } from '@/pages/public/about-i18n'
import { Icon, IconSprite } from './PublicIcons'
import { PublicControls } from './PublicControls'
import { useStoryMotion, useStorySpotlight } from './story-motion'
import './public-base.css'
import './story.css'
import './landing-extra.css'
/* Qorong'i rejim — asl uslublardan KEYIN yuklanishi shart */
import './public-dark.css'

/**
 * TANISHTIRUV SAHIFALARINING QOBIG'I — tepa panel, pastki qism va
 * harakat.
 *
 * Uch sahifa bor: `/about` (klinika yoki apteka — tanlov), `/about/klinika`
 * va `/about/apteka`. Ular SOTUV TAQDIMOTI: mijoz o'zi kirib, sotuvchi
 * og'zaki beradigan savollarga javobni shu yerdan o'qiydi. Qobiq bitta
 * bo'lgani uchun uchalasi bir mahsulotdek ko'rinadi — tepada til va
 * rejim, logotip esa har doim kirish sahifasiga qaytaradi.
 */

export interface StoryNavItem {
  href: string
  label: string
}

export function StoryShell({
  title,
  nav,
  registerTo = '/login?mode=register',
  children,
}: {
  /** Brauzer sarlavhasi — o'zbekcha, tilga qarab o'giriladi */
  title: string
  nav: StoryNavItem[]
  registerTo?: string
  children: ReactNode
}) {
  const { lang } = useI18n()
  const root = useRef<HTMLDivElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useStoryMotion(root)
  useStorySpotlight(root)

  /* Bir sahifadan ikkinchisiga o'tilganda — tepadan boshlanadi */
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const previous = document.title
    document.title = `ClinicOS — ${translateText(lang, title)}`
    return () => {
      document.title = previous
    }
  }, [lang, title])

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

  return (
    <Lang>
      <div className="story-page" ref={root}>
        <IconSprite />
        <a href="#main" className="skip">
          Asosiy mazmunga o‘tish
        </a>

        <header className="header">
          <div className="wrap header-inner">
            <Link className="logo" to="/login" aria-label="ClinicOS bosh sahifa">
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
              {nav.map((item) =>
                item.href.startsWith('#') ? (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.href} to={item.href}>
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
            <div className="header-actions">
              {/* Til va rejim — har sahifada tepada, bir joyda */}
              <PublicControls />
              <Link className="login-button" to="/login">
                <Icon name="login" /> Kirish
              </Link>
              <Link className="button" to={registerTo}>
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

        <main id="main">{children}</main>

        <footer className="v3-footer">
          <div className="v3-wrap">
            <div className="v3-footer-top">
              <div>
                <Link className="logo" to="/login" aria-label="ClinicOS bosh sahifa">
                  <span className="logo-mark">
                    <Icon name="pulse" />
                  </span>
                  <span>
                    Clinic<em>OS</em>
                  </span>
                </Link>
                <p>Klinika va apteka uchun — bitta tizimda.</p>
              </div>
              <nav className="v3-footer-nav" aria-label="Pastki navigatsiya">
                <Link to="/about/klinika">Klinikalar uchun</Link>
                <Link to="/about/apteka">Aptekalar uchun</Link>
                <Link to="/login">Kirish</Link>
              </nav>
            </div>
            <div className="v3-footer-bottom">
              <span>© {new Date().getFullYear()} ClinicOS</span>
              <span>Xususiy klinikalar va aptekalar uchun boshqaruv tizimi.</span>
            </div>
          </div>
        </footer>
      </div>
    </Lang>
  )
}

/**
 * KLINIKA / APTEKA ALMASHTIRGICH — sahifa boshida.
 *
 * Sotuvchi bir uchrashuvda ikkala mahsulotni ko'rsatadi: bir bosishda
 * narigi tomonga o'tish kerak, tanlov sahifasiga qaytib emas.
 */
export function AudienceSwitch({ current }: { current: 'clinic' | 'pharmacy' }) {
  return (
    <Lang>
      <nav className="lx-audience" aria-label="Yo‘nalishni tanlang">
        <Link to="/about/klinika" aria-current={current === 'clinic' ? 'page' : undefined}>
          <Icon name="pulse" /> Klinikalar uchun
        </Link>
        <Link to="/about/apteka" aria-current={current === 'pharmacy' ? 'page' : undefined}>
          <Icon name="pill" /> Aptekalar uchun
        </Link>
      </nav>
    </Lang>
  )
}

/** "Qanday boshlaymiz" — to'rt qadam. Klinika va aptekada matni farq qiladi. */
export function StartSteps({
  steps,
}: {
  steps: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[]
}) {
  return (
    <Lang>
      <div className="lx-start">
        {steps.map((step, index) => (
          <article key={step.title} className="lx-start-card">
            <span className="lx-start-number">{String(index + 1).padStart(2, '0')}</span>
            <Icon name={step.icon} />
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </Lang>
  )
}

/** Kichik imkoniyat kartalari to'ri */
export function FeatureGrid({
  items,
}: {
  items: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[]
}) {
  return (
    <Lang>
      <div className="lx-features">
        {items.map((item) => (
          <article key={item.title} className="lx-feature">
            <span className="lx-feature-icon">
              <Icon name={item.icon} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </Lang>
  )
}

/** Savol-javob ro'yxati */
export function FaqList({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <Lang>
      <div>
        {items.map((item, index) => (
          <details key={item.q} open={index === 0}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </Lang>
  )
}

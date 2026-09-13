import { Link } from 'react-router-dom'

import { Lang } from '@/pages/public/about-i18n'
import { Icon } from './PublicIcons'
import { StoryShell } from './StoryShell'

/**
 * TANISHTIRUVNING BIRINCHI SAHIFASI — `/about`. IKKI ESHIK.
 *
 * Tizim ikki xil biznesga sotiladi: klinika va apteka. Ularning
 * savollari butunlay boshqa ("bemor kelmay qolsa?" va "kassadan pul
 * kam chiqsa?"), shuning uchun bitta sahifaga aralashtirilmaydi —
 * mijoz avval o'zini tanlaydi, keyin faqat o'ziga tegishli taqdimotni
 * ko'radi.
 */
export function AboutGatePage() {
  return (
    <StoryShell
      title="Klinika va apteka uchun boshqaruv tizimi"
      nav={[
        { href: '/about/klinika', label: 'Klinikalar uchun' },
        { href: '/about/apteka', label: 'Aptekalar uchun' },
      ]}
    >
      <Lang>
        <section className="v3-hero lx-gate" aria-labelledby="gate-title">
          <div className="v3-wrap">
            <div className="v3-hero-heading">
              <span className="v3-label">Xususiy klinika va aptekalar uchun</span>
              <h1 id="gate-title">
                Biznesingizga tartib.
                <br />
                Sizga <span className="v3-highlight">xotirjamlik.</span>
              </h1>
              <p>
                Biznesingizni tanlang — o‘sha yo‘nalish uchun imkoniyatlar, jonli demo va
                ko‘p so‘raladigan savollarga javoblar ochiladi.
              </p>
            </div>

            <div className="lx-doors">
              <Link className="lx-door lx-door-clinic" to="/about/klinika">
                <div className="lx-door-art" aria-hidden="true">
                  <div className="lx-door-window">
                    <div className="lx-door-window-top">
                      <span>Bugungi qabullar</span>
                      <small>Demo</small>
                    </div>
                    <div className="lx-door-row">
                      <b>09:00</b>
                      <span>M. Rasulova</span>
                      <i className="ok">Yakunlandi</i>
                    </div>
                    <div className="lx-door-row">
                      <b>09:30</b>
                      <span>D. Akbarova</span>
                      <i>Qabulda</i>
                    </div>
                    <div className="lx-door-row">
                      <b>10:00</b>
                      <span>B. Salimov</span>
                      <i>Tasdiqladi</i>
                    </div>
                  </div>
                </div>
                <div className="lx-door-body">
                  <span className="lx-door-tag">
                    <Icon name="pulse" /> Xususiy klinikalar
                  </span>
                  <h2>Klinikalar uchun</h2>
                  <p>
                    Qabullar, bemorlar, shifokorlar va kassa — qabuldan to‘lovgacha bitta
                    jarayon.
                  </p>
                  <ul className="lx-door-list">
                    <li>
                      <Icon name="check" /> Qabul jadvali va navbat
                    </li>
                    <li>
                      <Icon name="check" /> Bemorga Telegram orqali eslatma
                    </li>
                    <li>
                      <Icon name="check" /> Shifokorning telefonida ish joyi
                    </li>
                    <li>
                      <Icon name="check" /> Kassa va qarzdorlik nazorati
                    </li>
                  </ul>
                  <span className="lx-door-cta">
                    Klinikalar uchun ko‘rish <Icon name="arrow" />
                  </span>
                </div>
              </Link>

              <Link className="lx-door lx-door-pharmacy" to="/about/apteka">
                <div className="lx-door-art" aria-hidden="true">
                  <div className="lx-door-window">
                    <div className="lx-door-window-top">
                      <span>Joriy chek</span>
                      <small>Demo</small>
                    </div>
                    <div className="lx-door-row">
                      <b>×2</b>
                      <span>Paratsetamol 500 mg</span>
                      <i className="plain">7 000</i>
                    </div>
                    <div className="lx-door-row">
                      <b>×1</b>
                      <span>Ibuprofen 200 mg</span>
                      <i className="plain">12 500</i>
                    </div>
                    <div className="lx-door-row lx-door-total">
                      <b />
                      <span>Jami</span>
                      <i className="plain">19 500 so‘m</i>
                    </div>
                  </div>
                </div>
                <div className="lx-door-body">
                  <span className="lx-door-tag">
                    <Icon name="pill" /> Dorixonalar
                  </span>
                  <h2>Aptekalar uchun</h2>
                  <p>
                    Kassa, dori zaxirasi, muddatlar va smenalar — kirimdan kassagacha nazorat.
                  </p>
                  <ul className="lx-door-list">
                    <li>
                      <Icon name="check" /> Shtrix-kod bilan tezkor kassa
                    </li>
                    <li>
                      <Icon name="check" /> Partiya va muddat nazorati
                    </li>
                    <li>
                      <Icon name="check" /> Smena va kassa kamomadi
                    </li>
                    <li>
                      <Icon name="check" /> Klinikalardan onlayn retsept
                    </li>
                  </ul>
                  <span className="lx-door-cta">
                    Aptekalar uchun ko‘rish <Icon name="arrow" />
                  </span>
                </div>
              </Link>
            </div>

            <div className="v3-trust">
              <span>
                <Icon name="rocket" /> 14 kun bepul
              </span>
              <span>
                <Icon name="shield" /> Karta ma’lumoti so‘ralmaydi
              </span>
              <span>
                <Icon name="globe" /> O‘zbek · Русский · English
              </span>
              <span>
                <Icon name="telegram" /> Telegram bilan bog‘langan
              </span>
            </div>

            <p className="lx-gate-login">
              <Link to="/login">Hisobingiz bormi? Kirish ↗</Link>
            </p>
          </div>
        </section>
      </Lang>
    </StoryShell>
  )
}

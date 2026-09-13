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
 * APTEKALAR UCHUN TAQDIMOT — `/about/apteka`.
 *
 * SOTUV SAVOLLARI ATROFIDA QURILGAN. Apteka egasi tizim haqida emas,
 * o'z og'rig'i haqida so'raydi: "kassadan pul kam chiqsa?", "muddati
 * o'tgan dori sotilib ketmaydimi?", "sotuvchi foydani ko'radimi?".
 * Shuning uchun har bir karta sarlavhasi — shu savolning o'zi, matni
 * esa tizimda HAQIQATDA qanday ishlashi. Tizimda yo'q narsa bu yerga
 * yozilmaydi: sotuvda berilgan va'da ertasiga mijozning savoliga
 * aylanadi.
 *
 * Ismlar, summalar va kodlar — NAMUNA, har blokda "Demo" yozuvi bor.
 */

type Scene = 'owner' | 'seller'
type Step = 'purchase' | 'sale' | 'shift'

const REGISTER = '/login?mode=register&direction=pharmacy'

const SIDE_NAV: { icon: PublicIconName; label: string }[] = [
  { icon: 'wallet', label: 'Kassa' },
  { icon: 'pill', label: 'Dorilar' },
  { icon: 'box', label: 'Zaxira' },
  { icon: 'file', label: 'Kelgan retseptlar' },
  { icon: 'clock', label: 'Smena' },
  { icon: 'chart', label: 'Analitika' },
]

const SCENES: Record<Scene, { name: string; initials: string; nav: number }> = {
  owner: { name: 'Apteka rahbari', initials: 'AR', nav: 5 },
  seller: { name: 'Sotuvchi', initials: 'SV', nav: 0 },
}

export function PharmacyAboutPage() {
  const dashboard = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)
  const [scene, setScene] = useState<Scene>('owner')
  const [step, setStep] = useState<Step>('purchase')

  useDemoChange(scene, dashboard)
  useDemoChange(step, flow)

  const current = SCENES[scene]

  return (
    <StoryShell
      title="Dorixonangizga tartib. Kassangizga aniqlik."
      registerTo={REGISTER}
      nav={[
        { href: '#imkoniyatlar', label: 'Imkoniyatlar' },
        { href: '#retsept', label: 'Onlayn retsept' },
        { href: '#boshlash', label: 'Boshlash' },
        { href: '#savollar', label: 'Savollar' },
      ]}
    >
      <Lang>
        <>
          {/* ================= HERO ================= */}
          <section className="v3-hero" aria-labelledby="ph-title">
            <div className="v3-wrap">
              <div className="v3-hero-heading">
                <AudienceSwitch current="pharmacy" />
                <span className="v3-label">Dorixonalar uchun yaratilgan</span>
                <h1 id="ph-title">
                  Dorixonangizga tartib.
                  <br />
                  Kassangizga <span className="v3-highlight">aniqlik.</span>
                </h1>
                <p>
                  Kassa, dori zaxirasi, muddatlar va xodimlar — bir tizimda.
                  <br />
                  Kun oxirida kassa nega farq qilganini aniq bilasiz.
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
                  Kirimdan
                  <br />
                  kassagacha.
                </span>
              </div>

              <div className="v3-workspace" id="demo">
                <div className="v3-rolebar">
                  <span className="v3-demo-label">
                    <Icon name="grid" /> Bir apteka. Har kimga o‘z ish joyi.
                  </span>
                  <div className="v3-role-picker" role="group" aria-label="Demo uchun rolni tanlang">
                    <RoleButton value="owner" icon="chart" current={scene} onPick={setScene}>
                      Apteka rahbari
                    </RoleButton>
                    <RoleButton value="seller" icon="wallet" current={scene} onPick={setScene}>
                      Sotuvchi
                    </RoleButton>
                  </div>
                </div>

                <div className="v3-console">
                  <aside className="v3-side" aria-label="Mahsulot menyusi namunasi">
                    <div className="v3-side-logo">
                      <Icon name="pulse" /> ClinicOS
                    </div>
                    <div className="v3-side-section">DORIXONA</div>
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
                    role="region"
                    aria-label="Tanlangan rolning ish joyi"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {scene === 'owner' ? <OwnerScene /> : <SellerScene />}
                  </div>
                </div>

                <div className="v3-under-console">
                  <span>Rollarni almashtirib, ish joylari bilan tanishing. Bu — demo.</span>
                  <Link to="/login">Hisobingiz bormi? Kirish ↗</Link>
                </div>
              </div>

              <div className="v3-trust">
                <span>
                  <Icon name="scan" /> Shtrix-kod va DataMatrix
                </span>
                <span>
                  <Icon name="clock" /> Partiya va muddat
                </span>
                <span>
                  <Icon name="shield" /> Rahbar va sotuvchi alohida
                </span>
                <span>
                  <Icon name="globe" /> O‘zbek · Русский · English
                </span>
              </div>
            </div>
          </section>

          {/* ================= SAVOL — JAVOB KARTALARI ================= */}
          <section className="v3-section" id="imkoniyatlar" aria-labelledby="ph-features-title">
            <div className="v3-wrap">
              <div className="v3-section-heading">
                <div>
                  <span className="v3-label">Apteka egalari so‘raydi</span>
                  <h2 id="ph-features-title">
                    Savolingiz —
                    <br />
                    tizimdagi javobi.
                  </h2>
                </div>
                <p>
                  Tizim o‘rnatishdan oldin eng ko‘p beriladigan savollar. Har biriga — tizim
                  ichida qanday ishlashi.
                </p>
              </div>

              <div className="v3-bento">
                <article className="v3-card v3-calendar-card">
                  <div className="v3-card-copy">
                    <div className="v3-card-tag">
                      <Icon name="wallet" /> Kassa kamomadi
                    </div>
                    <h3>
                      Kassadan pul kam chiqsa,
                      <br />
                      qanday bilaman?
                    </h3>
                    <p>
                      Sotuvchi smenani yopishda naqd pulni sanab yozadi. Summa tizimdagidan kam
                      bo‘lsa, u ogohlantiriladi. Shunday qoldirsa — yozuv sizning ro‘yxatingizda
                      alohida belgilanadi.
                    </p>
                  </div>
                  <div className="v3-calendar-art">
                    <div className="lx-shift">
                      <div className="v3-schedule-top">
                        Smenani yopish <span>Demo</span>
                      </div>
                      <div className="lx-shift-rows">
                        <div>
                          <span>Naqd savdo (tizim)</span>
                          <strong>2 150 000 so‘m</strong>
                        </div>
                        <div>
                          <span>Sanalgan naqd</span>
                          <strong>2 125 000 so‘m</strong>
                        </div>
                      </div>
                      <div className="lx-shift-warn">
                        <Icon name="bell" />
                        <div>
                          <strong>Tizim summasidan 25 000 so‘m kam</strong>
                          <small>Rahbar ro‘yxatida alohida belgilanadi</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="v3-card v3-telegram-card">
                  <div className="v3-card-copy">
                    <div className="v3-card-tag">
                      <Icon name="clock" /> Muddat nazorati
                    </div>
                    <h3>
                      Muddati o‘tgan dori
                      <br />
                      sotilib ketmaydimi?
                    </h3>
                    <p>
                      Har bir partiya muddati bilan yoziladi. Muddati o‘tgani kassada chiqmaydi,
                      90 kundan kam qolganlari alohida ro‘yxatda turadi.
                    </p>
                  </div>
                  <div className="v3-telegram-art">
                    <div className="v3-phone-msg lx-batches">
                      <div className="v3-msg-head">
                        <Icon name="clock" />
                        <div>
                          Muddati yaqin<small>Zaxira · Namuna</small>
                        </div>
                      </div>
                      <div className="lx-batch">
                        <span>
                          Amoksitsillin 500 mg<small>Partiya B-2311</small>
                        </span>
                        <i className="bad">18 kun</i>
                      </div>
                      <div className="lx-batch">
                        <span>
                          Sefazolin 1 g<small>Partiya B-2402</small>
                        </span>
                        <i className="warn">46 kun</i>
                      </div>
                      <div className="lx-batch">
                        <span>
                          Vitamin D3<small>Partiya B-2405</small>
                        </span>
                        <i>83 kun</i>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="v3-card v3-patient-card">
                  <div className="v3-card-copy">
                    <div className="v3-card-tag">
                      <Icon name="scan" /> Tezkor kassa
                    </div>
                    <h3>
                      Dori qidirib,
                      <br />
                      navbat yig‘ilmaydimi?
                    </h3>
                    <p>
                      Qutini skanerlang — dori chekka tushadi. Kirimda esa DataMatrix kodidan
                      partiya va muddat o‘zi o‘qiladi.
                    </p>
                  </div>
                  <div className="v3-record">
                    <div className="v3-record-head">
                      <span className="v3-avatar">
                        <Icon name="scan" />
                      </span>
                      <div>
                        Ibuprofen 200 mg<small>Kirim · skanerdan · Demo</small>
                      </div>
                    </div>
                    <div className="v3-record-line">
                      Partiya<strong>B-2407</strong>
                    </div>
                    <div className="v3-record-line">
                      Muddati<strong>2027-yil, mart</strong>
                    </div>
                    <div className="v3-record-line">
                      Narxi<strong>12 500 so‘m</strong>
                    </div>
                  </div>
                </article>

                <article className="v3-card v3-permissions-card">
                  <div className="v3-card-copy">
                    <div className="v3-card-tag">
                      <Icon name="shield" /> Xodimlar va ruxsatlar
                    </div>
                    <h3>
                      Sotuvchi tannarx va
                      <br />
                      foydani ko‘radimi?
                    </h3>
                    <p>
                      Yo‘q. Sotuvchi kassa va smenani ko‘radi. Tannarx, foyda, kirim va kassa
                      nazorati — faqat rahbarda.
                    </p>
                  </div>
                  <div className="v3-permissions">
                    <div className="v3-role-chip">
                      <Icon name="chart" />
                      <strong>Apteka rahbari</strong>
                      <small>Nazorat qiladi</small>
                    </div>
                    <div className="v3-role-chip">
                      <Icon name="wallet" />
                      <strong>Sotuvchi</strong>
                      <small>Sotadi</small>
                    </div>
                    <div className="v3-role-chip">
                      <Icon name="box" />
                      <strong>Kirim huquqi</strong>
                      <small>Tovar qabul qiladi</small>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>

          {/* ================= JARAYON ================= */}
          <section className="v3-section v3-process" id="jarayon" aria-labelledby="ph-process-title">
            <div className="v3-wrap v3-process-grid">
              <div className="v3-process-copy">
                <span className="v3-label">Dorining aptekadagi yo‘li</span>
                <h2 id="ph-process-title">
                  Kirimdan
                  <br />
                  kassagacha.
                </h2>
                <p>
                  Bosqichni tanlang: tovar kelganidan kun yakunigacha ma’lumot qanday
                  bog‘lanishini ko‘ring.
                </p>
                <div className="v3-steps" role="group" aria-label="Bosqichni tanlang">
                  <StepButton value="purchase" number="01" current={step} onPick={setStep}>
                    <strong>Tovar qabul qilinadi</strong>
                    <small>Ta’minotchi hujjati bo‘yicha</small>
                  </StepButton>
                  <StepButton value="sale" number="02" current={step} onPick={setStep}>
                    <strong>Chek uriladi</strong>
                    <small>Sotuvchi skanerlaydi</small>
                  </StepButton>
                  <StepButton value="shift" number="03" current={step} onPick={setStep}>
                    <strong>Kassa topshiriladi</strong>
                    <small>Naqd pul sanaladi</small>
                  </StepButton>
                </div>
              </div>
              <div className="v3-process-stage">
                <div
                  ref={flow}
                  className="v3-flow-card"
                  role="region"
                  aria-label="Tanlangan bosqich"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <Flow step={step} />
                </div>
              </div>
            </div>
          </section>

          {/* ================= ONLAYN RETSEPT ================= */}
          <section className="v3-section v3-money" id="retsept" aria-labelledby="ph-rx-title">
            <div className="v3-wrap v3-money-grid">
              <div className="v3-money-copy">
                <span className="v3-label">Yangi xaridorlar</span>
                <h2 id="ph-rx-title">
                  Klinika retsepti
                  <br />
                  <span>aptekangizga keladi.</span>
                </h2>
                <p>
                  ClinicOS’dagi klinikalarda shifokor retsept yozganda, bemorga uchta apteka
                  narxi bilan taklif qilinadi. Tanlangan aptekaga retsept onlayn keladi — dorini
                  oldindan tayyorlab qo‘yasiz.
                </p>
                <ul className="lx-points">
                  <li>
                    <Icon name="check" /> Narx aptekangiz katalogidan hisoblanadi
                  </li>
                  <li>
                    <Icon name="check" /> Taklif navbat bilan — har safar bir xil apteka chiqmaydi
                  </li>
                  <li>
                    <Icon name="check" /> Bemor retsept kodi bilan keladi
                  </li>
                </ul>
              </div>
              <div className="v3-money-panel">
                <div className="v3-money-top">
                  Kelgan retsept <small>Demo</small>
                </div>
                <div className="v3-comparison">
                  <div className="v3-money-number">
                    <span>RETSEPT KODI</span>
                    <strong>K7M2QX</strong>
                    <small>bemor ko‘rsatadi</small>
                  </div>
                  <div className="v3-money-number">
                    <span>TAXMINIY SUMMA</span>
                    <strong>42 000</strong>
                    <small>so‘m · katalog narxida</small>
                  </div>
                </div>
                <div className="lx-rx-lines">
                  <div>
                    <span>Amoksitsillin 500 mg</span>
                    <b>1 quti</b>
                  </div>
                  <div>
                    <span>Paratsetamol 500 mg</span>
                    <b>2 dona</b>
                  </div>
                </div>
                <div className="v3-reconcile">
                  <span>
                    <Icon name="check" /> Dori tayyorlab qo‘yildi
                  </span>
                  <strong>Tayyor</strong>
                </div>
                <p>Namunaviy retsept. Haqiqiy bemor ma’lumoti emas.</p>
              </div>
            </div>
          </section>

          {/* ================= KENGROQ IMKONIYATLAR ================= */}
          <section className="v3-section" aria-labelledby="ph-more-title">
            <div className="v3-wrap">
              <div className="v3-section-heading">
                <div>
                  <span className="v3-label">Kengroq imkoniyatlar</span>
                  <h2 id="ph-more-title">
                    Rahbarga kerak
                    <br />
                    bo‘lgan hammasi.
                  </h2>
                </div>
                <p>Kundalik savdodan tashqari — aptekani boshqarishga kerak bo‘ladigan ishlar.</p>
              </div>
              <FeatureGrid
                items={[
                  {
                    icon: 'trend',
                    title: 'Analitika',
                    text: 'Tushum, foyda, ustama va o‘rtacha chek. Eng ko‘p sotilgan va umuman sotilmayotgan tovar alohida.',
                  },
                  {
                    icon: 'box',
                    title: 'Kirim va ta’minotchilar',
                    text: 'Har bir kirim hujjat raqami, partiya, muddat va tannarx bilan. Qaysi ta’minotchidan nima kelgani ko‘rinadi.',
                  },
                  {
                    icon: 'users',
                    title: 'Smena jadvali',
                    text: 'Kim qaysi kun va soatda kassada ekanini tizim biladi. Farq kimning smenasida chiqqani ko‘rinadi.',
                  },
                  {
                    icon: 'file',
                    title: 'Excel’dan ko‘chirish',
                    text: 'Dori katalogi va ta’minotchilar Excel jadvalidan (CSV) bir marta yuklanadi — bittalab kiritish shart emas.',
                  },
                  {
                    icon: 'grid',
                    title: 'Hisobotni yuklab olish',
                    text: 'Savdo, kirim, zaxira va smenalar — Excel’da ochiladigan faylga yoki Google Sheets jadvaliga.',
                  },
                  {
                    icon: 'lock',
                    title: 'Ishdan ketgan xodim',
                    text: 'Kirishi o‘sha zahoti yopiladi. Uning savdo va smena tarixi esa saqlanib qoladi.',
                  },
                ]}
              />
            </div>
          </section>

          {/* ================= QANDAY BOSHLAYMIZ ================= */}
          <section className="v3-section v3-process" id="boshlash" aria-labelledby="ph-start-title">
            <div className="v3-wrap">
              <div className="v3-section-heading">
                <div>
                  <span className="v3-label">Qanday boshlaymiz?</span>
                  <h2 id="ph-start-title">
                    Bugun ro‘yxatdan o‘ting,
                    <br />
                    ertaga soting.
                  </h2>
                </div>
                <p>Dastur o‘rnatilmaydi — kompyuter yoki planshetda brauzer orqali ishlaydi.</p>
              </div>
              <StartSteps
                steps={[
                  {
                    icon: 'phone',
                    title: 'Ro‘yxatdan o‘ting',
                    text: 'Telefon raqamingiz Telegram orqali tasdiqlanadi. Bir necha daqiqa.',
                  },
                  {
                    icon: 'file',
                    title: 'Dorilarni yuklang',
                    text: 'Katalogni Excel jadvalidan ko‘chiring yoki birinchi kirimda yozing.',
                  },
                  {
                    icon: 'users',
                    title: 'Sotuvchilarni qo‘shing',
                    text: 'Har biriga login va ish vaqti. Parolni birinchi kirishda o‘zi almashtiradi.',
                  },
                  {
                    icon: 'rocket',
                    title: '14 kun bepul ishlang',
                    text: 'Karta ma’lumoti so‘ralmaydi. Sinov davomida menejerimiz siz bilan bog‘lanadi.',
                  },
                ]}
              />
            </div>
          </section>

          {/* ================= SAVOLLAR ================= */}
          <section className="v3-section v3-faq" id="savollar" aria-labelledby="ph-faq-title">
            <div className="v3-wrap v3-faq-grid">
              <div className="v3-faq-copy">
                <span className="v3-label">Savol-javob</span>
                <h2 id="ph-faq-title">
                  Boshlashdan
                  <br />
                  oldin.
                </h2>
                <p>Apteka egalari uchrashuvda eng ko‘p so‘raydigan savollar.</p>
              </div>
              <FaqList
                items={[
                  {
                    q: 'Narxi qancha? Bepul sinab ko‘rsa bo‘ladimi?',
                    a: 'Birinchi 14 kun — bepul, karta ma’lumoti so‘ralmaydi. Sinov davomida menejerimiz bog‘lanib, aptekangiz hajmiga mos tarifni taklif qiladi.',
                  },
                  {
                    q: 'Qanday uskuna kerak?',
                    a: 'Internetga ulangan kompyuter, noutbuk yoki planshet. Dastur o‘rnatilmaydi — brauzerda ishlaydi. Shtrix-kod skaneri bo‘lsa, dori qidirmasdan chekka tushadi; usiz ham ishlash mumkin.',
                  },
                  {
                    q: 'Dorilarimni bittalab kiritib chiqishim kerakmi?',
                    a: 'Yo‘q. Dori katalogi va ta’minotchilar ro‘yxatini Excel jadvalidan (CSV fayl) yuklaysiz. Tizim avval nima qo‘shilishini ko‘rsatadi, keyin saqlaydi — bor dorilar takrorlanmaydi.',
                  },
                  {
                    q: 'Bir nechta sotuvchi ishlasa-chi?',
                    a: 'Har bir sotuvchi o‘z logini bilan kiradi. Ish vaqtiga qarab kassa kimda ekanini tizim biladi, kassa farqi esa kimning smenasida chiqqani bilan yoziladi.',
                  },
                  {
                    q: 'Klinikalardan retsept qanday keladi?',
                    a: 'ClinicOS’dagi klinikada shifokor retsept yozganda bemorga uchta apteka narxi bilan taklif qilinadi. Bemor sizni tanlasa, retsept «Kelgan retseptlar» bo‘limiga tushadi: dorini tayyorlab «Tayyor», bergach «Berildi» deb belgilaysiz.',
                  },
                  {
                    q: 'Ma’lumotlarim xavfsizmi?',
                    a: 'Har bir aptekaning ma’lumoti alohida saqlanadi — boshqa apteka yoki klinika sizning dori, savdo va kassa ma’lumotingizni ko‘rmaydi. Sotuvchi esa faqat o‘z ishiga kerak bo‘lgan qismini ko‘radi.',
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
                  Aptekangizni
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
      <button type="button" aria-pressed={current === value} onClick={() => onPick(value)}>
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
        onClick={() => onPick(value)}
      >
        <span>{number}</span>
        <span>{children}</span>
      </button>
    </Lang>
  )
}

/* ------------------------------------------------------------------ */
/* Ish joylari — NAMUNA                                                */
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

function ShiftRow({
  initials,
  name,
  sub,
  state,
  tone,
}: {
  initials: string
  name: string
  sub: string
  state: string
  tone?: 'blue' | 'warn'
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
        <span className={cn('v3-state', tone)}>{state}</span>
      </div>
    </Lang>
  )
}

function ConsoleNote() {
  return (
    <Lang>
      <div className="v3-console-note">
        <span>
          <Icon name="shield" /> Aptekangiz ma’lumotlari bir joyda
        </span>
        <span>Demo · Ismlar va raqamlar namunaviy</span>
      </div>
    </Lang>
  )
}

function OwnerScene() {
  return (
    <Lang>
      <>
        <ConsoleTop title="Aptekangiz bugun" text="Tushum, foyda va kassa — umumiy ko‘rinishda." />
        <div className="v3-metrics">
          <Metric label="Bugungi tushum" icon="wallet" value="6 240 000" unit="so‘m" note="Naqd va karta orqali" />
          <Metric label="Bugungi foyda" icon="trend" value="1 480 000" unit="so‘m" note="O‘rtacha ustama 24%" />
          <Metric label="Muddati yaqin" icon="clock" value="14" unit="partiya" note="90 kun ichida tugaydi" />
        </div>
        <div className="v3-console-panels">
          <div className="v3-chart-panel">
            <div className="v3-panel-title">
              Haftalik tushum <span>Namunaviy ko‘rinish</span>
            </div>
            <svg className="v3-chart-svg" viewBox="0 0 400 125" role="img" aria-label="Namunaviy haftalik tushum chizig‘i">
              <defs>
                <linearGradient id="phChartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#bdd2ff" stopOpacity=".65" />
                  <stop offset="1" stopColor="#ecf3ff" stopOpacity=".1" />
                </linearGradient>
              </defs>
              <g stroke="#edf1f8" strokeDasharray="3 4">
                <path d="M0 15h400M0 45h400M0 75h400M0 105h400" />
              </g>
              <path
                d="M0 88C30 84 40 70 70 72S105 58 135 62 170 40 200 48 238 30 265 38 300 22 330 30 370 14 400 18V125H0Z"
                fill="url(#phChartFill)"
              />
              <path
                d="M0 88C30 84 40 70 70 72S105 58 135 62 170 40 200 48 238 30 265 38 300 22 330 30 370 14 400 18"
                fill="none"
                stroke="#5387f5"
                strokeWidth="2.5"
              />
              <circle cx="330" cy="30" r="5" fill="#5387f5" stroke="white" strokeWidth="2" />
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
              Smenalar <span>Kassa nazorati</span>
            </div>
            <ShiftRow initials="KS" name="Kamola Saidova" sub="Kecha · 08:00–20:00" state="Kassa to‘g‘ri" />
            <ShiftRow initials="JT" name="Jasur Toshev" sub="Bugun · 20:00 gacha" state="Smenada" tone="blue" />
            <ShiftRow initials="NR" name="Nodira Rahimova" sub="10-sentabr" state="25 000 kam" tone="warn" />
          </div>
        </div>
        <ConsoleNote />
      </>
    </Lang>
  )
}

function SellerScene() {
  return (
    <Lang>
      <>
        <ConsoleTop title="Kassa" text="Qutini skanerlang — dori chekka tushadi." />
        <div className="v3-metrics">
          <Metric label="Bugungi cheklar" icon="file" value="86" unit="chek" note="O‘rtacha chek 72 000 so‘m" />
          <Metric label="Kassadagi naqd" icon="wallet" value="2 150 000" unit="so‘m" note="Smena oxirida sanaladi" />
          <Metric label="Kelgan retseptlar" icon="pill" value="3" unit="retsept" note="Klinikalardan onlayn" />
        </div>
        <div className="v3-console-panels">
          <div className="v3-list-panel lx-receipt">
            <div className="v3-panel-title">
              Joriy chek <span>Namuna</span>
            </div>
            <div className="lx-receipt-line">
              <span>
                Paratsetamol 500 mg<small>2 dona</small>
              </span>
              <b>7 000</b>
            </div>
            <div className="lx-receipt-line">
              <span>
                Ibuprofen 200 mg<small>1 dona</small>
              </span>
              <b>12 500</b>
            </div>
            <div className="lx-receipt-line">
              <span>
                Loratadin 10 mg<small>1 dona</small>
              </span>
              <b>9 000</b>
            </div>
            <div className="lx-receipt-total">
              <span>Jami</span>
              <strong>28 500 so‘m</strong>
            </div>
            <div className="lx-pay">
              <span>Naqd</span>
              <span className="active">Karta</span>
            </div>
          </div>
          <div className="v3-chart-panel">
            <div className="v3-panel-title">
              Skanerdan <span>Demo</span>
            </div>
            <div className="lx-scan">
              <Icon name="scan" />
              <strong>Shtrix-kod o‘qildi</strong>
            </div>
            <dl className="v3-flow-dl">
              <div>
                <dt>Dori</dt>
                <dd>Ibuprofen 200 mg</dd>
              </div>
              <div>
                <dt>Partiya</dt>
                <dd>B-2407 · 2027-yil, mart</dd>
              </div>
              <div>
                <dt>Qoldiq</dt>
                <dd>38 dona</dd>
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
/* Jarayon bosqichlari — NAMUNA                                        */
/* ------------------------------------------------------------------ */

const FLOWS: Record<
  Step,
  { icon: PublicIconName; badge: string; title: string; text: string; rows: [string, string][]; confirm: string }
> = {
  purchase: {
    icon: 'box',
    badge: 'KIRIM',
    title: 'Tovar zaxiraga tushdi.',
    text: 'Har bir qator partiya, muddat va tannarx bilan yoziladi. Dori katalogda bo‘lmasa, shu yerning o‘zida ochiladi.',
    rows: [
      ['Ta’minotchi', 'Farm Distribyutor'],
      ['Qatorlar', '24 ta'],
      ['Jami tannarx', '18 400 000 so‘m'],
    ],
    confirm: 'Kirim qabul qilindi · Namuna',
  },
  sale: {
    icon: 'wallet',
    badge: 'KASSA',
    title: 'Chek urildi.',
    text: 'Kassada eng yaqin muddatli partiya birinchi turadi. Sotilgan dori zaxiradan o‘zi ayiriladi.',
    rows: [
      ['Chekda', '3 ta dori'],
      ['To‘lov usuli', 'Karta'],
      ['Summa', '28 500 so‘m'],
    ],
    confirm: 'Savdo zaxiradan ayirildi',
  },
  shift: {
    icon: 'clock',
    badge: 'SMENA',
    title: 'Smena yopildi.',
    text: 'Sotuvchi naqd pulni sanab yozadi. Farq chiqsa, rahbar kimning smenasida va qancha ekanini ko‘radi.',
    rows: [
      ['Sotuvchi', 'Kamola Saidova'],
      ['Naqd (tizim)', '2 150 000 so‘m'],
      ['Farq', '0 so‘m'],
    ],
    confirm: 'Kassa to‘g‘ri topshirildi',
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

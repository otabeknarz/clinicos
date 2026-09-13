import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * TANISHTIRUV SAHIFALARINING HARAKATI — klinika, apteka va tanlov
 * sahifasi uchun UMUMIY. Bitta joyda: uch sahifa bir xil "his"
 * berishi kerak, nusxalansa biri albatta boshqacha bo'lib qoladi.
 */

export const DEMO_CHANGE = 'clinicos:demo-change'

/* ------------------------------------------------------------------ */
/* Harakat                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rol yoki bosqich almashganda — yangi mazmun chizilgach — harakat
 * qatlamiga xabar beradi. Birinchi chizishda xabar yo'q: prototipda
 * ham boshlang'ich holat animatsiyasiz turadi.
 */
export function useDemoChange(value: string, target: RefObject<HTMLElement | null>) {
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
export function useStoryMotion(rootRef: RefObject<HTMLElement | null>) {
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
        '.v3-workspace,.v3-section-heading,.v3-card,.v3-process-copy,.v3-process-stage,.v3-money-copy,.v3-money-panel,.v3-extra,.v3-faq-copy,.v3-final,.lx-door,.lx-feature,.lx-start-card,.lx-split-copy,.lx-split-art',
      )
      .forEach((element, index) => {
        if (element.matches('.v3-card,.v3-extra,.lx-door,.lx-feature,.lx-start-card')) {
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
export function useStorySpotlight(rootRef: RefObject<HTMLElement | null>) {
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
        const card = target?.closest<HTMLElement>('.v3-card, .v3-extra, .v3-final, .lx-door, .lx-feature, .lx-start-card')
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

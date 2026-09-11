/**
 * ASL ClinicOS LOGOTIPI — tasdiqlangan kirish sahifasi va tanishtiruv
 * (`pages/Login.tsx`, `pages/public/`) bilan bir xil: ko'k kvadrat
 * ichida yurak urishi chizig'i, yonida "Clinic" + ko'k "OS".
 *
 * Ish panellarida ilgari boshqa belgi (binafsha kvadrat, boshqa ikonka)
 * turardi — kirishdan keyin brend "almashib" qolardi. Rang va chizma
 * shu yerda bir marta: `favicon.svg` ham shu belgidan.
 */

const BRAND_BLUE = '#2563eb'

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center text-white shadow-[0_6px_14px_-6px_rgb(37_99_235/0.7)]"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: BRAND_BLUE,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.72)}
        height={Math.round(size * 0.72)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 12h4l3-7 4 14 3-7h4" />
      </svg>
    </span>
  )
}

export function BrandWordmark() {
  return (
    <span className="tracking-[-0.04em]">
      Clinic<span style={{ color: BRAND_BLUE }}>OS</span>
    </span>
  )
}

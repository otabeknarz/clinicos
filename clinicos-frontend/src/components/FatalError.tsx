/**
 * Oxirgi chora.
 *
 * Ichkaridagi qatlam sahifa xatosini ushlaydi. Bu esa undan ham
 * tashqarida: agar tema, til yoki sessiya qatlamining o'zi qulasa,
 * ichkaridagi ushlagich ham ishlamaydi.
 *
 * Shu sababli bu yerda hech qanday komponent, tarjima yoki uslub
 * ishlatilmaydi — faqat sof HTML. Aks holda xato beruvchi narsaning
 * o'ziga tayanib qolgan bo'lardik.
 */
export function FatalError({ retry }: { retry: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        color: '#1c1c1e',
        background: '#f2f2f7',
      }}
    >
      <div style={{ maxWidth: '380px' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600 }}>
          Ilova ishga tushmadi
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#6c6c70' }}>
          Kutilmagan xato yuz berdi. Qayta urinib ko‘ring — muammo takrorlansa,
          sahifani to‘liq yangilang.
        </p>
        <button
          type="button"
          onClick={retry}
          style={{
            border: 0,
            borderRadius: '10px',
            padding: '10px 20px',
            fontSize: '15px',
            fontWeight: 600,
            color: '#fff',
            background: '#0a84ff',
            cursor: 'pointer',
          }}
        >
          Qayta urinish
        </button>
      </div>
    </div>
  )
}

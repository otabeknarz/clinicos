"""Kirish va tanishtiruv sahifalarining CSS'ini prototipdan yaratish.

Ishlatish:
    python scripts/scope-landing-css.py <prototip papkasi>

Prototip papkasida `styles.css` va `about-v3.css` bo'lishi kerak
(tasdiqlangan dizayn paketi — `ClinicOS-Claude-Ready.zip`). Natija
`src/pages/public/public-base.css` va `src/pages/public/story.css`.

NEGA SKRIPT: prototipda selektorlar global (`body`, `h1`, `.button`,
`*`). Loyihaga qo'lda ko'chirilsa, butun ilova buzilardi. Har bir
qoida `:where(...)` bilan o'raladi — u selektor kuchini OSHIRMAYDI,
ya'ni prototipdagi kaskad tartibi aynan saqlanadi, lekin uslublar
ilovaning boshqa sahifalariga tegmaydi. Dizayn o'zgarsa, CSS qo'lda
tahrirlanmaydi — shu skript qayta ishga tushiriladi.
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'pages', 'public')

BASE_SCOPE = ':where(.auth-page,.story-page)'


def split_top(prelude):
    parts, depth, cur = [], 0, ''
    for ch in prelude:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(cur)
            cur = ''
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def process(css, fn):
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j == -1:
            tail = css[i:].strip()
            assert not tail, tail[:80]
            break
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        if prelude.startswith('@media') or prelude.startswith('@supports'):
            out.append(prelude + '{\n' + process(body, fn) + '\n}')
        elif prelude.startswith('@'):
            out.append(prelude + '{' + body + '}')
        else:
            sels = [fn(s) for s in split_top(prelude)]
            out.append(','.join(s for s in sels if s) + '{' + body + '}')
        i = k
    return '\n'.join(out)


def base_fn(sel):
    if sel in (':root', 'body'):
        return BASE_SCOPE
    if sel == 'html':
        # Silliq aylantirish faqat tanishtiruvda kerak
        return 'html:has(.story-page)'
    if sel.startswith('.auth-body'):
        return '.auth-page' + sel[len('.auth-body'):]
    return BASE_SCOPE + ' ' + sel


def story_fn(sel):
    if sel.startswith('.story-page'):
        return sel
    if sel == 'html':
        return 'html:has(.story-page)'
    return ':where(.story-page) ' + sel


HEADER = """/*
 * {title}
 *
 * AVTOMATIK YARATILGAN — prototipdagi `{src}` dan,
 * `scripts/scope-landing-css.py` bilan. Qo'lda tahrirlanmaydi: dizayn
 * o'zgarsa, skript qayta ishga tushiriladi.
 *
 * Har bir selektor `{scope}` bilan o'ralgan. `:where()` selektor
 * kuchini oshirmaydi, ya'ni prototipdagi kaskad tartibi aynan
 * saqlanadi, lekin uslublar ilovaning boshqa sahifalariga
 * tegmaydi.
 */
"""

EXTRAS = """
/*
 * LOYIHAGA MOSLASH — prototipda yo'q, ishlaydigan ilova uchun kerak.
 * Ko'rinishi prototipdagi maydonlar bilan bir xil tilda.
 */
:where(.auth-page,.story-page){font-size:16px}
/* Tailwind asosiy uslubi ::before/::after ga border-box beradi, prototipda esa
   brauzer standarti — content-box. Aks holda FAQ doirasi, sarlavha osti chizig'i
   va bezak doiralari 2 px kichrayadi. */
:where(.auth-page,.story-page) ::before,:where(.auth-page,.story-page) ::after{box-sizing:content-box}
.auth-page .auth-error{margin:-6px 0 18px;padding:11px 14px;border-radius:10px;background:#fdecec;color:#b42318;font-size:12px;line-height:1.5}
.auth-page .auth-submit:disabled{opacity:.7;cursor:progress;transform:none;box-shadow:none}
.auth-page button.auth-language{border:0;background:none;padding:6px 0;cursor:pointer;font-size:11px;color:#6e7d92}
.auth-page button.auth-language:hover{color:var(--blue)}
.auth-page .auth-demo{margin-top:28px;padding-top:22px;border-top:1px solid #dce2ed}
.auth-page .auth-demo-title{font-size:11px;font-weight:650;color:#394c65;text-align:center}
.auth-page .auth-demo-hint{font-size:10px;color:#6f8099;text-align:center;margin-top:2px}
.auth-page .auth-demo-list{display:grid;gap:6px;margin-top:12px}
.auth-page .auth-demo-list button{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:10px 14px;border:1px solid #d6deea;border-radius:10px;background:#ffffffd9;text-align:left;font-size:12px;color:#162842;transition:border-color .2s,background .2s}
.auth-page .auth-demo-list button:hover{border-color:#82a5fa;background:#fff}
.auth-page .auth-demo-list button:disabled{opacity:.5;pointer-events:none}
.auth-page .auth-demo-list small{display:block;font-size:10px;color:#6f8099}
.auth-page .auth-demo-list em{font-style:normal;color:var(--blue);font-weight:650;font-size:11px;flex-shrink:0}
"""


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]

    def load(name):
        css = io.open(os.path.join(src, name), encoding='utf-8').read()
        return re.sub(r'/\*.*?\*/', '', css, flags=re.S)

    base = process(load('styles.css'), base_fn)
    story = process(load('about-v3.css').replace("url('/assets/", "url('./assets/"), story_fn)

    outputs = {
        'public-base.css': HEADER.format(
            title='KIRISH VA TANISHTIRUV — umumiy uslublar', src='styles.css', scope=BASE_SCOPE
        ) + base + '\n' + EXTRAS,
        'story.css': HEADER.format(
            title='TANISHTIRUV SAHIFASI (.story-page)', src='about-v3.css', scope=':where(.story-page)'
        ) + story + '\n',
    }
    for name, text in outputs.items():
        io.open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n').write(text)
        print(name, len(text), 'bayt,', text.count('{'), 'blok')


if __name__ == '__main__':
    main()

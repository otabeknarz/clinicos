# -*- coding: utf-8 -*-
"""
TANISHTIRUV VA KIRISH SAHIFALARI UCHUN QORONG'I REJIM.

`story.css` va `public-base.css` prototipdan ko'chirilgan va ularda
ranglar QAT'IY yozilgan (#fff, #142344 ...) — 200 dan ortiq joyda.
Qorong'i rejimni qo'lda yozish har bir yangi qoidada unutilardi.
Shuning uchun skript har bir qoidani o'qiydi va yorug' fonni to'q,
to'q matnni och rangga o'girib, `public-dark.css` ga yozadi.

NEGA `filter: invert` EMAS: u sahifani bitta qatlamga aylantiradi va
iPad'dagi WebKit'da `backdrop-filter` bilan birga elementlarni
ko'rinmas qilib qo'yadi — aynan shu xato yaqinda tuzatildi.

Ishga tushirish (CSS o'zgarganda):
    python scripts/gen-public-dark.py
"""
import colorsys
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = [
    ROOT / "src/pages/public/public-base.css",
    ROOT / "src/pages/public/story.css",
]
OUT = ROOT / "src/pages/public/public-dark.css"

NAMED = {"white": "#ffffff", "black": "#000000"}

COLOR_RE = re.compile(
    r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b"
    r"|rgba?\([^)]*\)"
    r"|\bwhite\b"
)


def parse_color(token):
    token = NAMED.get(token, token)
    if token.startswith("#"):
        h = token[1:]
        if len(h) in (3, 4):
            h = "".join(c * 2 for c in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    nums = re.findall(r"[\d.]+%?", token)
    if len(nums) < 3:
        return None
    r, g, b = (float(n.rstrip("%")) for n in nums[:3])
    a = 1.0
    if len(nums) >= 4:
        raw = nums[3]
        a = float(raw.rstrip("%")) / 100 if raw.endswith("%") else float(raw)
    return r, g, b, a


def to_css(r, g, b, a):
    if a >= 0.999:
        return "#%02x%02x%02x" % (round(r), round(g), round(b))
    return "rgb(%d %d %d / %.2f)" % (round(r), round(g), round(b), a)


def shift(token, role):
    parsed = parse_color(token)
    if parsed is None:
        return token
    r, g, b, a = parsed
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)

    if role == "bg":
        if l <= 0.6:
            return token
        # oq -> ~#12161f, och ko'k -> biroz ochroq to'q
        l2 = 0.085 + (1 - l) * 0.55
        s2 = s * 0.45
    elif role == "border":
        if l <= 0.6:
            return token
        l2 = 0.2 + (1 - l) * 0.35
        s2 = s * 0.35
    else:  # matn
        if l >= 0.5:
            return token
        l2 = 0.94 - l * 0.55
        s2 = s * 0.4

    if s < 0.05:
        # Oq va kulrang — ilovaning qorong'i rejimi kabi yengil ko'k tusli
        h, s2 = 0.62, 0.16 if role != "text" else 0.08

    nr, ng, nb = colorsys.hls_to_rgb(h, min(max(l2, 0), 1), min(max(s2, 0), 1))
    return to_css(nr * 255, ng * 255, nb * 255, a)


def convert_value(value, role):
    return COLOR_RE.sub(lambda m: shift(m.group(0), role), value)


def role_of(prop):
    prop = prop.strip().lower()
    if prop in ("background", "background-color", "background-image"):
        return "bg"
    if prop.startswith("border") or prop == "outline" or prop == "outline-color":
        return "border"
    if prop in ("color", "fill", "caret-color"):
        return "text"
    return None


def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def walk(css):
    """(kontekst, selektor, deklaratsiyalar) — @media ichidagilar ham."""
    i = 0
    stack = []  # [at-rule prelude]
    buf = ""
    n = len(css)
    while i < n:
        ch = css[i]
        if ch == "{":
            prelude = buf.strip()
            buf = ""
            if prelude.startswith("@media") or prelude.startswith("@supports"):
                stack.append(prelude)
                i += 1
                continue
            if prelude.startswith("@"):
                # @keyframes, @property, @font-face — o'tkazib yuboriladi
                depth = 1
                i += 1
                while i < n and depth:
                    if css[i] == "{":
                        depth += 1
                    elif css[i] == "}":
                        depth -= 1
                    i += 1
                continue
            end = css.index("}", i)
            body = css[i + 1 : end]
            yield (tuple(stack), prelude, body)
            i = end + 1
            continue
        if ch == "}":
            if stack:
                stack.pop()
            buf = ""
            i += 1
            continue
        buf += ch
        i += 1


def split_selectors(selector):
    """Vergul bo'yicha bo'ladi, lekin qavs ichidagisini emas: `:where(a,b) c`."""
    parts, depth, current = [], 0, ""
    for ch in selector:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += ch
    parts.append(current)
    return [one.strip() for one in parts if one.strip()]


def prefix_selector(selector):
    return ",".join("html.dark " + one for one in split_selectors(selector))


def main():
    blocks = {}
    order = []

    for source in SOURCES:
        css = strip_comments(source.read_text(encoding="utf8"))
        for context, selector, body in walk(css):
            decls = []
            for decl in body.split(";"):
                if ":" not in decl:
                    continue
                prop, value = decl.split(":", 1)
                role = role_of(prop)
                if not role:
                    continue
                converted = convert_value(value, role)
                if converted != value:
                    decls.append("%s:%s" % (prop.strip(), converted.strip()))
            if not decls:
                continue
            key = context
            if key not in blocks:
                blocks[key] = []
                order.append(key)
            blocks[key].append("%s{%s}" % (prefix_selector(selector), ";".join(decls)))

    lines = [
        "/*",
        "  AVTOMATIK YARATILGAN — qo'lda o'zgartirmang.",
        "  Manba: public-base.css va story.css. Qayta yaratish:",
        "  python scripts/gen-public-dark.py",
        "*/",
        "html.dark .story-page,html.dark .auth-page{color-scheme:dark}",
        # O'zgaruvchi orqali berilgan ranglar yuqoridagi qoidalarga ko'rinmaydi
        "html.dark .story-page,html.dark .auth-page{--ink:#e4e9f3;--muted:#9aa6bb}",
        # Til/rejim boshqaruvi
        "html.dark .public-control{background:#161b26;border-color:#2b3445;color:#c3cde0}",
        "html.dark .public-lang-list{background:#161b26;border-color:#2b3445}",
        "html.dark .public-lang-option{color:#d5ddeb}",
        "html.dark .public-lang-option:hover{background:#1f2738}",
        # Telefon maydonidagi ichki input — shaffof qolsin (umumiy input qoidasi ustidan)
        "html.dark .phone-field input{background:transparent!important;box-shadow:none!important}",
        "html.dark .phone-field{background:#141925;border-color:#2b3445}",
    ]
    for key in order:
        rules = blocks[key]
        if key:
            opening = "".join(ctx + "{" for ctx in key)
            closing = "}" * len(key)
            lines.append(opening)
            lines.extend(rules)
            lines.append(closing)
        else:
            lines.extend(rules)

    OUT.write_text("\n".join(lines) + "\n", encoding="utf8")
    print("yozildi:", OUT.name, sum(len(v) for v in blocks.values()), "qoida")


if __name__ == "__main__":
    main()

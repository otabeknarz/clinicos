"""docs/API.md ni src/api/ dan generatsiya qiladi.  Ishga tushirish: npm run docs:api"""
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = os.path.join(ROOT, 'src', 'api')
OUT = os.path.join(ROOT, 'docs', 'API.md')

ORDER = [
    ('auth.ts', 'Kirish va sessiya'), ('clinic.ts', 'Klinika sozlamalari'),
    ('patients.ts', 'Bemorlar'), ('appointments.ts', 'Qabullar'),
    ('visits.ts', 'Tashriflar va tashxis'), ('doctors.ts', 'Shifokorlar'),
    ('services.ts', 'Xizmatlar va narxlar'), ('payments.ts', "To'lovlar"),
    ('cashControl.ts', 'Kassa nazorati'), ('ward.ts', 'Statsionar'),
    ('staff.ts', 'Xodimlar'), ('attendance.ts', 'Davomat'),
    ('bonuses.ts', 'Bonuslar'), ('penalties.ts', 'Jarimalar'),
    ('feedback.ts', 'Bemor fikri'), ('chat.ts', 'Ichki chat'),
    ('reception.ts', 'Registratura paneli'), ('analytics.ts', 'Tahlil'),
    ('forecast.ts', 'Prognoz'), ('notifications.ts', 'Bildirishnomalar'),
    ('search.ts', 'Qidiruv'), ('platform.ts', 'Platforma paneli (super-admin)'),
]

def clean_doc(block):
    if not block:
        return ''
    lines = []
    for ln in block.split('\n'):
        ln = ln.strip()
        ln = re.sub(r'^/\*\*?', '', ln)
        ln = re.sub(r'\*/$', '', ln)
        ln = re.sub(r'^\*\s?', '', ln.strip())
        lines.append(ln)
    return '\n'.join(lines).strip()

def file_intro(src):
    m = re.match(r'/\*\*(?:(?!\*/)[\s\S])*?\*/', src)
    return clean_doc(m.group(0)) if m else ''

FN = re.compile(
    r'(?:(/\*\*(?:(?!\*/)[\s\S])*?\*/)\s*\n)?'
    r'export async function (\w+)\s*\(([\s\S]*?)\)\s*:\s*Promise<([\s\S]*?)>\s*\{'
)

def endpoints(src):
    """Har bir `// METHOD /path` izohidan keyingi BIRINCHI eksport funksiya.
    Ba'zan izoh bilan funksiya orasida so'rov interfeysi turadi."""
    out = []
    marks = list(re.finditer(r'^// (GET|POST|PATCH|DELETE) ([^\n]+)$', src, re.M))
    for i, m in enumerate(marks):
        stop = marks[i + 1].start() if i + 1 < len(marks) else len(src)
        fm = FN.search(src, m.end(), stop)
        if not fm:
            continue
        before = src[:m.start()].rstrip()
        pre = ''
        if before.endswith('*/'):
            j = before.rfind('/**')
            if j != -1:
                pre = before[j:]
        raw = m.group(2).strip()
        note = ''
        for sep in ('→', '—'):
            if sep in raw:
                raw, note = [x.strip() for x in raw.split(sep, 1)]
                break
        out.append({
            'method': m.group(1), 'path': raw, 'note': note, 'fn': fm.group(2),
            'params': re.sub(r'\s+', ' ', fm.group(3)).strip().rstrip(','),
            'ret': re.sub(r'\s+', ' ', fm.group(4)).strip(),
            'doc': clean_doc(fm.group(1) or pre),
        })
    return out

HEAD = io.open(os.path.join(ROOT, 'scripts', 'api-head.md'), encoding='utf-8').read()

parts, total = [], 0
seen = set()
listing = ORDER + [(f, f[:-3]) for f in sorted(os.listdir(API))
                   if f.endswith('.ts') and f not in dict(ORDER) and f != 'client.ts']
for name, title in listing:
    if name in seen:
        continue
    seen.add(name)
    path = os.path.join(API, name)
    if not os.path.exists(path):
        continue
    src = io.open(path, encoding='utf-8').read()
    eps = endpoints(src)
    if not eps:
        continue
    total += len(eps)
    parts.append('\n## ' + title + '\n\n`src/api/' + name + '`\n')
    intro = file_intro(src)
    if intro:
        parts.append('\n> ' + intro.replace('\n', '\n> ') + '\n')
    for e in eps:
        parts.append('\n### `' + e['method'] + ' ' + e['path'] + '`\n')
        if e.get('note'):
            parts.append('\n' + e['note'][0].upper() + e['note'][1:] + '\n')
        if e['doc']:
            parts.append('\n' + e['doc'] + '\n')
        parts.append('\n```ts\n' + e['fn'] + '(' + e['params'] +
                     '): Promise<' + e['ret'] + '>\n```\n')

body = HEAD.replace('{{COUNT}}', str(total)) + ''.join(parts)
io.open(OUT, 'w', encoding='utf-8', newline='').write(body)
print('docs/API.md —', total, 'endpoint')

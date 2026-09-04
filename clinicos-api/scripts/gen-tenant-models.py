"""
`src/prisma/tenant-models.ts` ni sxemadan qayta yaratadi.

Ishga tushirish:  npm run gen:tenant-models

NEGA GENERATSIYA: ro'yxatga yangi jadval qo'shish unutilsa, o'sha
jadval klinika filtrisiz qoladi va bir klinika boshqasining
ma'lumotini ko'radi. Buni odamning e'tiboriga qoldirib bo'lmaydi.
"""
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
schema = io.open(os.path.join(ROOT, 'prisma', 'schema.prisma'), encoding='utf-8').read()
schema = re.sub(r'///[^\n]*', '', schema)

tenant, glob = [], []
for m in re.finditer(r'^model (\w+) \{(.*?)^\}', schema, re.S | re.M):
    has_clinic = re.search(r'^\s+clinicId\s+String', m.group(2), re.M)
    (tenant if has_clinic else glob).append(m.group(1))

target = os.path.join(ROOT, 'src', 'prisma', 'tenant-models.ts')
src = io.open(target, encoding='utf-8').read()

def replace_set(text, name, values):
    pattern = re.compile(
        r'(export const ' + name + r' = new Set<string>\(\[\n)(.*?)(\]\))', re.S)
    body = ''.join("  '" + v + "',\n" for v in sorted(values))
    new, n = pattern.subn(lambda m: m.group(1) + body + m.group(3), text)
    assert n == 1, name + ' topilmadi'
    return new

src = replace_set(src, 'TENANT_MODELS', tenant)
src = replace_set(src, 'GLOBAL_MODELS', glob)
io.open(target, 'w', encoding='utf-8', newline='').write(src)

print('tenant-models.ts yangilandi:',
      len(tenant), 'klinikaga tegishli,', len(glob), 'umumiy')

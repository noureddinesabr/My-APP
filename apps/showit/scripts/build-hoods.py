"""
Builds src/lib/places-osm.ts: Moroccan neighbourhoods from OpenStreetMap (© OpenStreetMap
contributors, ODbL), for the «Street or neighbourhood» line (owner's edit #5, 18 Nov 2026).

Input: found.json (neighbourhoods found with Photon reverse search on a grid over each city) and
names.json (their name / name:ar / name:fr / name:en tags from Nominatim lookup).
Run: python3 scripts/build-hoods.py <found.json> <names.json>

Arabic: the OSM Arabic name when there is one. When there isn't, the place keeps its Latin name
everywhere, and a rough Arabic spelling is added only as a hidden search alias, so typing in
Arabic still finds it (it is never shown).
"""
import json, math, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..')
found = json.load(open(sys.argv[1]))
names = json.load(open(sys.argv[2]))

AR = re.compile(r'[؀-ۿ]')
LAT = re.compile(r'[A-Za-zÀ-ÿ]')
TIF = re.compile(r'[ⴰ-⵿]+')

def clean(s):
    return re.sub(r'\s{2,}', ' ', TIF.sub('', s or '')).strip(' -,')

def split_name(n):
    n = clean(n)
    words = n.split()
    ar = ' '.join(w for w in words if AR.search(w))
    lat = ' '.join(w for w in words if not AR.search(w))
    return ar.strip(), lat.strip()

def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')
    return re.sub(r'[^a-z0-9؀-ۿ]+', ' ', s).strip()

def km(a, b):
    r = math.pi / 180
    dlat = (b[0] - a[0]) * r
    dlng = (b[1] - a[1]) * r
    h = math.sin(dlat / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin(dlng / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))

# Common Moroccan place words in Latin letters → Arabic (for the hidden search alias only).
WORDS = {
    'hay': 'حي', 'sidi': 'سيدي', 'ain': 'عين', 'aïn': 'عين', 'derb': 'درب', 'bab': 'باب', 'oued': 'واد', 'riad': 'رياض',
    'jnane': 'جنان', 'jnan': 'جنان', 'douar': 'دوار', 'dar': 'دار', 'bni': 'بني', 'beni': 'بني', 'ben': 'بن', 'ouled': 'أولاد',
    'oulad': 'أولاد', 'moulay': 'مولاي', 'lalla': 'للا', 'cite': 'حي', 'cité': 'حي', 'quartier': 'حي', 'residence': 'إقامة',
    'résidence': 'إقامة', 'el': 'ال', 'al': 'ال', 'la': '', 'le': '', 'les': '', 'de': '', 'des': '', 'du': '',
    'nahda': 'النهضة', 'salam': 'السلام', 'massira': 'المسيرة', 'wifaq': 'الوفاق', 'amal': 'الأمل', 'farah': 'الفرح',
    'qods': 'القدس', 'quds': 'القدس', 'andalous': 'الأندلس', 'menzah': 'المنزه', 'mohammadi': 'المحمدي', 'hassani': 'الحسني',
    'industriel': 'الصناعي', 'nouvelle': 'الجديدة', 'medina': 'المدينة', 'ville': 'مدينة', 'centre': 'وسط', 'nord': 'الشمال',
    'sud': 'الجنوب', 'est': 'الشرق', 'ouest': 'الغرب', 'mosquee': 'مسجد', 'souk': 'سوق', 'hamra': 'الحمراء', 'zitoune': 'الزيتون',
    'nour': 'النور', 'yasmine': 'الياسمين', 'rahma': 'الرحمة', 'karima': 'الكريمة', 'firdaous': 'الفردوس', 'bouchentouf': 'بوشنتوف',
}
LETTERS = [('ch', 'ش'), ('sh', 'ش'), ('kh', 'خ'), ('gh', 'غ'), ('dj', 'ج'), ('ou', 'و'), ('th', 'ث'), ('a', 'ا'), ('b', 'ب'),
           ('c', 'ك'), ('d', 'د'), ('e', ''), ('f', 'ف'), ('g', 'ك'), ('h', 'ه'), ('i', 'ي'), ('j', 'ج'), ('k', 'ك'), ('l', 'ل'),
           ('m', 'م'), ('n', 'ن'), ('o', 'و'), ('p', 'ب'), ('q', 'ق'), ('r', 'ر'), ('s', 'س'), ('t', 'ت'), ('u', 'و'), ('v', 'ف'),
           ('w', 'و'), ('x', 'كس'), ('y', 'ي'), ('z', 'ز')]

def to_arabic(latin):
    out = []
    for w in norm(latin).split():
        if w in WORDS:
            if WORDS[w]:
                out.append(WORDS[w])
            continue
        if w.isdigit():
            out.append(w)
            continue
        s, i = '', 0
        while i < len(w):
            for a, b in LETTERS:
                if w.startswith(a, i):
                    s += b
                    i += len(a)
                    break
            else:
                i += 1
        out.append(s)
    # «ال» glued to the next word, as written in Arabic.
    txt = ' '.join(x for x in out if x)
    return re.sub(r'ال (\S)', r'ال\1', txt)

src = open(os.path.join(APP, 'src/lib/cities.ts')).read()
cities = [(m[0], float(m[1]), float(m[2])) for m in re.findall(r"id: '(\w+)'.*?lat: ([-\d.]+), lng: ([-\d.]+)", src)]
existing = []
for l in open(os.path.join(APP, 'src/lib/places-data.ts')):
    m = re.match(r"  \['([^']*)', '([^']*)', '([^']*)', '([^']*)', '([^']*)', '([^']*)', ([-\d.]+), ([-\d.]+), (\d+)\]", l)
    if m:
        existing.append((norm(m.group(5)), norm(m.group(4)), float(m.group(7)), float(m.group(8))))

rows, kept = [], []
skip = re.compile(r'préfecture|prefecture|arrondissement|commune|province|wilaya|^\d+$', re.I)
for k, f in found.items():
    if k.startswith('_'):
        continue
    nd = names.get(k) or {}
    ar_tag, lat_tag = split_name(nd.get('name') or f.get('fr') or '')
    ar = clean(nd.get('ar') or '') or ar_tag
    fr = clean(nd.get('fr') or '') or lat_tag or clean(f.get('fr') or '')
    en = clean(nd.get('en') or '') or fr
    if not fr and ar:
        fr = en = ar
    if not fr or skip.search(fr) or len(fr) < 3:
        continue
    pt = (f['lat'], f['lng'])
    nf, na = norm(fr), norm(ar) if ar else ''
    # Already known (the hand-made list or a closer copy here): keep the first one.
    if any((nf == e[0] or (na and na == e[1])) and km(pt, (e[2], e[3])) < 3 for e in existing):
        continue
    if any(nf == x[0] and km(pt, x[1]) < 3 for x in kept):
        continue
    kept.append((nf, pt))
    city = min(cities, key=lambda c: km(pt, (c[1], c[2])))[0]
    alias = '' if ar else to_arabic(fr)
    pid = 'osm-' + k.lower()
    rows.append((pid, city, ar or fr, fr, en, round(pt[0], 5), round(pt[1], 5), alias))

def q(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

out = os.path.join(APP, 'src/lib/places-osm.ts')
with open(out, 'w') as fh:
    fh.write('// Generated by scripts/build-hoods.py — do not edit by hand.\n')
    fh.write('// Neighbourhoods: © OpenStreetMap contributors (ODbL 1.0), found with Photon and Nominatim.\n')
    fh.write('// [id, cityId, Arabic (or the Latin name when OSM has none), French, English, lat, lng, hidden Arabic search spelling]\n\n')
    fh.write("import type { CityId } from './cities';\n\n")
    fh.write('export type OsmRow = [id: string, cityId: CityId, ar: string, fr: string, en: string, lat: number, lng: number, arAlias: string];\n\n')
    fh.write('export const OSM_ROWS: OsmRow[] = [\n')
    for r in rows:
        fh.write(f"  [{q(r[0])}, {q(r[1])}, {q(r[2])}, {q(r[3])}, {q(r[4])}, {r[5]}, {r[6]}, {q(r[7])}],\n")
    fh.write('];\n')
print(len(rows), 'neighbourhoods', sum(1 for r in rows if not r[7]), 'with an Arabic name', '→', out)

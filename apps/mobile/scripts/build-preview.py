# Bundles `npx expo export --platform web` output into one self-contained HTML page
# (scripts, the fonts the app uses, sounds and vehicle pictures inlined), for the browser preview link.
# Usage: python3 scripts/build-preview.py <export-dir> <out.html>
import base64, os, re, sys
web, out = sys.argv[1], sys.argv[2]
html = open(os.path.join(web, 'index.html')).read()
used = ['Ionicons', 'MaterialCommunityIcons', 'PlusJakartaSans_400Regular', 'PlusJakartaSans_500Medium', 'PlusJakartaSans_600SemiBold', 'PlusJakartaSans_700Bold', 'PlusJakartaSans_800ExtraBold', 'NotoKufiArabic_400Regular', 'NotoKufiArabic_500Medium', 'NotoKufiArabic_600SemiBold', 'NotoKufiArabic_700Bold', 'NotoKufiArabic_800ExtraBold']

def shrink(path):
    # Fonts go in as compressed WOFF2; text fonts keep only Latin, French and Arabic letters.
    # (fontTools + brotli: `pip install fonttools brotli`.)
    from fontTools import subset
    from fontTools.ttLib import TTFont
    import io
    font = TTFont(path)
    name = os.path.basename(path)
    if not name.startswith(('Ionicons', 'MaterialCommunityIcons')):
        opts = subset.Options()
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        ranges = [(0x20, 0x24F), (0x2000, 0x206F), (0x20AC, 0x20AC), (0x2190, 0x21FF), (0x2212, 0x2212),
                  (0x600, 0x6FF), (0x750, 0x77F), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF)]
        sub.populate(unicodes=[u for a, b in ranges for u in range(a, b + 1)])
        sub.subset(font)
    font.flavor = 'woff2'
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()

def inline_fonts(js):
    def rep(m):
        path = m.group(1)
        if not any(os.path.basename(path).startswith(u + '.') for u in used):
            return m.group(0)
        data = base64.b64encode(shrink(os.path.join(web, path.lstrip('/')))).decode()
        return '"data:font/woff2;base64,' + data + '"'
    js = re.sub(r'"(/assets/[^"]+\.ttf)"', rep, js)
    js = re.sub(r'"(/assets/[^"]+\.wav)"', embed('audio/wav'), js)
    js = re.sub(r'"(/assets/[^"]+\.png)"', embed('image/png'), js)
    return re.sub(r'"(/assets/[^"]+\.webp)"', embed('image/webp'), js)

def embed(mime):
    def rep(m):
        data = base64.b64encode(open(os.path.join(web, m.group(1).lstrip('/')), 'rb').read()).decode()
        return f'"data:{mime};base64,' + data + '"'
    return rep

scripts = re.findall(r'<script src="([^"]+)" defer></script>', html)
body = []
for src in scripts:
    js = inline_fonts(open(os.path.join(web, src.lstrip('/'))).read())
    body.append('<script>' + js.replace('</script', '<\\/script') + '</script>')
style = re.search(r'<style id="expo-reset">(.*?)</style>', html, re.S).group(1)
page = f'''<title>Xapp</title>
<style id="expo-reset">{style}
body {{ background: #F7F6F3; }}
@media (prefers-color-scheme: dark) {{ body {{ background: #13141A; }} }}
</style>
<div id="root"></div>
{''.join(body)}
'''
open(out, 'w').write(page)
print(len(page) / 1e6, 'MB')

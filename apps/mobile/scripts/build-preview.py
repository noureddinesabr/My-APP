# Bundles `npx expo export --platform web` output into one self-contained HTML page
# (scripts, the fonts the app uses, sounds and vehicle pictures inlined), for the browser preview link.
# Usage: python3 scripts/build-preview.py <export-dir> <out.html>
import base64, os, re, sys
web, out = sys.argv[1], sys.argv[2]
html = open(os.path.join(web, 'index.html')).read()
# Every font the app loads must be listed here, or the page waits for a file that isn't there and stays blank.
used = ['Ionicons', 'MaterialCommunityIcons',
        'Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'Inter_700Bold', 'Inter_800ExtraBold',
        'Tajawal_400Regular', 'Tajawal_500Medium', 'Tajawal_700Bold', 'Tajawal_800ExtraBold']

def inline_fonts(js):
    def rep(m):
        path = m.group(1)
        if not any(os.path.basename(path).startswith(u + '.') for u in used):
            return m.group(0)
        data = base64.b64encode(open(os.path.join(web, path.lstrip('/')), 'rb').read()).decode()
        return '"data:font/ttf;base64,' + data + '"'
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
body {{ background: #F4F6F9; }}
@media (prefers-color-scheme: dark) {{ body {{ background: #0B1A2F; }} }}
</style>
<div id="root"></div>
{''.join(body)}
'''
open(out, 'w').write(page)
print(len(page) / 1e6, 'MB')

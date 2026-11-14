# Packs `npx expo export --platform web` output into one self-contained HTML page for the
# claude.ai preview: the app script, the fonts it loads, vehicle pictures and sounds are inlined.
# Usage: python3 scripts/build-preview.py <export-dir> <out.html>
import base64, os, re, sys

web, out = sys.argv[1], sys.argv[2]
html = open(os.path.join(web, 'index.html')).read()
FONTS = ['Ionicons', 'MaterialCommunityIcons', 'Urbanist_500Medium', 'Urbanist_600SemiBold', 'Urbanist_700Bold',
         'Urbanist_800ExtraBold', 'Tajawal_500Medium', 'Tajawal_700Bold']
MIME = {'ttf': 'font/ttf', 'webp': 'image/webp', 'wav': 'audio/wav', 'png': 'image/png'}

def inline(js):
    def rep(m):
        path, ext = m.group(1), m.group(2)
        if ext == 'ttf' and not any(os.path.basename(path).startswith(f + '.') for f in FONTS):
            return m.group(0)  # fonts the app never loads stay as (unused) paths
        data = base64.b64encode(open(os.path.join(web, path.lstrip('/')), 'rb').read()).decode()
        return f'"data:{MIME[ext]};base64,{data}"'
    return re.sub(r'"(/assets/[^"]+\.(ttf|webp|wav|png))"', rep, js)

body = []
for src in re.findall(r'<script src="([^"]+)" defer></script>', html):
    js = inline(open(os.path.join(web, src.lstrip('/'))).read())
    body.append('<script>' + js.replace('</script', '<\\/script') + '</script>')
style = re.search(r'<style id="expo-reset">(.*?)</style>', html, re.S).group(1)
page = f'''<title>Xapp Show it</title>
<style id="expo-reset">{style}
body {{ background: #F7F6F3; }}
</style>
<div id="root"></div>
{''.join(body)}
'''
open(out, 'w').write(page)
print(round(len(page) / 1e6, 2), 'MB')

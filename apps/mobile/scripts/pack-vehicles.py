"""
Crops the renders from render-vehicles.py to the vehicle (plus its shadow) and saves
small transparent WebP files for the app: assets/images/vehicles/<id>.webp (480 × 300).

Run: python3 scripts/pack-vehicles.py <render-dir>
"""

import os
import sys

from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'vehicles')
SIZE = (480, 300)
PAD = 0.04

os.makedirs(OUT, exist_ok=True)
for name in sorted(os.listdir(SRC)):
    if not name.endswith('.png'):
        continue
    image = Image.open(os.path.join(SRC, name)).convert('RGBA')
    # The shadow catcher leaves a faint veil over the whole frame: keep only the real contact shadow.
    alpha = image.getchannel('A').point(lambda a: 255 if a >= 250 else max(0, round((a - 70) * 255 / 180)))
    image.putalpha(alpha)
    # Crop to the vehicle itself, with room for its shadow.
    box = image.getchannel('A').point(lambda a: 255 if a >= 250 else 0).getbbox()
    if box:
        margin_x, margin_y = (box[2] - box[0]) * 0.06, (box[3] - box[1]) * 0.1
        box = (max(0, box[0] - margin_x), max(0, box[1] - margin_y), min(image.width, box[2] + margin_x), min(image.height, box[3] + margin_y))
        image = image.crop(tuple(round(v) for v in box))
    scale = min(SIZE[0] * (1 - 2 * PAD) / image.width, SIZE[1] * (1 - 2 * PAD) / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(image, ((SIZE[0] - image.width) // 2, (SIZE[1] - image.height) // 2))
    target = os.path.join(OUT, name.replace('.png', '.webp'))
    canvas.save(target, 'WEBP', quality=82, method=6)
    print(target, os.path.getsize(target) // 1024, 'KB')

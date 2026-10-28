"""
Packs the turntable renders from render-vehicles.py (TURNTABLE=N) into one sprite strip per
vehicle: all angles side by side, cropped the same way so the vehicle doesn't jump while it
turns. Saved as assets/images/vehicles/turn/<id>.webp; `TurningVehicle` plays them.

Run: python3 scripts/pack-turntables.py <render-dir>
"""

import os
import sys

from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'vehicles', 'turn')
FRAME = (192, 120)
PAD = 0.04

os.makedirs(OUT, exist_ok=True)


def clean(image):
    # The shadow catcher leaves a faint veil over the whole frame: keep only the real contact shadow.
    alpha = image.getchannel('A').point(lambda a: 255 if a >= 250 else max(0, round((a - 70) * 255 / 180)))
    image.putalpha(alpha)
    return image


for vehicle in sorted(os.listdir(SRC)):
    folder = os.path.join(SRC, vehicle)
    if not os.path.isdir(folder):
        continue
    frames = [clean(Image.open(os.path.join(folder, name)).convert('RGBA')) for name in sorted(os.listdir(folder)) if name.endswith('.png')]
    # One crop for every angle: the union of where the vehicle is in all of them.
    boxes = [frame.getchannel('A').point(lambda a: 255 if a >= 250 else 0).getbbox() for frame in frames]
    boxes = [box for box in boxes if box]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    margin_x, margin_y = (box[2] - box[0]) * 0.04, (box[3] - box[1]) * 0.08
    box = (max(0, box[0] - margin_x), max(0, box[1] - margin_y), min(frames[0].width, box[2] + margin_x), min(frames[0].height, box[3] + margin_y))
    box = tuple(round(v) for v in box)
    width, height = box[2] - box[0], box[3] - box[1]
    scale = min(FRAME[0] * (1 - 2 * PAD) / width, FRAME[1] * (1 - 2 * PAD) / height)
    size = (round(width * scale), round(height * scale))
    strip = Image.new('RGBA', (FRAME[0] * len(frames), FRAME[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        picture = frame.crop(box).resize(size, Image.LANCZOS)
        strip.alpha_composite(picture, (index * FRAME[0] + (FRAME[0] - size[0]) // 2, (FRAME[1] - size[1]) // 2))
    target = os.path.join(OUT, f'{vehicle}.webp')
    strip.save(target, 'WEBP', quality=80, method=6)
    print(target, len(frames), 'frames', os.path.getsize(target) // 1024, 'KB')

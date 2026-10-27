# Generates the app's UI sound effects into assets/sounds/*.wav.
# Usage: python3 scripts/make-sounds.py
# Short, soft, synthesized tones (no third-party audio), mono 22.05 kHz 16-bit.
import os
import wave

import numpy as np

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')


def env(n, attack=0.004, decay=6.0):
    t = np.arange(n) / RATE
    a = np.minimum(1, t / attack)
    return a * np.exp(-decay * t)


def bell(freq, dur, decay=7.0, gain=1.0):
    """Marimba/glass-like tone: fundamental plus a soft 4th harmonic."""
    n = int(RATE * dur)
    t = np.arange(n) / RATE
    tone = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-30 * t)
    return gain * tone * env(n, decay=decay)


def place(track, sound, at):
    start = int(RATE * at)
    end = min(len(track), start + len(sound))
    track[start:end] += sound[: end - start]


def silence(dur):
    return np.zeros(int(RATE * dur))


def note(name):
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    return 440 * 2 ** ((names[name[0]] + 12 * (int(name[1:]) - 4)) / 12)


def write(name, samples, volume=0.6):
    samples = samples / max(1e-9, np.max(np.abs(samples))) * volume
    fade = min(len(samples), int(RATE * 0.01))
    samples[-fade:] *= np.linspace(1, 0, fade)
    data = (samples * 32767).astype('<i2').tobytes()
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(data)


os.makedirs(OUT, exist_ok=True)

# tap: tiny soft click
t = silence(0.05)
place(t, bell(1900, 0.05, decay=90), 0)
write('tap', t, volume=0.35)

# send: quick upward swoosh with a glassy tail
n = int(RATE * 0.32)
time = np.arange(n) / RATE
freq = 500 + 1400 * (time / time[-1]) ** 1.6
phase = 2 * np.pi * np.cumsum(freq) / RATE
swoop = np.sin(phase) * np.sin(np.pi * time / time[-1]) ** 1.5
noise = np.random.default_rng(1).normal(0, 1, n) * np.sin(np.pi * time / time[-1]) ** 2 * 0.15
s = silence(0.45)
place(s, swoop + noise, 0)
place(s, bell(note('E6'), 0.25, decay=14, gain=0.5), 0.28)
write('send', s, volume=0.5)

# offer: friendly two-note ding (new offer / new request)
o = silence(0.6)
place(o, bell(note('E6'), 0.5, decay=8), 0)
place(o, bell(note('B6'), 0.5, decay=7), 0.11)
write('offer', o)

# success: rising three-note chime (accepted, approved)
s = silence(0.75)
for i, nm in enumerate(['C6', 'E6', 'G6']):
    place(s, bell(note(nm), 0.5, decay=7), i * 0.09)
write('success', s)

# step: soft pop for each delivery step
p = silence(0.2)
place(p, bell(note('A5'), 0.18, decay=20), 0)
place(p, bell(note('E6'), 0.15, decay=24, gain=0.6), 0.04)
write('step', p, volume=0.5)

# complete: celebratory arpeggio with a sparkle
c = silence(1.2)
for i, nm in enumerate(['C6', 'E6', 'G6', 'C7']):
    place(c, bell(note(nm), 0.8, decay=5), i * 0.1)
for i, nm in enumerate(['G7', 'E7', 'C8']):
    place(c, bell(note(nm), 0.3, decay=12, gain=0.25), 0.42 + i * 0.06)
write('complete', c)

# error: two soft descending notes
e = silence(0.45)
place(e, bell(note('E5'), 0.3, decay=10), 0)
place(e, bell(note('C5'), 0.35, decay=9), 0.12)
write('error', e, volume=0.45)

# pop: bubbly pick sound for answer cards (pitch bends up like a bubble)
n = int(RATE * 0.12)
time = np.arange(n) / RATE
freq = 600 + 900 * (time / time[-1]) ** 0.5
bubble = np.sin(2 * np.pi * np.cumsum(freq) / RATE) * env(n, attack=0.002, decay=38)
p = silence(0.18)
place(p, bubble, 0)
place(p, bell(note('A6'), 0.1, decay=40, gain=0.35), 0.03)
write('pop', p, volume=0.45)

# whoosh: soft airy sweep between pages (band-limited noise rising then falling)
n = int(RATE * 0.28)
time = np.arange(n) / RATE
raw = np.random.default_rng(7).normal(0, 1, n)
smooth = np.convolve(raw, np.ones(18) / 18, mode='same')
shape = np.sin(np.pi * time / time[-1]) ** 2
write('whoosh', smooth * shape, volume=0.22)

# celebrate: sparkly arpeggio with a shimmer of high bells (request sent, offer accepted)
c = silence(1.4)
for i, nm in enumerate(['G5', 'C6', 'E6', 'G6', 'C7']):
    place(c, bell(note(nm), 0.8, decay=5), i * 0.07)
rng = np.random.default_rng(3)
for i in range(9):
    place(c, bell(note(rng.choice(['E7', 'G7', 'C8', 'D8'])), 0.25, decay=16, gain=0.18), 0.35 + i * 0.07)
write('celebrate', c, volume=0.55)

print('sounds written to', os.path.abspath(OUT))

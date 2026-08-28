#!/usr/bin/env python3
"""Generate the IRONLINE launcher icon (512x512 PNG, no external assets)."""
import math
import struct
import sys
import zlib

S = 512
px = bytearray(S * S * 4)


def put(x, y, r, g, b, a):
    if 0 <= x < S and 0 <= y < S:
        i = (y * S + x) * 4
        # simple alpha over
        a = a / 255
        ia = 1 - a
        px[i] = min(255, int(r * a + px[i] * ia))
        px[i + 1] = min(255, int(g * a + px[i + 1] * ia))
        px[i + 2] = min(255, int(b * a + px[i + 2] * ia))
        px[i + 3] = max(px[i + 3], int(a * 255))


def dist(x, y, cx, cy):
    return math.hypot(x - cx, y - cy)


def ring(x, y, cx, cy, r0, r1):
    d = dist(x, y, cx, cy)
    if r0 <= d <= r1:
        return True
    return False


# background: dark with subtle vertical gradient
for y in range(S):
    t = y / S
    bg = (10 + t * 6, 13 + t * 7, 16 + t * 8)
    for x in range(S):
        put(x, y, bg[0], bg[1], bg[2], 255)

CX = CY = S // 2
AMBER = (232, 179, 75)
AMBER_DARK = (138, 106, 44)

# outer ring
for y in range(S):
    for x in range(S):
        if ring(x, y, CX, CY, 176, 196):
            put(x, y, AMBER[0], AMBER[1], AMBER[2], 255)
        elif ring(x, y, CX, CY, 150, 158):
            put(x, y, AMBER_DARK[0], AMBER_DARK[1], AMBER_DARK[2], 230)

# 4 aim ticks (N/S/E/W) outside the ring
def tick(x0, y0, x1, y1, w):
    for y in range(S):
        for x in range(S):
            # distance from segment
            dx, dy = x1 - x0, y1 - y0
            L2 = dx * dx + dy * dy
            t = max(0, min(1, ((x - x0) * dx + (y - y0) * dy) / L2))
            d = dist(x, y, x0 + t * dx, y0 + t * dy)
            if d <= w:
                put(x, y, AMBER[0], AMBER[1], AMBER[2], 255)


tick(CX, 26, CX, 96, 13)
tick(CX, S - 26, CX, S - 96, 13)
tick(26, CY, 96, CY, 13)
tick(S - 26, CY, S - 96, CY, 13)

# center dot
for y in range(S):
    for x in range(S):
        if dist(x, y, CX, CY) <= 26:
            put(x, y, 255, 244, 214, 255)

# diagonal corner accents (small)
for (ax, ay, sx, sy) in [(70, 70, 1, 1), (S - 70, 70, -1, 1), (70, S - 70, 1, -1), (S - 70, S - 70, -1, -1)]:
    for yy in range(-14, 15):
        for xx in range(-14, 15):
            x, y = ax + sx * xx, ay + sy * yy
            if 0 <= x < S and 0 <= y < S and (0 <= xx <= 14) ^ (0 <= yy <= 14) and dist(x, y, ax, ay) <= 20:
                if abs(xx) + abs(yy) <= 16:
                    put(x, y, AMBER_DARK[0], AMBER_DARK[1], AMBER_DARK[2], 200)


def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return c


raw = bytearray()
for y in range(S):
    raw.append(0)
    raw += px[y * S * 4:(y + 1) * S * 4]

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
png += chunk(b"IEND", b"")

out = sys.argv[1] if len(sys.argv) > 1 else "ic_launcher.png"
with open(out, "wb") as f:
    f.write(png)
print(f"icon written: {out} ({len(png)} bytes)")

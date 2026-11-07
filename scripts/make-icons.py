"""Draws the TripMate icon set: bold white "TM" letters with a coral map pin, over a faint globe on teal.

The letters are drawn as shapes (no font file), so there are no font licence questions.
Needs Pillow. Usage, from the project folder:
    python3 scripts/make-icons.py assets
It also writes preview.png (the icon at a few sizes) into that folder; delete it after looking.
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

TEAL_LIGHT = (20, 160, 150)
TEAL_DARK = (6, 84, 82)
TEAL = (11, 122, 117)  # #0B7A75, the app's button colour
WHITE = (255, 255, 255)
CORAL = (255, 128, 92)
GLOBE = (255, 255, 255, 34)  # faint lines
SS = 4  # draw 4x larger, then shrink, for smooth edges

# Letters as filled shapes on a 1024 grid (strokes ~100 wide, flat ends, 50 gap between T and M)
T_SHAPES = [
    [(162, 360), (462, 360), (462, 460), (162, 460)],  # bar
    [(262, 360), (362, 360), (362, 700), (262, 700)],  # stem
]
M_SHAPES = [[
    (512, 700), (512, 360), (612, 360), (687, 472), (762, 360), (862, 360), (862, 700),
    (762, 700), (762, 530), (717, 598), (657, 598), (612, 530), (612, 700),
]]
PIN = (687, 212, 66)  # head centre x, y and radius; its tip points down at the M's middle


class Canvas:
    """Draws on a 1024 grid scaled to the image (and supersampled)."""

    def __init__(self, img, scale=1.0, offset=(0, 0)):
        self.img = img
        self.d = ImageDraw.Draw(img, "RGBA")
        self.s = scale * SS
        self.ox, self.oy = offset[0] * SS, offset[1] * SS

    def P(self, x, y):
        return (self.ox + x * self.s, self.oy + y * self.s)

    def dot(self, pt, r, fill):
        x, y = self.P(*pt)
        r *= self.s
        self.d.ellipse([x - r, y - r, x + r, y + r], fill=fill)

    def pin(self, cx, cy, R, fill, hole):
        tip = (cx, cy + 1.75 * R)
        ang = math.asin(R / (tip[1] - cy))
        tx, ty = R * math.cos(ang), R * math.sin(ang)
        self.d.polygon([self.P(cx - tx, cy + ty), self.P(*tip), self.P(cx + tx, cy + ty)], fill=fill)
        self.dot((cx, cy), R, fill)
        if hole is None:  # a real hole, for single-colour icons
            x, y = self.P(cx, cy)
            r = R * 0.42 * self.s
            mask = Image.new("L", self.img.size, 0)
            ImageDraw.Draw(mask).ellipse([x - r, y - r, x + r, y + r], fill=255)
            self.img.paste((0, 0, 0, 0), mask=mask)
        else:
            self.dot((cx, cy), R * 0.42, hole)


def background(size):
    """Diagonal teal gradient with a faint globe."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(0, size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(TEAL_LIGHT, TEAL_DARK))
    c = Canvas(img, size / 1024 / SS)
    w = 12
    cx, cy, r = 512, 540, 430
    box = lambda rx, ry: [c.P(cx - rx, cy - ry), c.P(cx + rx, cy + ry)]
    c.d.ellipse(box(r, r), outline=GLOBE, width=round(w * c.s))
    for rx in (r * 0.55, r * 0.15):  # meridians
        c.d.ellipse(box(rx, r), outline=GLOBE, width=round(w * c.s))
    for k in (-0.5, 0, 0.5):  # latitude lines
        y = cy + k * r
        half = math.sqrt(r * r - (k * r) ** 2)
        c.d.line([c.P(cx - half, y), c.P(cx + half, y)], fill=GLOBE, width=round(w * c.s))
    return img


def draw_mark(c, letters=WHITE, pin=CORAL, hole=WHITE):
    for shape in T_SHAPES + M_SHAPES:
        c.d.polygon([c.P(*p) for p in shape], fill=letters)
    c.pin(*PIN, fill=pin, hole=hole)


def rounded(icon, size):
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * 0.2237), fill=255)
    return icon.resize((size, size), Image.LANCZOS), mask.resize((size, size), Image.LANCZOS)


def main(out: Path):
    out.mkdir(parents=True, exist_ok=True)

    # iOS / main icon: 1024, no transparency (Apple rejects alpha)
    big = background(1024 * SS)
    draw_mark(Canvas(big))
    icon = big.resize((1024, 1024), Image.LANCZOS).convert("RGB")
    icon.save(out / "icon.png")

    # Android adaptive icon: the same globe background; the mark shrunk into the central safe zone
    background(512 * SS).resize((512, 512), Image.LANCZOS).save(out / "android-icon-background.png")
    fg = Image.new("RGBA", (512 * SS, 512 * SS), (0, 0, 0, 0))
    draw_mark(Canvas(fg, 0.5 * 0.64, (512 * 0.18, 512 * 0.18)))
    fg.resize((512, 512), Image.LANCZOS).save(out / "android-icon-foreground.png")

    # Android monochrome (themed icons): one colour on transparent
    mono = Image.new("RGBA", (432 * SS, 432 * SS), (0, 0, 0, 0))
    draw_mark(Canvas(mono, 432 / 1024 * 0.64, (432 * 0.18, 432 * 0.18)), pin=WHITE, hole=None)
    mono.resize((432, 432), Image.LANCZOS).save(out / "android-icon-monochrome.png")

    # Web favicon
    icon.resize((48, 48), Image.LANCZOS).save(out / "favicon.png")

    # Preview: App Store, home-screen and Settings sizes, with iOS-style rounded corners
    sheet = Image.new("RGB", (1024 + 180 + 87 + 120, 1064), (242, 242, 247))
    x = 20
    for size in (1024, 180, 87):
        img, mask = rounded(icon, size)
        sheet.paste(img, (x, 20), mask)
        x += size + 40
    sheet.save(out / "preview.png")


if __name__ == "__main__":
    main(Path(sys.argv[1]))

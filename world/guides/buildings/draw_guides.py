"""Perspective guides for painting Villages' buildings: the map's camera, drawn exactly.

The camera is parallel (orthographic), north-up, looking down at 45 degrees. The ground's grid is turned 26 degrees.
World: x east, y south, z up, in world units. Screen: X right, Y down.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
SUPER = 4  # drawn this many times larger, then shrunk, for smooth edges

TURN = math.radians(26)
C, S = math.cos(TURN), math.sin(TURN)
TILT = math.radians(45)
SQUASH = math.cos(TILT)  # ground depth on screen
RISE = math.sin(TILT)  # upright lengths on screen

FONT = 'C:/Windows/Fonts/arial.ttf'
BOLD = 'C:/Windows/Fonts/arialbd.ttf'

INK = (36, 28, 20, 255)
GRID = (120, 104, 84, 255)
EARTH = (190, 160, 118, 255)
EARTH_EDGE = (110, 82, 48, 255)
GOLD = (157, 124, 42, 255)
RED = (200, 40, 30, 255)
PAPER = (247, 242, 230, 255)

# Faces lit from the upper right: tops lightest, faces turned east lit, faces turned south-west in half shade.
TOP = (226, 222, 214, 255)
LIT = (196, 190, 180, 255)
SHADE = (146, 140, 132, 255)
ROOF_LIT = (182, 112, 88, 255)
ROOF_SHADE = (138, 80, 62, 255)


def lattice(u, v, z=0.0):
    """A point given along the grid's two axes and up, in world units, on the screen in world units."""
    x = u * C - v * S
    y = u * S + v * C
    return (x, y * SQUASH - z * RISE)


class Canvas:
    def __init__(self, width, height, unit, origin, background=(0, 0, 0, 0)):
        self.unit = unit
        self.origin = origin
        self.image = Image.new('RGBA', (width * SUPER, height * SUPER), background)
        self.draw = ImageDraw.Draw(self.image)

    def px(self, p):
        return ((self.origin[0] + p[0] * self.unit) * SUPER, (self.origin[1] + p[1] * self.unit) * SUPER)

    def polygon(self, points, fill=None, outline=None, width=1.0):
        pts = [self.px(p) for p in points]
        if fill is not None:
            self.draw.polygon(pts, fill=fill)
        if outline is not None:
            self.draw.line(pts + [pts[0]], fill=outline, width=max(1, round(width * SUPER)), joint='curve')

    def line(self, a, b, fill=INK, width=1.0, dash=None):
        a, b = self.px(a), self.px(b)
        w = max(1, round(width * SUPER))
        if dash is None:
            self.draw.line([a, b], fill=fill, width=w)
            return
        length = math.dist(a, b)
        on, off = dash[0] * SUPER, dash[1] * SUPER
        t = 0.0
        while t < length:
            e = min(t + on, length)
            self.draw.line([lerp(a, b, t / length), lerp(a, b, e / length)], fill=fill, width=w)
            t = e + off

    def dot(self, p, r, fill):
        x, y = self.px(p)
        self.draw.ellipse([x - r * SUPER, y - r * SUPER, x + r * SUPER, y + r * SUPER], fill=fill)

    def text(self, at, words, size=13, fill=INK, bold=False, anchor='la'):
        font = ImageFont.truetype(BOLD if bold else FONT, size * SUPER)
        self.draw.text((at[0] * SUPER, at[1] * SUPER), words, font=font, fill=fill, anchor=anchor)

    def save(self, name):
        w, h = self.image.size
        self.image.resize((w // SUPER, h // SUPER), Image.LANCZOS).save(os.path.join(OUT, name))


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


# ---------------------------------------------------------------------------------------------------------------
# Solids. Each is a list of faces (points, fill), drawn back to front by the painter's rule: the faces a parallel
# camera looking north-down sees, farthest first. A footprint is u in [u0, u1], v in [v0, v1], front corner (u1, v1).


def box(u0, u1, v0, v1, z0, z1):
    """The three faces of a box the camera sees: its top, the face turned south-west (v = v1, the long-looking one,
    left of the front corner) and the face turned east-south-east (u = u1, right of it)."""
    return [
        ([lattice(u0, v1, z0), lattice(u1, v1, z0), lattice(u1, v1, z1), lattice(u0, v1, z1)], SHADE),
        ([lattice(u1, v0, z0), lattice(u1, v1, z0), lattice(u1, v1, z1), lattice(u1, v0, z1)], LIT),
        ([lattice(u0, v0, z1), lattice(u1, v0, z1), lattice(u1, v1, z1), lattice(u0, v1, z1)], TOP),
    ]


def gable(u0, u1, v0, v1, z0, ridge):
    """A gable roof whose ridge runs along u, over the middle of v: two slopes and the gable end at u = u1."""
    vm = (v0 + v1) / 2
    return [
        # the slope facing south-west, toward the camera
        ([lattice(u0, v1, z0), lattice(u1, v1, z0), lattice(u1, vm, ridge), lattice(u0, vm, ridge)], ROOF_SHADE),
        # the gable end, a triangle of wall, turned east
        ([lattice(u1, v0, z0), lattice(u1, v1, z0), lattice(u1, vm, ridge)], LIT),
        # the slope facing north-east: seen only over the ridge, so drawn before nothing that covers it
    ]


def hip(u0, u1, v0, v1, z0, top):
    """A hipped roof: four slopes rising to a ridge along the longer side, the two the camera sees and the hip."""
    du, dv = u1 - u0, v1 - v0
    inset = min(du, dv) / 2
    a = lattice(u0 + inset, (v0 + v1) / 2, top) if du >= dv else lattice((u0 + u1) / 2, v0 + inset, top)
    b = lattice(u1 - inset, (v0 + v1) / 2, top) if du >= dv else lattice((u0 + u1) / 2, v1 - inset, top)
    return [
        ([lattice(u0, v0, z0), lattice(u1, v0, z0), b, a], ROOF_LIT),  # the far slope, behind
        ([lattice(u0, v1, z0), lattice(u1, v1, z0), b, a], ROOF_SHADE),  # south-west slope
        ([lattice(u1, v0, z0), lattice(u1, v1, z0), b], ROOF_LIT),  # east hip
    ]


def cylinder(uc, vc, r, z0, z1, steps=48):
    """A round tower: its wall, shaded across its width as the light comes from the right, and its top."""
    faces = []
    for i in range(steps):
        a0 = 2 * math.pi * i / steps
        a1 = 2 * math.pi * (i + 1) / steps
        # world direction of this strip of wall; it is seen when it faces south at all
        mid = (a0 + a1) / 2
        nx, ny = math.cos(mid), math.sin(mid)
        if ny <= 0:
            continue
        light = max(0.0, nx * 0.8 + 0.2)
        shade = tuple(int(SHADE[k] + (LIT[k] - SHADE[k]) * light) for k in range(3)) + (255,)
        p = [(uc_world(uc, vc)[0] + r * math.cos(a), uc_world(uc, vc)[1] + r * math.sin(a)) for a in (a0, a1)]
        faces.append(([world(p[0], z0), world(p[1], z0), world(p[1], z1), world(p[0], z1)], shade))
    top = [world((uc_world(uc, vc)[0] + r * math.cos(a), uc_world(uc, vc)[1] + r * math.sin(a)), z1)
           for a in [2 * math.pi * i / steps for i in range(steps)]]
    faces.append((top, TOP))
    return faces


def cone(uc, vc, r, z0, apex, steps=48):
    """A conical roof: the slopes facing the camera, shaded as the wall below it."""
    faces = []
    centre = uc_world(uc, vc)
    tip = world(centre, apex)
    for i in range(steps):
        a0 = 2 * math.pi * i / steps
        a1 = 2 * math.pi * (i + 1) / steps
        mid = (a0 + a1) / 2
        nx = math.cos(mid)
        light = max(0.0, nx * 0.8 + 0.2)
        shade = tuple(int(ROOF_SHADE[k] + (ROOF_LIT[k] - ROOF_SHADE[k]) * light) for k in range(3)) + (255,)
        p0 = world((centre[0] + r * math.cos(a0), centre[1] + r * math.sin(a0)), z0)
        p1 = world((centre[0] + r * math.cos(a1), centre[1] + r * math.sin(a1)), z0)
        faces.append(([p0, p1, tip], shade))
    # back slopes first: sort by the strip's southness
    faces.sort(key=lambda f: max(pt[1] for pt in f[0][:2]))
    return faces


def uc_world(u, v):
    return (u * C - v * S, u * S + v * C)


def world(xy, z):
    return (xy[0], xy[1] * SQUASH - z * RISE)


def draw_solid(canvas, faces, edges=True):
    for points, fill in faces:
        canvas.polygon(points, fill=fill, outline=INK if edges else None, width=0.6)


def footprint(canvas, side, fill=EARTH, edge=EARTH_EDGE, cells=True, deep=None):
    """The square of diamonds a building covers, its front corner at the origin: u, v in [-side, 0]; or an oblong,
    [deep] diamonds back along v."""
    deep = side if deep is None else deep
    if cells:
        for u in range(-side, 0):
            for v in range(-deep, 0):
                canvas.polygon([lattice(u + 1, v + 1), lattice(u, v + 1), lattice(u, v), lattice(u + 1, v)],
                               fill=fill, outline=edge, width=0.5)
    else:
        canvas.polygon([lattice(0, 0), lattice(-side, 0), lattice(-side, -side), lattice(0, -side)], fill=fill)


def outline(canvas, side, colour=INK, width=1.6, dash=(5, 3)):
    corners = [lattice(0, 0), lattice(-side, 0), lattice(-side, -side), lattice(0, -side)]
    for a, b in zip(corners, corners[1:] + corners[:1]):
        canvas.line(a, b, fill=colour, width=width, dash=dash)


# ---------------------------------------------------------------------------------------------------------------
# 1. The ground and a base: what the camera does to the grid, and where a building stands on it.

def ground_sheet():
    W, H = 900, 640
    c = Canvas(W, H, unit=46, origin=(470, 470), background=PAPER)
    # a patch of the grid around the base
    for u in range(-13, 6):
        for v in range(-13, 6):
            c.polygon([lattice(u + 1, v + 1), lattice(u, v + 1), lattice(u, v), lattice(u + 1, v)],
                      outline=(200, 190, 172, 255), width=0.6)
    footprint(c, 6)
    outline(c, 6)
    # the two edges' angles, measured on the screen from the horizontal
    left = lattice(-6, 0)
    right = lattice(0, -6)
    la = math.degrees(math.atan2(-left[1], -left[0]))
    ra = math.degrees(math.atan2(-right[1], right[0]))
    c.line((0, 0), (-7.4, 0), fill=GOLD, width=1, dash=(3, 3))
    c.line((0, 0), (3.6, 0), fill=GOLD, width=1, dash=(3, 3))
    c.dot((0, 0), 6, RED)
    c.text((486, 478), 'the foot: the front corner of the base,', size=15, bold=True)
    c.text((486, 498), 'its lowest point, a sixth of its width right of its middle', size=14)
    lx, ly = c.px(lerp((0, 0), left, 0.75))
    c.text((lx / SUPER - 250, ly / SUPER + 18), f'long front edge: {la:.0f}° up to the left', size=14, bold=True)
    rx, ry = c.px(lerp((0, 0), right, 0.6))
    c.text((rx / SUPER + 14, ry / SUPER), f'short side: {ra:.0f}° up to the right', size=14, bold=True)
    c.text((24, 24), 'The map\'s ground, closest in', size=22, bold=True)
    c.text((24, 56), 'Parallel camera (no vanishing points), north up, looking down at 45 degrees.', size=15)
    c.text((24, 78), 'The ground\'s grid is turned 26 degrees; each cell is one square diamond.', size=15)
    c.text((24, 100), 'A building\'s base is a square of whole diamonds, here 6 by 6.', size=15)
    # north and the light
    c.text((W - 140, 24), 'north ↑', size=16, bold=True)
    c.text((W - 236, 52), 'light from the upper right', size=15, fill=GOLD, bold=True)
    tail, head = (W - 40, 80), (W - 100, 130)
    c.draw.line([(tail[0] * SUPER, tail[1] * SUPER), (head[0] * SUPER, head[1] * SUPER)], fill=GOLD, width=3 * SUPER)
    c.draw.polygon([(head[0] * SUPER, head[1] * SUPER), ((head[0] + 18) * SUPER, (head[1] - 4) * SUPER),
                    ((head[0] + 6) * SUPER, (head[1] - 16) * SUPER)], fill=GOLD)
    c.save('1-ground-and-base.png')
    return la, ra


# 2. Upright things: a box, so the verticals and the faces read.

def block_box():
    c = Canvas(384, 384, unit=40, origin=(230, 360))
    footprint(c, 4, cells=True)
    draw_solid(c, box(-4, 0, -4, 0, 0, 4))
    c.save('2-box-4-by-4-by-4.png')


# 3. A house: walls and a gable roof whose ridge runs along the long front.

def block_house():
    c = Canvas(384, 384, unit=34, origin=(240, 360))
    footprint(c, 5, cells=True, deep=3)
    faces = box(-5, 0, -3, 0, 0, 2.2)
    draw_solid(c, faces[:2])
    draw_solid(c, gable(-5, 0, -3, 0, 2.2, 4.2))
    # the far slope's top edge is the ridge, drawn already; the far slope itself shows only as the ridge line
    c.save('3-house-gable-roof.png')


# 4. A round tower: circles become ellipses half again as wide as tall, never tilted.

def block_tower():
    c = Canvas(384, 384, unit=40, origin=(205, 330))
    footprint(c, 3, cells=True)
    draw_solid(c, cylinder(-1.5, -1.5, 1.35, 0, 5.2), edges=False)
    draw_solid(c, cone(-1.5, -1.5, 1.55, 5.2, 8.0), edges=False)
    c.save('4-round-tower.png')


# 5. A castle: a curtain wall round a court, a round tower at each corner, a keep at the back.

def block_castle():
    c = Canvas(384, 384, unit=30, origin=(232, 362))
    side = 6
    footprint(c, side, cells=True)
    wall_h, t = 1.6, 0.55
    # everything by how far back it stands, the farthest first: a parallel camera needs nothing cleverer here
    depth = lambda u, v: u * S + v * C
    parts = [
        (depth(-3, -side), box(-side, 0, -side, -side + t, 0, wall_h)),  # north wall
        (depth(-side, -3), box(-side, -side + t, -side, 0, 0, wall_h)),  # west wall
        (depth(-3.2, -3.6), box(-4.4, -2.0, -4.6, -2.6, 0, 3.6) [:2] + gable(-4.4, -2.0, -4.6, -2.6, 3.6, 4.9)),
        (depth(0, -3), box(-t, 0, -side, 0, 0, wall_h)),  # east wall
        (depth(-3, 0), box(-side, 0, -t, 0, 0, wall_h)),  # south wall
    ]
    # inside the footprint, so the front tower's foot is the base's front corner
    r = 0.85
    for u, v in [(-side + r, -side + r), (-r, -side + r), (-side + r, -r), (-r, -r)]:
        parts.append((depth(u, v) + 0.3, cylinder(u, v, r, 0, 2.6) + cone(u, v, r + 0.15, 2.6, 4.9)))
    for _, faces in sorted(parts, key=lambda part: part[0]):
        round_ = any(len(points) == 3 for points, _ in faces) and len(faces) > 10
        draw_solid(c, faces, edges=not round_)
    c.save('5-castle-block-out.png')


# 6. What is wrong today: a painted castle with the square its base should cover.

def today(picture_path, foot, aspect_height=8.0, side=6):
    picture = Image.open(picture_path).convert('RGBA')
    box_ = picture.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
    picture = picture.crop(box_)
    W, H = 520, 420
    unit = 40
    c = Canvas(W, H, unit=unit, origin=(330, 380), background=PAPER)
    footprint(c, side, cells=True)
    h_px = aspect_height * unit
    w_px = h_px * picture.width / picture.height
    pic = picture.resize((round(w_px * SUPER), round(h_px * SUPER)), Image.LANCZOS)
    x = (330 - foot * w_px) * SUPER
    y = (380 - h_px) * SUPER
    c.image.alpha_composite(pic, (round(x), round(y)))
    c.draw = ImageDraw.Draw(c.image)
    outline(c, side, colour=RED, width=2.2, dash=(6, 4))
    c.text((16, 14), 'Today: painted from too low', size=18, bold=True)
    c.text((16, 38), 'red: the square its base covers on the map', size=14, fill=RED)
    c.save('6-today-castle-and-its-square.png')


# 7. Every type at its first level: its footprint, and the frame its picture fills, as tall as the catalogue says.

TYPES = [
    ('castle', 6, 8.0), ('manor', 4, 6.0), ('palace', 7, 10.0), ('fort', 5, 7.2), ('watchtower', 3, 6.4),
    ('prison', 4, 5.6), ('cathedral', 6, 10.0), ('abbey', 5, 6.8), ('mill', 2, 4.8), ('mine', 3, 4.8),
    ('market', 5, 5.6), ('harbour', 6, 6.0), ('shipyard', 4, 6.0), ('manufactory', 4, 6.0), ('academy', 5, 6.8),
    ('printingHouse', 3, 5.6),
]


def sizes_sheet():
    unit = 12
    cols, cell_w, cell_h = 4, 230, 210
    W, H = cols * cell_w + 20, 80 + 4 * cell_h
    sheet = Image.new('RGBA', (W * SUPER, H * SUPER), PAPER)
    title = Canvas(W, 80, unit=unit, origin=(0, 0), background=PAPER)
    title.text((16, 14), 'Every type at its first level: its footprint, and the frame its picture fills', size=18, bold=True)
    title.text((16, 42), 'dashed: the picture, foot to top as tall as the catalogue says; earth: the square its base covers',
               size=13)
    w, h = title.image.size
    sheet.alpha_composite(title.image, (0, 0))
    for i, (name, side, height) in enumerate(TYPES):
        col, row = i % cols, i // cols
        c = Canvas(cell_w, cell_h, unit=unit, origin=(cell_w * 0.62, cell_h - 26), background=PAPER)
        footprint(c, side)
        outline(c, side, width=1.2, dash=(4, 3))
        left, right = lattice(-side, 0)[0], lattice(0, -side)[0]
        top = -height
        frame = [(left, 0), (right, 0), (right, top), (left, top)]
        for a, b in zip(frame, frame[1:] + frame[:1]):
            c.line(a, b, fill=GOLD, width=1.2, dash=(4, 3))
        c.dot((0, 0), 3.5, RED)
        c.text((10, 8), name, size=14, bold=True)
        c.text((10, 28), f'footprint {side}, {height:g} tall', size=12)
        c.text((10, 46), f'wide : tall = {(right - left) / height:.2f}', size=12)
        sheet.alpha_composite(c.image, (col * cell_w * SUPER + 10 * SUPER, (80 + row * cell_h) * SUPER))
    sheet.resize((W, H), Image.LANCZOS).save(os.path.join(OUT, '7-every-type-footprint-and-frame.png'))


os.makedirs(OUT, exist_ok=True)
sizes_sheet()
angles = ground_sheet()
block_box()
block_house()
block_tower()
block_castle()
if len(sys.argv) > 3:
    today(sys.argv[2], float(sys.argv[3]))
print('edge angles: %.2f left, %.2f right' % angles)
print('upright lengths x %.4f, ground depth x %.4f' % (RISE, SQUASH))

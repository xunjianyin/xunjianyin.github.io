#!/usr/bin/env python3
"""Draw the Gödel Agent robot strip: python3 scripts/godel_illustrations.py.

Six flat SVG panels tell the paper's loop as a metaphor. The robot's parts
stand for parts of its program: glasses read feedback, arms solve tasks, and
the wrench hand edits the robot itself. It tries a stack of word problems,
looks at its own parts, swaps in a stronger arm, gets stronger, survives a bad
swap, and finally upgrades the tools it uses to upgrade itself.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "papers" / "assets"

# Site palette (papers/paper-page.css); fixed values because <img> SVGs cannot read CSS variables.
INK = "#202a26"
MUTED = "#6c7570"
ACCENT = "#2b6151"
MID = "#8fb09c"
LIGHT = "#dfe9e1"
WASH = "#f0f4ee"
WHITE = "#ffffff"
WARM = "#b35c3a"
WARM_LIGHT = "#f4e4d9"
SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, Menlo, Consolas, monospace"

WIDTH, HEIGHT, GROUND = 360, 300, 272
Point = tuple[float, float]


def text(x: float, y: float, value: str, size: float = 12, color: str = INK, anchor: str = "middle",
         mono: bool = False, weight: int = 400) -> str:
    family = MONO if mono else SANS
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" font-weight="{weight}" '
            f'fill="{color}" text-anchor="{anchor}">{value}</text>')


def arrow(path: str, color: str = MUTED, width: float = 2) -> str:
    head = {WARM: "warm", ACCENT: "accent"}.get(color, "ink")
    return (f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" '
            f'marker-end="url(#head-{head})"/>')


def wrench_head(x: float, y: float, angle: float, size: float = 1.0, fill: str = WHITE) -> str:
    """Open-jaw wrench head whose jaw opens along +x after rotation."""
    return (f'<g transform="translate({x:.1f} {y:.1f}) rotate({angle:.1f}) scale({size})">'
            f'<path d="M-4 -5 H6 L10 -11 H18 L21 -5 H13 V5 H21 L18 11 H10 L6 5 H-4 Z" fill="{fill}" '
            f'stroke="{INK}" stroke-width="2" stroke-linejoin="round"/></g>')


def angle_of(a: Point, b: Point) -> float:
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))


@dataclass
class Arm:
    """kind: thin | strong | tool | socket; hand in robot-local coordinates."""
    kind: str
    hand: Point
    elbow: Point | None = None
    front: bool = False           # draw in front of the body, e.g. when reaching across it


@dataclass
class Robot:
    x: float
    scale: float = 1.0
    version: int = 1
    eyes: str = "open"            # open | happy | worried | dizzy | focused
    look: Point = (0, 0)
    mouth: str = "smile"          # smile | grin | flat | open | determined
    glasses: str = "round"        # round | goggles | none
    left: Arm = field(default_factory=lambda: Arm("tool", (-60, -58)))
    right: Arm = field(default_factory=lambda: Arm("thin", (60, -58)))
    backpack: bool = False
    tilt: float = 0.0
    spring_leg: bool = False

    def svg(self) -> str:
        parts: list[str] = []
        if self.backpack:
            parts.append(self._backpack())
        parts.append(self._legs())
        # Strong arms sit in front of the body; an arm marked `front` (e.g. the tool hand at work) goes on top of everything.
        in_front = sorted(((side, arm) for side, arm in ((-1, self.left), (1, self.right)) if arm.kind == "strong" or arm.front),
                          key=lambda item: item[1].front)
        for side, arm in ((-1, self.left), (1, self.right)):
            if (side, arm) not in in_front:
                parts.append(self._arm(side, arm))
        parts.append(self._body())
        for side, arm in in_front:
            parts.append(self._arm(side, arm))
        parts.append(self._head())
        body = "".join(parts)
        return (f'<g transform="translate({self.x:.1f} {GROUND}) rotate({self.tilt}) scale({self.scale})">'
                f'{body}</g>')

    # --- parts -----------------------------------------------------------
    def _legs(self) -> str:
        w = {1: 10, 2: 13, 3: 16}[self.version]
        out = []
        for side in (-1, 1):
            cx = side * 17
            if self.spring_leg and side == 1:
                coil = " ".join(f"L{cx + (7 if i % 2 else -7)} {-10 - i * 4}" for i in range(6))
                out.append(f'<path d="M{cx} -8 {coil} L{cx} -34" fill="none" stroke="{WARM}" stroke-width="2.5" stroke-linejoin="round"/>')
                out.append(f'<rect x="{cx - 12}" y="-8" width="24" height="8" fill="{WARM}"/>')
                continue
            out.append(f'<rect x="{cx - w / 2}" y="-34" width="{w}" height="27" fill="{WHITE}" stroke="{INK}" stroke-width="2.5"/>')
            if self.version == 3:
                out.append(f'<rect x="{cx - w / 2 - 2}" y="-24" width="{w + 4}" height="7" fill="{ACCENT}" stroke="{INK}" stroke-width="2"/>')
            out.append(f'<rect x="{cx - 13}" y="-8" width="26" height="8" fill="{INK}"/>')
        return "".join(out)

    def _body(self) -> str:
        out = [f'<rect x="-42" y="-108" width="84" height="76" fill="{WHITE}" stroke="{INK}" stroke-width="3"/>']
        if self.version >= 3:
            # Chest plate: the sturdiest version wears armour.
            out.append(f'<path d="M-30 -100 H30 V-66 L0 -48 L-30 -66 Z" fill="{ACCENT}" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>')
            out.append(f'<path d="M-14 -86 L0 -74 L14 -86" fill="none" stroke="{WHITE}" stroke-width="3" stroke-linecap="round"/>')
            out.append(f'<rect x="-42" y="-44" width="84" height="7" fill="{LIGHT}" stroke="{INK}" stroke-width="2"/>')
        else:
            lines = "".join(f'<rect x="-22" y="{-90 + i * 9}" width="{w}" height="4" fill="{ACCENT if i == 0 else MUTED}"/>'
                            for i, w in enumerate((30, 40, 22)))
            out.append(f'<rect x="-30" y="-98" width="60" height="36" fill="{LIGHT}" stroke="{INK}" stroke-width="2"/>{lines}')
        out.append(text(0, -48 if self.version < 3 else -54, f"v{self.version}", 10,
                        MUTED if self.version < 3 else WHITE, mono=True, weight=600))
        return "".join(out)

    def _arm(self, side: int, arm: Arm) -> str:
        shoulder = (side * 42, -96)
        if arm.kind == "socket":
            return (f'<circle cx="{shoulder[0]}" cy="{shoulder[1]}" r="7" fill="{LIGHT}" stroke="{INK}" stroke-width="2"/>'
                    f'<circle cx="{shoulder[0]}" cy="{shoulder[1]}" r="2" fill="{INK}"/>')
        hx, hy = arm.hand
        ex, ey = arm.elbow or ((shoulder[0] + hx) / 2 + side * 6, (shoulder[1] + hy) / 2 + 4)
        path = f"M{shoulder[0]} {shoulder[1]} L{ex} {ey} L{hx} {hy}"
        if arm.kind == "strong":
            fore = f"M{ex} {ey} L{hx} {hy}"
            return (f'<path d="{path}" fill="none" stroke="{INK}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>'
                    f'<path d="{path}" fill="none" stroke="{WHITE}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>'
                    f'<path d="{fore}" fill="none" stroke="{MID}" stroke-width="11" stroke-linecap="butt"/>'
                    f'<rect x="{shoulder[0] - 11}" y="{shoulder[1] - 11}" width="22" height="16" fill="{ACCENT}" stroke="{INK}" stroke-width="2.5"/>'
                    f'<rect x="{hx - 10}" y="{hy - 10}" width="20" height="20" fill="{WHITE}" stroke="{INK}" stroke-width="2.5"/>'
                    f'<path d="M{hx - 10} {hy - 2} H{hx + 10}" stroke="{INK}" stroke-width="1.6"/>')
        tube = (f'<path d="{path}" fill="none" stroke="{INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'
                f'<path d="{path}" fill="none" stroke="{WHITE}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
        if arm.kind == "tool":
            return tube + wrench_head(hx, hy, angle_of((ex, ey), (hx, hy)), 1.0)
        return tube + f'<circle cx="{hx}" cy="{hy}" r="7.5" fill="{WHITE}" stroke="{INK}" stroke-width="2.5"/>'

    def _backpack(self) -> str:
        """Two extra tool arms behind the shoulders: edits run in parallel."""
        out = [f'<rect x="-36" y="-118" width="72" height="30" fill="{LIGHT}" stroke="{INK}" stroke-width="2.5"/>']
        for side in (-1, 1):
            base = (side * 30, -116)
            elbow = (side * 58, -150)
            tip = (side * 50, -178)
            path = f"M{base[0]} {base[1]} L{elbow[0]} {elbow[1]} L{tip[0]} {tip[1]}"
            out.append(f'<path d="{path}" fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>')
            out.append(f'<path d="{path}" fill="none" stroke="{WHITE}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>')
            out.append(wrench_head(tip[0], tip[1], angle_of(elbow, tip), 0.9, WASH))
        return "".join(out)

    def _head(self) -> str:
        out = [f'<rect x="-9" y="-116" width="18" height="9" fill="{WHITE}" stroke="{INK}" stroke-width="2.5"/>']
        for side in (-1, 1):
            out.append(f'<rect x="{side * 42 - 4}" y="-154" width="8" height="20" fill="{LIGHT}" stroke="{INK}" stroke-width="2"/>')
        out.append(f'<rect x="-38" y="-170" width="76" height="55" fill="{WHITE}" stroke="{INK}" stroke-width="3"/>')
        # Antenna gains a signal ring with each version.
        out.append(f'<path d="M0 -170 V-188" stroke="{INK}" stroke-width="2.5"/>')
        out.append(f'<circle cx="0" cy="-193" r="5.5" fill="{ACCENT}" stroke="{INK}" stroke-width="2"/>')
        for ring in range(1, self.version):
            r = 7 + ring * 5
            out.append(f'<path d="M{-r * 0.7:.1f} {-193 - r * 0.7:.1f} A{r} {r} 0 0 1 {r * 0.7:.1f} {-193 - r * 0.7:.1f}" '
                       f'fill="none" stroke="{ACCENT}" stroke-width="2" stroke-linecap="round"/>')
        out.append(self._face())
        out.append(self._glasses())
        return "".join(out)

    def _face(self) -> str:
        dx, dy = self.look
        out = []
        for side in (-1, 1):
            cx, cy = side * 15, -146
            if self.eyes in ("open", "focused"):
                r = 6.5 if self.eyes == "open" else 5.5
                out.append(f'<circle cx="{cx + dx}" cy="{cy + dy}" r="{r}" fill="{INK}"/>')
                out.append(f'<circle cx="{cx + dx + 2.2}" cy="{cy + dy - 2.2}" r="2" fill="{WHITE}"/>')
                if self.eyes == "focused":
                    out.append(f'<path d="M{cx - 8} {cy - 11 - side * 2} L{cx + 7} {cy - 11 + side * 2}" stroke="{INK}" stroke-width="2.6" stroke-linecap="round"/>')
            elif self.eyes == "happy":
                out.append(f'<path d="M{cx - 7} {cy + 2} Q{cx} {cy - 8} {cx + 7} {cy + 2}" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>')
            elif self.eyes == "worried":
                out.append(f'<circle cx="{cx + dx}" cy="{cy + dy + 1}" r="5.5" fill="{INK}"/>')
                out.append(f'<path d="M{cx - 8} {cy - 12 + side * -2} L{cx + 7} {cy - 12 + side * 2}" stroke="{INK}" stroke-width="2.5" stroke-linecap="round"/>')
            elif self.eyes == "dizzy":
                out.append(f'<path d="M{cx - 5} {cy - 5} L{cx + 5} {cy + 5} M{cx + 5} {cy - 5} L{cx - 5} {cy + 5}" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>')
            out.append(f'<circle cx="{side * 27}" cy="-128" r="4" fill="{WARM_LIGHT}"/>')
        mouths = {
            "smile": f'<path d="M-9 -129 Q0 -121 9 -129" fill="none" stroke="{INK}" stroke-width="2.5" stroke-linecap="round"/>',
            "grin": f'<path d="M-11 -130 Q0 -117 11 -130 Z" fill="{INK}"/>',
            "flat": f'<path d="M-7 -126 H7" stroke="{INK}" stroke-width="2.5" stroke-linecap="round"/>',
            "open": f'<ellipse cx="0" cy="-125" rx="4.5" ry="5.5" fill="{INK}"/>',
            "determined": f'<path d="M-10 -127 Q0 -122 10 -127" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>',
        }
        return "".join(out) + mouths[self.mouth]

    def _glasses(self) -> str:
        if self.glasses == "round":
            lenses = "".join(f'<circle cx="{side * 15}" cy="-146" r="11" fill="none" stroke="{INK}" stroke-width="2"/>' for side in (-1, 1))
            return lenses + f'<path d="M-4 -147 Q0 -150 4 -147 M-26 -148 H-38 M26 -148 H38" fill="none" stroke="{INK}" stroke-width="2"/>'
        if self.glasses == "goggles":
            # Wider lenses and a jeweller's loupe: it now sees full error traces.
            strap = f'<path d="M-38 -148 H38" stroke="{ACCENT}" stroke-width="5"/>'
            lenses = "".join(f'<rect x="{side * 15 - 12}" y="-158" width="24" height="22" fill="{WHITE}" fill-opacity="0.3" stroke="{ACCENT}" stroke-width="3.5"/>'
                             for side in (-1, 1))
            loupe = (f'<rect x="21" y="-155" width="12" height="16" fill="{MID}" stroke="{INK}" stroke-width="2"/>'
                     f'<rect x="33" y="-153" width="8" height="12" fill="{WHITE}" stroke="{INK}" stroke-width="2"/>')
            return strap + lenses + loupe
        return ""


# --- props -------------------------------------------------------------------
def task_stack(x: float, marks: str, label: str = "word problems, many languages") -> str:
    """A stack of real-looking task sheets and a card with the latest results."""
    y = GROUND - 118
    out = []
    for i in (2, 1):
        out.append(f'<rect x="{x + i * 5}" y="{y - i * 5}" width="92" height="84" fill="{WHITE}" stroke="{INK}" stroke-width="1.8"/>')
    out.append(f'<rect x="{x}" y="{y}" width="92" height="84" fill="{WHITE}" stroke="{INK}" stroke-width="2.2"/>')
    for i, q in enumerate(("How many …?", "¿Cuántos …?", "一共多少…？", "Combien …?")):
        out.append(text(x + 8, y + 18 + i * 17, q, 9.5, INK, "start"))
    out.append(text(x + 46, y - 22, label, 9.5, MUTED))
    # Result card: one mark per sheet.
    cy = GROUND - 26
    out.append(f'<rect x="{x}" y="{cy}" width="92" height="22" fill="{WASH}" stroke="{INK}" stroke-width="1.8"/>')
    for i, m in enumerate(marks):
        cx = x + 14 + i * 21
        if m == "v":
            out.append(f'<path d="M{cx - 5} {cy + 11} L{cx - 1} {cy + 15} L{cx + 6} {cy + 6}" fill="none" stroke="{ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>')
        else:
            out.append(f'<path d="M{cx - 5} {cy + 6} L{cx + 5} {cy + 16} M{cx + 5} {cy + 6} L{cx - 5} {cy + 16}" stroke="{WARM}" stroke-width="2.6" stroke-linecap="round"/>')
    return "".join(out)


def meter(level: float) -> str:
    """Illustrative, unnumbered score gauge in the same slot of every panel."""
    x, top, height = 334, GROUND - 124, 116
    fill_h = height * level
    ticks = "".join(f'<path d="M{x - 5} {top + height * t:.1f} h4" stroke="{MUTED}" stroke-width="1.2"/>' for t in (0.25, 0.5, 0.75))
    return (f'<rect x="{x}" y="{top}" width="13" height="{height}" fill="{WHITE}" stroke="{INK}" stroke-width="2"/>'
            f'<rect x="{x + 2.5}" y="{top + height - fill_h + 2.5:.1f}" width="8" height="{max(fill_h - 5, 0):.1f}" fill="{ACCENT}"/>'
            f'{ticks}{text(x + 6.5, top - 8, "score", 9.5, MUTED)}')


def sparkle(cx: float, cy: float, r: float = 6, color: str = ACCENT) -> str:
    return (f'<path d="M{cx:.1f} {cy - r:.1f} Q{cx:.1f} {cy:.1f} {cx + r:.1f} {cy:.1f} Q{cx:.1f} {cy:.1f} {cx:.1f} {cy + r:.1f} '
            f'Q{cx:.1f} {cy:.1f} {cx - r:.1f} {cy:.1f} Q{cx:.1f} {cy:.1f} {cx:.1f} {cy - r:.1f} Z" fill="{color}"/>')


def spark(cx: float, cy: float, r: float = 12) -> str:
    points = []
    for i in range(16):
        radius = r if i % 2 == 0 else r * 0.45
        a = math.pi * 2 * i / 16 - math.pi / 2
        points.append(f"{cx + radius * math.cos(a):.1f},{cy + radius * math.sin(a):.1f}")
    return f'<polygon points="{" ".join(points)}" fill="{WARM}" stroke="{INK}" stroke-width="1.5" stroke-linejoin="round"/>'


def note(x: float, y: float, label: str, angle: float = -8, color: str = WARM) -> str:
    lines = "".join(f'<path d="M6 {16 + i * 6} h{w}" stroke="{MUTED}" stroke-width="1.4"/>' for i, w in enumerate((30, 24, 28)))
    return (f'<g transform="translate({x:.1f} {y:.1f}) rotate({angle})">'
            f'<rect x="0" y="0" width="44" height="36" fill="{WARM_LIGHT if color == WARM else WHITE}" stroke="{color}" stroke-width="1.8"/>'
            f'{text(22, 11, label, 8.5, color, mono=True, weight=600)}{lines}</g>')


def loose_arm(x: float, y: float, angle: float, kind: str = "thin") -> str:
    """An arm that is not attached to the robot (lying on the floor, or about to be fitted)."""
    if kind == "strong":
        body = (f'<path d="M0 0 H46" stroke="{INK}" stroke-width="17" stroke-linecap="round"/>'
                f'<path d="M0 0 H46" stroke="{WHITE}" stroke-width="11" stroke-linecap="round"/>'
                f'<path d="M22 0 H46" stroke="{MID}" stroke-width="11"/>'
                f'<rect x="-11" y="-9" width="16" height="18" fill="{ACCENT}" stroke="{INK}" stroke-width="2.5"/>'
                f'<rect x="44" y="-10" width="20" height="20" fill="{WHITE}" stroke="{INK}" stroke-width="2.5"/>'
                f'<path d="M44 -2 H64" stroke="{INK}" stroke-width="1.6"/>')
    else:
        body = (f'<path d="M0 0 H40" stroke="{INK}" stroke-width="10" stroke-linecap="round"/>'
                f'<path d="M0 0 H40" stroke="{WHITE}" stroke-width="5" stroke-linecap="round"/>'
                f'<circle cx="44" cy="0" r="7.5" fill="{WHITE}" stroke="{INK}" stroke-width="2.5"/>')
    return f'<g transform="translate({x:.1f} {y:.1f}) rotate({angle})">{body}</g>'


def mirror(x: float, y: float) -> str:
    """A standing mirror that shows the robot as a labelled blueprint of its own parts."""
    w, h = 170, 170
    out = [f'<path d="M{x + 30} {y + h} L{x + 22} {GROUND} M{x + w - 30} {y + h} L{x + w - 22} {GROUND}" stroke="{INK}" stroke-width="2.5"/>',
           f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{WASH}" stroke="{INK}" stroke-width="3"/>']
    # Blueprint of the robot, dashed.
    bx, by = x + 42, y + 50
    dash = f'fill="none" stroke="{ACCENT}" stroke-width="1.8" stroke-dasharray="4 3"'
    out.append(f'<rect x="{bx - 20}" y="{by - 26}" width="40" height="28" {dash}/>')
    out.append(f'<rect x="{bx - 22}" y="{by + 6}" width="44" height="40" {dash}/>')
    out.append(f'<circle cx="{bx - 8}" cy="{by - 12}" r="6" {dash}/><circle cx="{bx + 8}" cy="{by - 12}" r="6" {dash}/>')
    out.append(f'<path d="M{bx + 22} {by + 12} L{bx + 36} {by + 34}" {dash}/>')
    out.append(f'<path d="M{bx - 22} {by + 12} L{bx - 32} {by + 36}" {dash}/>')
    out.append(wrench_head(bx - 34, by + 40, 110, 0.6, WASH))
    labels = [((bx + 14, by - 12), y + 32, "glasses", "read feedback"),
              ((bx + 36, by + 34), y + 88, "arm", "solves tasks"),
              ((bx - 30, by + 48), y + 142, "tool hand", "edits itself")]
    for (px, py), ly, name, role in labels:
        out.append(f'<path d="M{px:.1f} {py:.1f} L{x + 92} {ly - 4}" stroke="{MUTED}" stroke-width="1"/>')
        out.append(text(x + 96, ly, name, 10, ACCENT, "start", weight=600))
        out.append(text(x + 96, ly + 13, role, 9.5, INK, "start"))
    return "".join(out)


def loop_mark(cx: float, cy: float, label: str) -> str:
    r = 17
    return (f'<path d="M{cx + r} {cy} A{r} {r} 0 1 1 {cx} {cy - r}" fill="none" stroke="{ACCENT}" stroke-width="2.5" '
            f'marker-end="url(#head-accent)"/>{text(cx, cy + 4.5, label, 11, ACCENT, mono=True, weight=600)}')


def panel(number: int, title: str, body: str) -> str:
    defs = "".join(
        f'<marker id="head-{name}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">'
        f'<path d="M0 0 L8 4 L0 8 Z" fill="{color}"/></marker>'
        for name, color in (("ink", MUTED), ("warm", WARM), ("accent", ACCENT)))
    header = (text(18, 28, f"{number:02d}", 12, ACCENT, "start", mono=True, weight=600)
              + text(44, 28, title, 14, INK, "start", weight=600))
    ground = f'<path d="M14 {GROUND} H{WIDTH - 14}" stroke="{INK}" stroke-width="2"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}" '
            f'role="img"><title>{title}</title><defs>{defs}</defs><rect width="{WIDTH}" height="{HEIGHT}" fill="{WHITE}"/>'
            f'{header}{ground}{body}</svg>\n')


def scenes() -> list[tuple[str, str, str]]:
    """(file stem, title, svg body) for each panel, in story order."""
    v1, v2, v3 = 0.88, 1.0, 1.08

    # 01 A small robot works through a stack of word problems; most answers are wrong.
    s1 = Robot(x=88, scale=v1, version=1, eyes="worried", look=(3, 0), mouth="flat",
               left=Arm("tool", (-58, -52)), right=Arm("thin", (62, -78))).svg()
    s1 += task_stack(196, "xxvx")
    s1 += meter(0.18)

    # 02 It looks at itself: each part of its body is a part of its program.
    s2 = Robot(x=76, scale=v1, version=1, eyes="open", look=(4, -1), mouth="open",
               left=Arm("tool", (-58, -56)), right=Arm("thin", (30, -126), elbow=(66, -100))).svg()
    s2 += mirror(148, 62)
    s2 += meter(0.18)

    # 03 With its tool hand it fits a stronger arm; the old one lies on the floor.
    s3 = Robot(x=112, scale=v1, version=1, eyes="focused", look=(4, 2), mouth="determined",
               left=Arm("tool", (24, -80), elbow=(-12, -58), front=True), right=Arm("strong", (78, -58))).svg()
    s3 += loose_arm(206, GROUND - 8, 0)
    s3 += text(232, GROUND - 22, "old arm", 9.5, MUTED)
    s3 += sparkle(112 + 50 * v1, GROUND - 106 * v1, 5) + sparkle(112 + 58 * v1, GROUND - 84 * v1, 3.5)
    s3 += text(226, 118, "a stronger way", 10.5, ACCENT, weight=600)
    s3 += text(226, 132, "to solve tasks", 10.5, ACCENT, weight=600)
    s3 += arrow("M222 138 C212 150 200 160 188 172", ACCENT)
    s3 += meter(0.2)

    # 04 Bigger and sturdier, it now gets most problems right.
    s4 = Robot(x=84, scale=v2, version=2, eyes="happy", mouth="grin",
               left=Arm("tool", (-60, -54)), right=Arm("strong", (66, -152), elbow=(86, -104))).svg()
    s4 += task_stack(204, "vvvx", "same tasks")
    s4 += sparkle(36, 96, 7) + sparkle(160, 60, 5) + sparkle(172, 96, 4)
    s4 += meter(0.62)

    # 05 A later swap goes wrong: the robot wobbles, the error is caught and written down.
    s5 = Robot(x=112, scale=v2, version=2, eyes="dizzy", mouth="open", tilt=-9, spring_leg=True,
               left=Arm("tool", (-64, -40)), right=Arm("strong", (72, -56))).svg()
    s5 += spark(134, GROUND - 22, 12)
    s5 += text(170, GROUND - 40, "bad part", 10.5, WARM, "start", weight=600)
    s5 += note(222, 104, "error", angle=-6)
    s5 += arrow("M188 150 C200 140 210 132 222 128", WARM)
    s5 += text(252, 168, "caught and", 10.5, MUTED)
    s5 += text(252, 182, "kept as feedback", 10.5, MUTED)
    s5 += meter(0.42)

    # 06 It upgrades the tools that upgrade it: sharper glasses, parallel tool arms, armour.
    s6 = Robot(x=150, scale=v3, version=3, eyes="open", look=(0, 0), mouth="smile", glasses="goggles",
               backpack=True, left=Arm("strong", (-70, -60)), right=Arm("strong", (70, -60))).svg()
    s6 += text(42, 76, "sharper glasses:", 9.5, ACCENT, weight=600)
    s6 += text(42, 89, "full error traces", 9.5, ACCENT, weight=600)
    s6 += arrow("M70 96 C84 108 96 112 112 112", ACCENT)
    s6 += text(262, 70, "two tool arms:", 9.5, ACCENT, weight=600)
    s6 += text(262, 83, "parallel edits", 9.5, ACCENT, weight=600)
    s6 += arrow("M234 78 C222 74 214 72 206 72", ACCENT)
    s6 += loop_mark(270, 144, "01")
    s6 += text(270, 182, "and again", 10.5, ACCENT)
    s6 += meter(0.86)
    return [
        ("godel-robot-1", "Try the tasks", s1),
        ("godel-robot-2", "See its own parts", s2),
        ("godel-robot-3", "Swap in a stronger arm", s3),
        ("godel-robot-4", "Get stronger", s4),
        ("godel-robot-5", "Survive a bad part", s5),
        ("godel-robot-6", "Upgrade the upgrader", s6),
    ]


def main() -> None:
    for stem, title, body in scenes():
        (OUT / f"{stem}.svg").write_text(panel(int(stem[-1]), title, body))
    print(f"Wrote {len(scenes())} panels to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

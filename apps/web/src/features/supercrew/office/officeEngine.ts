// pixel office drawn for the super crew card. the world is 162 x 90 pixels and the
// canvas is scaled up with image-rendering: pixelated. the room is pulled into dark
// greys (mapEnv), people, screens and lights keep their own colors.

export const OFFICE_W = 162
export const OFFICE_H = 90

export type Role = 'plan' | 'backend' | 'frontend' | 'review' | 'ops' | 'dog'

export interface OfficeLabel {
    role: Role
    x: number
    y: number
    below: boolean
}

type Dir = 'up' | 'down' | 'left' | 'right'
type Mode = 'stand' | 'seatDown' | 'seatUp'
type Paint = (x: number, y: number, w: number, h: number, c: string) => void
type Emit = (fn: () => void) => void

interface Person {
    skin: string
    skinSh: string
    hair: string
    style: 'short' | 'long' | 'bun' | 'curly' | 'cap'
    shirt: string
    shirt2: string
    pants: string
    acc?: 'clipboard' | 'headphones' | 'glasses'
    cap?: string
    cap2?: string
}

interface Waypoint {
    x: number
    y: number
    wait?: number
    dir?: Dir
    emote?: Icon
    seat?: boolean
    sleep?: boolean
}

interface MoverState {
    x: number
    y: number
    dir: Dir
    walking: boolean
    k: number
    emote?: Icon
    seat?: boolean
    sleep?: boolean
}

interface Bubble {
    x: number
    y: number
    icon: Icon
}

type Icon = 'check' | 'bug' | 'coffee' | 'heart' | 'note' | 'bang' | 'zz' | 'bulb' | 'ticket'

export const ROLE_NAME: Record<Role, string> = {
    plan: 'planner',
    backend: 'backend',
    frontend: 'frontend',
    review: 'reviewer',
    ops: 'ops',
    dog: 'biscuit',
}

const C = {
    wallFace: '#d3c6b1',
    wallCap: '#4a3f36',
    trim: '#9a8a74',
    wood: '#b98c60',
    woodLn: '#a87d53',
    woodSeam: '#97704a',
    tile: '#e4dfd5',
    tile2: '#d3cdc1',
    deskTop: '#ece7dd',
    deskLine: '#d2cbbd',
    deskFace: '#a99f8f',
    deskLeg: '#6e665a',
    monFrame: '#2b2e36',
    monBack: '#3c404a',
    scr: '#0d1117',
    chair: '#3a4560',
    chairHi: '#4f5c7d',
    pot: '#c46f4a',
    pot2: '#a35a3a',
    leaf: '#4c9a5b',
    leaf2: '#3a7d47',
    leaf3: '#6cbf78',
    shoe: '#2a2320',
    eye: '#231a16',
    shadow: 'rgba(0,0,0,0.22)',
}

const CREW: Record<Exclude<Role, 'dog'>, Person> = {
    plan: {
        skin: '#f1c7a0',
        skinSh: '#d9a67c',
        hair: '#5a3a22',
        style: 'bun',
        shirt: '#e8b05c',
        shirt2: '#c48f3f',
        pants: '#3b4256',
        acc: 'clipboard',
    },
    backend: {
        skin: '#8d5a3b',
        skinSh: '#74462c',
        hair: '#1b1512',
        style: 'short',
        shirt: '#3f9c6e',
        shirt2: '#2f7a55',
        pants: '#2b2f3a',
        acc: 'headphones',
    },
    frontend: {
        skin: '#f3d2b5',
        skinSh: '#dcb08e',
        hair: '#c4683a',
        style: 'long',
        shirt: '#4f7fd1',
        shirt2: '#3d66ad',
        pants: '#2e3445',
    },
    review: {
        skin: '#c99673',
        skinSh: '#ad7b59',
        hair: '#2a1d14',
        style: 'curly',
        shirt: '#8b6cc7',
        shirt2: '#6f53a5',
        pants: '#33304a',
        acc: 'glasses',
    },
    ops: {
        skin: '#e0b48f',
        skinSh: '#c4946e',
        hair: '#6b5a4a',
        style: 'cap',
        cap: '#c75a5a',
        cap2: '#a34646',
        shirt: '#5a5f6c',
        shirt2: '#464a55',
        pants: '#2b3040',
    },
}

const ICONS: Record<Icon, { c: string; p: string[] }> = {
    check: { c: '#2f9e5f', p: ['.....', '....X', '...X.', 'X.X..', '.X...'] },
    bug: { c: '#d9534f', p: ['X...X', '.XXX.', 'XXXXX', '.XXX.', 'X...X'] },
    coffee: { c: '#8a5a35', p: ['.X.X.', '.....', 'XXXX.', 'XXX.X', 'XXXX.'] },
    heart: { c: '#e0607e', p: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'] },
    note: { c: '#3d66ad', p: ['..XXX', '..X.X', '..X.X', 'XXX..', 'XX...'] },
    bang: { c: '#d9932f', p: ['..X..', '..X..', '..X..', '.....', '..X..'] },
    zz: { c: '#5b7fc4', p: ['XXXX.', '..X..', '.X...', 'XXXX.', '.....'] },
    bulb: { c: '#e0b23a', p: ['.XXX.', 'XXXXX', 'XXXXX', '.XXX.', '.X.X.'] },
    ticket: { c: '#d9932f', p: ['XXXXX', 'X...X', 'X.X.X', 'X...X', 'XXXXX'] },
}

const SCHEDULE: Partial<Record<Role, [number, [number, number, Icon][]]>> = {
    backend: [
        10,
        [
            [2, 1.6, 'bug'],
            [6.5, 1.6, 'check'],
        ],
    ],
    frontend: [
        12,
        [
            [4, 1.6, 'note'],
            [9, 1.4, 'heart'],
        ],
    ],
    review: [
        11,
        [
            [1, 1.6, 'check'],
            [6, 1.4, 'bang'],
        ],
    ],
    ops: [9, [[3, 1.4, 'coffee']]],
}

// colors that stay as they are in the dark palette (lights, screens, the december sign)
const KEEP = new Set([
    '#87b2f4',
    '#4ade80',
    '#f0b85c',
    '#1f2a20',
    '#e58fa3',
    '#0b0f1a',
    '#0e1424',
    '#ffe2a8',
    '#e57373',
])

const hash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return x - Math.floor(x)
}

const hslHex = (h: number, s: number, l: number) => {
    const f = (n: number) => {
        const k = (n + h * 12) % 12
        const a = s * Math.min(l, 1 - l)
        const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
        return Math.round(c * 255)
            .toString(16)
            .padStart(2, '0')
    }
    return '#' + f(0) + f(8) + f(4)
}

const envCache = new Map<string, string>()

// dark office palette: keep a hint of the hue, compress lightness into december greys
export const mapEnv = (c: string) => {
    if (c[0] !== '#' || KEEP.has(c)) return c
    const hit = envCache.get(c)
    if (hit) return hit
    const n = parseInt(c.slice(1), 16)
    const r = ((n >> 16) & 255) / 255
    const g = ((n >> 8) & 255) / 255
    const b = (n & 255) / 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const l = (mx + mn) / 2
    let h = 0
    let s = 0
    if (mx !== mn) {
        const d = mx - mn
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
        if (mx === r) h = (g - b) / d + (g < b ? 6 : 0)
        else if (mx === g) h = (b - r) / d + 2
        else h = (r - g) / d + 4
        h /= 6
    }
    const out = hslHex(h, s * 0.3, 0.06 + l * 0.24)
    envCache.set(c, out)
    return out
}

function mover(points: Waypoint[], speed: number) {
    type Seg =
        | { kind: 'wait'; p: Waypoint; t0: number; d: number }
        | { kind: 'move'; a: Waypoint; b: Waypoint; t0: number; d: number }
    const segs: Seg[] = []
    let total = 0
    points.forEach((a, i) => {
        const b = points[(i + 1) % points.length]
        if (a.wait) {
            segs.push({ kind: 'wait', p: a, t0: total, d: a.wait })
            total += a.wait
        }
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (len > 0) {
            const d = len / speed
            segs.push({ kind: 'move', a, b, t0: total, d })
            total += d
        }
    })
    return (sec: number): MoverState => {
        const tt = sec % total
        for (const s of segs) {
            if (tt >= s.t0 + s.d) continue
            const k = (tt - s.t0) / s.d
            if (s.kind === 'wait') {
                return {
                    x: s.p.x,
                    y: s.p.y,
                    dir: s.p.dir ?? 'down',
                    walking: false,
                    k,
                    emote: s.p.emote,
                    seat: s.p.seat,
                    sleep: s.p.sleep,
                }
            }
            const dx = s.b.x - s.a.x
            const dy = s.b.y - s.a.y
            let dir: Dir
            if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left'
            else dir = dy > 0 ? 'down' : 'up'
            return {
                x: Math.round(s.a.x + dx * k),
                y: Math.round(s.a.y + dy * k),
                dir,
                walking: true,
                k,
            }
        }
        return { x: points[0].x, y: points[0].y, dir: 'down', walking: false, k: 0 }
    }
}

const PLAN = mover(
    [
        { x: 16, y: 24, dir: 'up', wait: 2.8, emote: 'bulb' },
        { x: 16, y: 52 },
        { x: 45, y: 56, dir: 'up', wait: 1.8, emote: 'ticket' },
        { x: 67, y: 56, dir: 'up', wait: 1.8, emote: 'ticket' },
        { x: 94, y: 56 },
        { x: 94, y: 30, dir: 'left', wait: 1.8, emote: 'ticket' },
        { x: 94, y: 56 },
        { x: 30, y: 54 },
        { x: 16, y: 40 },
    ],
    24
)

const OPS = mover(
    [
        { x: 48, y: 30, dir: 'down', wait: 6, seat: true },
        { x: 38, y: 30 },
        { x: 38, y: 58 },
        { x: 100, y: 58 },
        { x: 100, y: 25 },
        { x: 136, y: 25, dir: 'up', wait: 2.6, emote: 'check' },
        { x: 100, y: 25 },
        { x: 100, y: 63 },
        { x: 120, y: 63, dir: 'up', wait: 2.6, emote: 'coffee' },
        { x: 100, y: 63 },
        { x: 100, y: 58 },
        { x: 38, y: 58 },
        { x: 38, y: 30 },
    ],
    20
)

const DOG = mover(
    [
        { x: 13, y: 81, wait: 6, sleep: true, emote: 'zz' },
        { x: 30, y: 64 },
        { x: 42, y: 62, dir: 'right', wait: 2.6, emote: 'heart' },
        { x: 100, y: 64 },
        { x: 104, y: 84 },
        { x: 132, y: 87, dir: 'right', wait: 3 },
        { x: 104, y: 88 },
        { x: 40, y: 88 },
    ],
    15
)

const seatedEmote = (role: Role, sec: number): Icon | null => {
    const s = SCHEDULE[role]
    if (!s) return null
    const m = sec % s[0]
    for (const [start, dur, icon] of s[1]) if (m >= start && m < start + dur) return icon
    return null
}

// x = left column of the 6-wide head, y = feet row
function person(
    r: Paint,
    x: number,
    y: number,
    p: Person,
    dir: Dir,
    step: number,
    t: number,
    mode: Mode,
    seed: number
) {
    const blink = (t / 1000 + seed) % 3.4 < 0.13
    const side = dir === 'left' || dir === 'right'
    const R: Paint = (dx, dy, w, h, c) =>
        r(side && dir === 'left' ? x + (6 - dx - w) : x + dx, y + dy, w, h, c)
    const standing = mode === 'stand'
    const h = p.hair
    if (standing) r(x - 1, y, 8, 1, C.shadow)
    if (standing && !side) {
        const lA = step === 1 ? 1 : 0
        const lB = step === 3 ? 1 : 0
        R(1, -2, 2, 2 - lA, p.pants)
        R(1, -1 - lA, 2, 1, C.shoe)
        R(3, -2, 2, 2 - lB, p.pants)
        R(3, -1 - lB, 2, 1, C.shoe)
    } else if (standing) {
        let a = 0
        if (step === 1) a = -1
        else if (step === 3) a = 1
        R(2 - a, -2, 2, 2, p.pants)
        R(2 - a, -1, 2, 1, C.shoe)
        R(2 + a, -2, 2, 2, p.pants)
        R(2 + a, -1, 2, 1, C.shoe)
    }
    if (!side) {
        R(0, -6, 6, 4, p.shirt)
        R(0, -3, 6, 1, p.shirt2)
        if (standing) {
            R(-1, -6, 1, 3, p.shirt2)
            R(-1, -3 + (step === 1 ? -1 : 0), 1, 1, p.skin)
            R(6, -6, 1, 3, p.shirt2)
            R(6, -3 + (step === 3 ? -1 : 0), 1, 1, p.skin)
            if (p.acc === 'clipboard' && dir === 'down') {
                R(5, -5, 3, 4, '#a87b53')
                R(6, -4, 1, 2, '#f3f0e6')
            }
        } else if (mode === 'seatUp') {
            const bob = Math.floor((t + seed * 1000) / 140) % 2
            R(-1, -6 + bob, 1, 2, p.shirt2)
            R(6, -6 + (1 - bob), 1, 2, p.shirt2)
        } else {
            R(-1, -6, 1, 2, p.shirt2)
            R(6, -6, 1, 2, p.shirt2)
        }
    } else {
        R(1, -6, 4, 4, p.shirt)
        R(1, -3, 4, 1, p.shirt2)
        let sw = 0
        if (step === 1) sw = 1
        else if (step === 3) sw = -1
        R(2 + sw, -6, 2, 3, p.shirt2)
        R(2 + sw, -3, 1, 1, p.skin)
        if (p.acc === 'clipboard') {
            R(4, -5, 2, 3, '#a87b53')
            R(4, -5, 2, 1, '#f3f0e6')
        }
    }
    R(0, -12, 6, 6, p.skin)
    if (dir === 'down') {
        if (p.style === 'curly') {
            R(-1, -13, 8, 3, h)
            R(-1, -10, 1, 2, h)
            R(6, -10, 1, 2, h)
            R(1, -13, 1, 1, '#4a3526')
            R(4, -12, 1, 1, '#4a3526')
        } else if (p.style === 'cap') {
            R(0, -12, 6, 2, p.cap ?? h)
            R(-1, -10, 8, 1, p.cap2 ?? h)
            R(0, -9, 1, 1, h)
            R(5, -9, 1, 1, h)
        } else {
            R(0, -12, 6, 2, h)
            R(0, -10, 1, 1, h)
            R(5, -10, 1, 1, h)
            if (p.style === 'long') {
                R(0, -10, 1, 6, h)
                R(5, -10, 1, 6, h)
                R(-1, -9, 1, 4, h)
                R(6, -9, 1, 4, h)
            }
            if (p.style === 'bun') {
                R(2, -14, 2, 2, h)
                R(1, -13, 4, 1, h)
            }
        }
        if (p.acc === 'glasses') {
            R(0, -9, 6, 1, '#2a2a2a')
            R(1, -9, 1, 1, '#bcd4f0')
            R(4, -9, 1, 1, '#bcd4f0')
        } else {
            const eye = blink ? p.skinSh : C.eye
            R(1, -9, 1, 1, eye)
            R(4, -9, 1, 1, eye)
        }
        R(2, -7, 2, 1, p.skinSh)
        if (p.acc === 'headphones') {
            R(0, -13, 6, 1, '#22252c')
            R(-1, -12, 1, 2, '#22252c')
            R(6, -12, 1, 2, '#22252c')
            R(-1, -10, 1, 3, '#e57373')
            R(6, -10, 1, 3, '#e57373')
        }
    } else if (dir === 'up') {
        if (p.style === 'curly') R(-1, -13, 8, 7, h)
        else if (p.style === 'cap') {
            R(0, -12, 6, 6, h)
            R(0, -12, 6, 3, p.cap ?? h)
            R(2, -10, 2, 1, p.cap2 ?? h)
        } else {
            R(0, -12, 6, 6, h)
            if (p.style === 'bun') {
                R(2, -14, 2, 2, h)
                R(1, -13, 4, 1, h)
            }
        }
        if (p.acc === 'headphones') {
            R(0, -13, 6, 1, '#22252c')
            R(-1, -11, 1, 3, '#e57373')
            R(6, -11, 1, 3, '#e57373')
        }
        if (p.style === 'long') R(0, -6, 6, 2, h)
    } else {
        if (p.style === 'curly') {
            R(-1, -13, 7, 3, h)
            R(-1, -10, 3, 3, h)
        } else if (p.style === 'cap') {
            R(0, -12, 6, 2, p.cap ?? h)
            R(4, -10, 3, 1, p.cap2 ?? h)
            R(0, -10, 2, 2, h)
        } else {
            R(0, -12, 6, 2, h)
            R(0, -10, 2, 3, h)
            if (p.style === 'long') R(0, -10, 2, 6, h)
            if (p.style === 'bun') R(-1, -13, 2, 2, h)
        }
        if (p.acc === 'glasses') {
            R(3, -9, 3, 1, '#2a2a2a')
            R(4, -9, 1, 1, '#bcd4f0')
        } else if (!blink) R(4, -9, 1, 1, C.eye)
        R(4, -7, 1, 1, p.skinSh)
        if (p.acc === 'headphones') {
            R(0, -13, 6, 1, '#22252c')
            R(1, -10, 2, 3, '#e57373')
        }
    }
}

function dog(
    r: Paint,
    x: number,
    y: number,
    dir: Dir,
    walking: boolean,
    sleep: boolean,
    t: number
) {
    const body = '#b07a45'
    const dark = '#7a4f2a'
    const flip = dir === 'left'
    const R: Paint = (dx, dy, w, h, c) => r(flip ? x + (10 - dx - w) : x + dx, y + dy, w, h, c)
    r(x, y, 10, 1, C.shadow)
    if (sleep) {
        R(1, -3, 7, 3, body)
        R(6, -4, 3, 3, body)
        R(6, -5, 1, 1, dark)
        R(1, -1, 7, 1, dark)
        R(0, -2, 2, 1, body)
        R(8, -3, 1, 1, '#2a1f18')
        return
    }
    const f = walking ? Math.floor(t / 110) % 2 : 0
    R(1, -5, 6, 3, body)
    R(2, -3, 4, 1, dark)
    R(6, -7, 3, 3, body)
    R(6, -8, 1, 2, dark)
    R(9, -6, 1, 1, '#2a1f18')
    R(8, -7, 1, 1, '#2a1f18')
    R(6, -5, 1, 2, '#c75a5a')
    ;(f ? [2, 4, 6] : [1, 3, 5, 7]).forEach((dx) => R(dx, -2, 1, 2, dark))
    R(0, -6 + (Math.floor(t / 150) % 2), 1, 2, body)
}

// dark speech bubble to match the card
function bubble(r: Paint, x: number, y: number, icon: Icon) {
    const ic = ICONS[icon]
    const edge = '#3a3a3a'
    const fill = '#1e1e1e'
    r(x + 1, y, 9, 1, edge)
    r(x, y + 1, 11, 8, edge)
    r(x + 1, y + 9, 9, 1, edge)
    r(x + 3, y + 10, 3, 1, edge)
    r(x + 3, y + 11, 2, 1, edge)
    r(x + 2, y + 1, 7, 1, fill)
    r(x + 1, y + 2, 9, 6, fill)
    r(x + 2, y + 8, 7, 1, fill)
    r(x + 4, y + 9, 1, 1, fill)
    ic.p.forEach((row, ry) =>
        [...row].forEach((ch, rx) => {
            if (ch === 'X') r(x + 3 + rx, y + 2 + ry, 1, 1, ic.c)
        })
    )
}

function screenContent(r: Paint, role: Role, sx: number, sy: number, t: number) {
    if (role === 'backend') {
        const off = Math.floor(t / 380)
        for (let i = 0; i < 3; i++)
            r(sx, sy + i * 2, 2 + Math.floor(hash(i + off) * 6), 1, i === 2 ? '#86efac' : '#3fbf6f')
        return
    }
    if (role === 'frontend') {
        r(sx, sy, 8, 1, '#4f7fd1')
        const n = Math.floor(t / 520) % 5
        const blocks: [number, number, number, number, string][] = [
            [0, 2, 3, 2, '#f0b85c'],
            [4, 2, 4, 1, '#d6d5d4'],
            [4, 3, 4, 1, '#87b2f4'],
            [0, 4, 6, 1, '#6b7280'],
        ]
        blocks.slice(0, n).forEach((b) => r(sx + b[0], sy + b[1], b[2], b[3], b[4]))
        return
    }
    const off = Math.floor(t / 900)
    for (let i = 0; i < 3; i++)
        r(
            sx,
            sy + i * 2,
            3 + Math.floor(hash(i + 7 + off) * 5),
            1,
            hash(i + off * 3) > 0.5 ? '#e57373' : '#4ade80'
        )
}

// ---------- room props ----------

function floorWood(r: Paint, x: number, y: number, w: number, h: number) {
    r(x, y, w, h, C.wood)
    for (let yy = y + 3; yy < y + h; yy += 4) r(x, yy, w, 1, C.woodLn)
    for (let k = 0; k * 4 < h; k++)
        for (let xx = x + (k % 2) * 8; xx < x + w; xx += 16) r(xx, y + k * 4, 1, 3, C.woodSeam)
}

function floorTile(r: Paint, x: number, y: number, w: number, h: number) {
    r(x, y, w, h, C.tile)
    for (let yy = y; yy < y + h; yy += 4)
        for (let xx = x; xx < x + w; xx += 4)
            if (((xx - x) / 4 + (yy - y) / 4) % 2 === 0) r(xx, yy, 4, 4, C.tile2)
}

function rug(r: Paint, x: number, y: number, w: number, h: number) {
    r(x, y, w, h, '#e0cfa2')
    r(x + 1, y + 1, w - 2, h - 2, '#a2493f')
    r(x + 3, y + 3, w - 6, h - 6, '#b85a4c')
    for (let k = 0; y + 5 + k * 5 < y + h - 4; k++) r(x + 4, y + 5 + k * 5, w - 8, 1, '#c97a5c')
}

function windowPane(r: Paint, x: number, w: number, t: number) {
    r(x, 3, w, 7, C.trim)
    r(x + 1, 4, w - 2, 5, '#a6d6f2')
    r(x + 1, 4, w - 2, 2, '#c8e7f8')
    const cx = x + 1 + Math.floor((t / 260 + x * 3) % (w + 8)) - 6
    for (const [dx, dy, ww] of [
        [1, 5, 4],
        [0, 6, 6],
    ]) {
        const a = Math.max(x + 1, cx + dx)
        const b = Math.min(x + w - 1, cx + dx + ww)
        if (b > a) r(a, dy, b - a, 1, '#ffffff')
    }
    r(x + Math.floor(w / 2), 4, 1, 5, C.trim)
}

function lightPatch(ctx: CanvasRenderingContext2D, x: number, w: number) {
    ctx.fillStyle = 'rgba(255,242,208,0.14)'
    ctx.beginPath()
    ctx.moveTo(x, 13)
    ctx.lineTo(x + w, 13)
    ctx.lineTo(x + w + 9, 32)
    ctx.lineTo(x + 9, 32)
    ctx.closePath()
    ctx.fill()
}

function whiteboard(r: Paint, x: number, w: number, t: number) {
    r(x, 3, w, 8, '#6e665a')
    r(x + 1, 4, w - 2, 6, '#f6f6f2')
    r(x + 2, 10, w - 4, 1, '#9a9284')
    const cols = ['#f2cf5b', '#f29bb2', '#9cc2f7', '#8fdcae']
    const n = 3 + (Math.floor(t / 1100) % 6)
    for (let i = 0; i < n; i++) r(x + 2 + (i % 6) * 4, 5 + Math.floor(i / 6) * 3, 3, 2, cols[i % 4])
    r(x + w - 6, 8, 3, 1, '#3d66ad')
}

function sign(r: Paint, emit: Emit, x: number) {
    r(x, 3, 9, 8, '#1f2230')
    emit(() => {
        const c = '#87b2f4'
        for (let i = 0; i < 7; i++) {
            r(x + 1 + i, 7, 1, 1, c)
            r(x + 4, 4 + i, 1, 1, c)
        }
        for (const [a, b] of [
            [1, 1],
            [2, 2],
            [4, 4],
            [5, 5],
            [5, 1],
            [4, 2],
            [2, 4],
            [1, 5],
        ])
            r(x + 1 + a, 4 + b, 1, 1, c)
    })
}

function clock(r: Paint, x: number, t: number) {
    r(x, 4, 5, 5, '#3a3d46')
    r(x + 1, 5, 3, 3, '#f6f6f2')
    r(x + 2, 5, 1, 2, '#222222')
    r(Math.floor(t / 2000) % 2 ? x + 3 : x + 1, 6, 1, 1, '#d9534f')
}

function shelf(r: Paint, x: number, y: number, w: number, h: number) {
    r(x, y, w, h, '#7a5636')
    r(x + 1, y + 1, w - 2, h - 2, '#4f3622')
    const books = ['#c75a5a', '#4f7fd1', '#e8b05c', '#3f9c6e', '#8b6cc7', '#e0cfa2']
    for (let s = 0; s < Math.floor((h - 2) / 5); s++) {
        const sy = y + 1 + s * 5
        r(x + 1, sy + 4, w - 2, 1, '#7a5636')
        let bx = x + 1
        let k = 0
        while (bx < x + w - 2) {
            const bw = 1 + Math.floor(hash(s * 13 + k) * 2)
            const bh = 3 + Math.floor(hash(s * 7 + k + 3) * 2)
            if (hash(k + s * 5) > 0.15) r(bx, sy + 4 - bh, bw, bh, books[(k + s) % books.length])
            bx += bw
            k++
        }
    }
    r(x, y + h, w, 2, '#5f4329')
}

function rack(r: Paint, emit: Emit, x: number, y: number, w: number, h: number, t: number) {
    r(x, y, w, h, '#262a33')
    r(x, y, w, 1, '#3d424e')
    r(x, y + h, w, 1, 'rgba(0,0,0,0.25)')
    for (let k = 0; k < Math.floor((h - 2) / 3); k++) {
        r(x + 1, y + 2 + k * 3, w - 2, 2, '#30353f')
        emit(() => {
            const on = (Math.floor(t / 170) + k * 3 + x) % 7
            r(x + 2, y + 2 + k * 3, 1, 1, on === 0 ? '#f0b85c' : '#4ade80')
            r(x + 4, y + 2 + k * 3, 1, 1, on % 3 ? '#4ade80' : '#1f2a20')
        })
    }
}

function plant(r: Paint, x: number, y: number, big: boolean) {
    r(x, y, 7, 1, C.shadow)
    r(x + 1, y - 4, 5, 4, C.pot)
    r(x + 1, y - 4, 5, 1, C.pot2)
    if (big) {
        r(x, y - 11, 7, 7, C.leaf2)
        r(x + 1, y - 14, 5, 4, C.leaf)
        r(x - 1, y - 9, 2, 3, C.leaf)
        r(x + 6, y - 10, 2, 3, C.leaf)
        r(x + 2, y - 13, 2, 1, C.leaf3)
        r(x + 4, y - 8, 1, 1, C.leaf3)
        r(x + 1, y - 7, 1, 1, C.leaf3)
        return
    }
    r(x + 1, y - 8, 5, 4, C.leaf2)
    r(x + 2, y - 9, 3, 2, C.leaf)
    r(x + 3, y - 8, 1, 1, C.leaf3)
}

function couch(r: Paint, x: number, y: number, w: number) {
    const c = '#3f7f8a'
    const c2 = '#2f6570'
    r(x - 1, y + 1, w + 2, 7, c2)
    r(x, y, w, 3, c2)
    r(x, y + 3, w, 4, c)
    for (let k = 1; k < 3; k++) r(x + Math.floor((w * k) / 3), y + 3, 1, 4, c2)
    r(x - 1, y + 8, w + 2, 1, C.shadow)
    r(x + 2, y + 1, 3, 1, 'rgba(255,255,255,0.18)')
}

function beanbag(r: Paint, x: number, y: number) {
    const c = '#e8b05c'
    r(x + 1, y, 5, 1, c)
    r(x, y + 1, 7, 4, c)
    r(x + 1, y + 5, 5, 1, c)
    r(x + 2, y + 1, 2, 1, 'rgba(255,255,255,0.3)')
    r(x, y + 6, 7, 1, C.shadow)
}

function coffeeTable(r: Paint, x: number, y: number, w: number, h: number) {
    r(x, y, w, h, '#8a6a4a')
    r(x, y + h, w, 1, '#5f4329')
    r(x + 2, y + 1, 2, 2, '#f6f6f2')
    r(x + 5, y + 1, 3, 2, '#c75a5a')
}

function floorLamp(r: Paint, emit: Emit, x: number, y: number) {
    r(x + 1, y, 3, 1, '#3a3d46')
    r(x + 2, y - 12, 1, 12, '#3a3d46')
    r(x, y - 15, 5, 3, '#eadcb2')
    emit(() => r(x + 1, y - 12, 3, 1, '#ffe2a8'))
}

function arcade(r: Paint, emit: Emit, x: number, y: number, t: number) {
    r(x, y, 8, 16, '#2b2140')
    r(x, y + 2, 1, 12, '#e58fa3')
    r(x + 7, y + 2, 1, 12, '#e58fa3')
    emit(() => {
        r(x + 1, y + 1, 6, 2, '#f0b85c')
        r(x + 1, y + 3, 6, 5, '#0b0f1a')
        r(x + 1 + (Math.floor(t / 150) % 6), y + 6, 1, 1, '#4ade80')
        r(x + 2 + (Math.floor(t / 230) % 5), y + 4, 1, 1, '#e58fa3')
    })
    r(x, y + 8, 8, 2, '#3b2d5a')
    r(x + 2, y + 8, 1, 1, '#e57373')
    r(x + 5, y + 8, 1, 1, '#87b2f4')
    r(x, y + 16, 8, 1, C.shadow)
}

function pingPong(r: Paint, x: number, y: number, w: number, h: number) {
    const line = '#eef2ee'
    r(x + 2, y + h, 1, 2, '#2b2e36')
    r(x + w - 3, y + h, 1, 2, '#2b2e36')
    r(x, y + h + 2, w, 1, C.shadow)
    r(x, y, w, h, '#2f7d5b')
    r(x, y, w, 1, line)
    r(x, y + h - 1, w, 1, line)
    r(x, y, 1, h, line)
    r(x + w - 1, y, 1, h, line)
    r(x, y + Math.floor(h / 2), w, 1, 'rgba(255,255,255,0.45)')
    r(x, y + h, w, 1, '#235e45')
    r(x + Math.floor(w / 2), y - 1, 1, h + 1, '#f6f6f2')
    r(x + 4, y + 3, 2, 2, '#c75a5a')
    r(x + w - 7, y + h - 5, 2, 2, '#222222')
    r(x + 10, y + 4, 1, 1, '#f6a03a')
}

function counter(r: Paint, x: number, y: number, w: number) {
    r(x, y, w, 4, '#ece7dd')
    r(x, y + 4, w, 1, '#d2cbbd')
    r(x, y + 5, w, 5, '#8a6a4a')
    for (let k = 0; k < w; k += 6) {
        r(x + k, y + 5, 1, 5, '#6f5238')
        r(x + k + 3, y + 6, 1, 1, '#d6d5d4')
    }
    r(x, y + 10, w, 1, C.shadow)
}

function coffeeMachine(r: Paint, emit: Emit, x: number, y: number, t: number, active: boolean) {
    r(x, y, 6, 7, '#2b2e36')
    r(x + 1, y + 1, 4, 2, '#3d414b')
    emit(() => r(x + 4, y + 1, 1, 1, active ? '#4ade80' : '#e57373'))
    r(x + 2, y + 4, 2, 1, '#111111')
    r(x + 2, y + 5, 2, 2, '#f6f6f2')
    if (active)
        r(
            x + 2 + (Math.floor(t / 200) % 2),
            y - 2 - (Math.floor(t / 150) % 2),
            1,
            1,
            'rgba(255,255,255,0.75)'
        )
}

function sink(r: Paint, x: number, y: number) {
    r(x, y + 1, 6, 2, '#aeb6bf')
    r(x + 1, y + 1, 4, 1, '#8f99a3')
    r(x + 2, y - 1, 1, 2, '#8a939c')
}

function fridge(r: Paint, x: number, y: number, w: number, h: number) {
    const split = Math.floor(h * 0.38)
    r(x, y, w, h, '#dfe3e8')
    r(x, y, w, 1, '#f4f6f8')
    r(x, y + split, w, 1, '#b8bec6')
    r(x + w - 2, y + 2, 1, 3, '#8a939c')
    r(x + w - 2, y + split + 2, 1, 4, '#8a939c')
    r(x + 1, y + 3, 1, 1, '#e58fa3')
    r(x + 2, y + 5, 1, 1, '#87b2f4')
    r(x + 1, y + split + 3, 2, 2, '#f2cf5b')
    r(x, y + h, w, 1, C.shadow)
}

function roundTable(r: Paint, cx: number, cy: number) {
    r(cx - 10, cy, 3, 3, '#c46f4a')
    r(cx + 7, cy, 3, 3, '#c46f4a')
    r(cx - 4, cy - 3, 8, 1, '#ece7dd')
    r(cx - 5, cy - 2, 10, 4, '#ece7dd')
    r(cx - 4, cy + 2, 8, 1, '#d2cbbd')
    r(cx, cy + 3, 1, 2, '#6e665a')
    r(cx - 2, cy - 1, 2, 2, '#c75a5a')
    r(cx + 1, cy - 2, 2, 2, C.leaf)
    r(cx - 4, cy + 5, 9, 1, C.shadow)
}

function waterCooler(r: Paint, x: number, y: number) {
    r(x, y + 5, 5, 7, '#d6d9de')
    r(x, y + 5, 5, 1, '#eef0f3')
    r(x + 1, y, 3, 5, '#7fb6e8')
    r(x + 1, y, 3, 1, '#a9d0f2')
    r(x + 1, y + 7, 1, 1, '#3a6fd8')
    r(x + 3, y + 7, 1, 1, '#e57373')
    r(x, y + 12, 5, 1, C.shadow)
}

// desk pod: row 1 sits behind the desk (faces visible), row 2 in front (screens visible)
function deskPod(
    r: Paint,
    rc: Paint,
    emit: Emit,
    t: number,
    sec: number,
    opsSeated: boolean,
    labels: OfficeLabel[],
    bubbles: Bubble[]
) {
    const px = 44
    const py = 26
    const w = 44
    const row1: { role: Exclude<Role, 'dog'>; x: number; here: boolean }[] = [
        { role: 'ops', x: 48, here: opsSeated },
        { role: 'review', x: 70, here: true },
    ]
    const row2: { role: Exclude<Role, 'dog'>; x: number }[] = [
        { role: 'backend', x: 48 },
        { role: 'frontend', x: 70 },
    ]
    for (const s of row1) {
        r(s.x - 1, py - 6, 8, 6, C.chair)
        r(s.x - 1, py - 6, 8, 1, C.chairHi)
        if (!s.here) continue
        person(rc, s.x, py + 4, CREW[s.role], 'down', 0, t, 'seatDown', s.x / 10)
        labels.push({ role: s.role, x: s.x + 3, y: py - 9, below: false })
        const em = seatedEmote(s.role, sec)
        if (em) bubbles.push({ x: s.x - 2, y: py - 22, icon: em })
    }
    r(px, py, w, 10, C.deskTop)
    r(px, py + 5, w, 1, C.deskLine)
    r(px, py + 10, w, 2, C.deskFace)
    r(px + 1, py + 12, 1, 2, C.deskLeg)
    r(px + w - 2, py + 12, 1, 2, C.deskLeg)
    r(px, py + 14, w, 1, C.shadow)
    r(px + w - 5, py + 1, 3, 3, C.leaf)
    r(px + w - 4, py + 3, 2, 2, C.pot)
    r(px + 2, py + 6, 3, 2, '#f6f6f2')
    for (const s of row1) {
        if (s.here) {
            const bob = Math.floor((t + s.x * 37) / 140) % 2
            rc(s.x + 1, py + bob, 1, 1, CREW[s.role].skin)
            rc(s.x + 4, py + 1 - bob, 1, 1, CREW[s.role].skin)
        } else {
            r(s.x + 1, py + 1, 3, 2, '#f6f6f2')
        }
        r(s.x + 7, py - 3, 6, 4, C.monBack)
        r(s.x + 7, py - 3, 6, 1, '#4f5460')
        r(s.x + 9, py + 1, 2, 1, C.monFrame)
    }
    row2.forEach((s, i) => {
        const sx = s.x - 2
        r(sx, py + 1, 10, 7, C.monFrame)
        r(sx + 4, py + 8, 2, 1, C.monFrame)
        emit(() => {
            rc(sx + 1, py + 2, 8, 5, C.scr)
            screenContent(rc, s.role, sx + 1, py + 2, t + s.x * 50)
        })
        person(rc, s.x, py + 20, CREW[s.role], 'up', 0, t, 'seatUp', s.x / 9)
        r(s.x - 1, py + 16, 8, 4, C.chair)
        r(s.x - 1, py + 16, 8, 1, C.chairHi)
        r(s.x + 2, py + 20, 2, 1, '#222222')
        labels.push({ role: s.role, x: s.x + 3 + (i === 0 ? -4 : 4), y: py + 21, below: true })
        const em = seatedEmote(s.role, sec)
        if (em) bubbles.push({ x: s.x - 2, y: py - 6, icon: em })
    })
}

function walker(
    r: Paint,
    t: number,
    s: MoverState,
    role: Exclude<Role, 'dog'>,
    labels: OfficeLabel[],
    bubbles: Bubble[]
) {
    const step = s.walking ? Math.floor(t / 120) % 4 : 0
    person(r, s.x, s.y, CREW[role], s.dir, step, t, 'stand', role.length)
    labels.push({ role, x: s.x + 3, y: s.y - 13, below: false })
    if (s.emote && s.k > 0.12 && s.k < 0.92)
        bubbles.push({ x: s.x - 2, y: s.y - 26, icon: s.emote })
}

/** draws one frame of the office at time t (ms) and returns where the name tags go */
export function drawOffice(ctx: CanvasRenderingContext2D, t: number): OfficeLabel[] {
    const raw: Paint = (x, y, w, h, c) => {
        ctx.fillStyle = c
        ctx.fillRect(Math.round(x), Math.round(y), w, h)
    }
    const r: Paint = (x, y, w, h, c) => raw(x, y, w, h, mapEnv(c))
    const emit: Emit = (fn) => fn()
    const sec = t / 1000
    const labels: OfficeLabel[] = []
    const bubbles: Bubble[] = []

    floorWood(r, 0, 13, OFFICE_W, 77)
    floorTile(r, 112, 40, 50, 50)
    rug(r, 4, 58, 37, 30)
    r(0, 0, OFFICE_W, 2, C.wallCap)
    r(0, 2, OFFICE_W, 10, C.wallFace)
    r(0, 11, OFFICE_W, 1, C.trim)
    r(0, 12, OFFICE_W, 1, 'rgba(0,0,0,0.16)')
    whiteboard(r, 5, 28, t)
    windowPane(r, 40, 21, t)
    windowPane(r, 64, 21, t)
    sign(r, emit, 89)
    clock(r, 121, t)
    lightPatch(ctx, 40, 21)
    lightPatch(ctx, 64, 21)
    shelf(r, 102, 3, 16, 17)
    rack(r, emit, 128, 3, 12, 18, t)
    rack(r, emit, 142, 3, 12, 18, t)
    plant(r, 35, 22, true)
    plant(r, 155, 31, true)
    arcade(r, emit, 1, 38, t)
    couch(r, 8, 58, 24)
    floorLamp(r, emit, 34, 66)
    coffeeTable(r, 14, 70, 12, 4)
    r(9, 78, 12, 6, '#7a4f8a')
    r(10, 79, 10, 4, '#a07ab0')
    beanbag(r, 30, 76)
    pingPong(r, 54, 66, 38, 12)
    waterCooler(r, 104, 40)
    counter(r, 114, 44, 34)
    const ops = OPS(sec)
    coffeeMachine(r, emit, 120, 37, t, !ops.walking && ops.emote === 'coffee')
    sink(r, 132, 42)
    fridge(r, 150, 30, 10, 22)
    roundTable(r, 132, 74)
    r(138, 87, 4, 2, '#c75a5a')
    r(139, 87, 2, 1, '#a87b53')

    const opsSeated = !!ops.seat
    deskPod(r, raw, emit, t, sec, opsSeated, labels, bubbles)

    const plan = PLAN(sec)
    const pup = DOG(sec)
    const actors: { y: number; draw: () => void }[] = [
        { y: plan.y, draw: () => walker(raw, t, plan, 'plan', labels, bubbles) },
        {
            y: pup.y,
            draw: () => {
                dog(
                    raw,
                    pup.x,
                    pup.y,
                    pup.dir === 'left' ? 'left' : 'right',
                    pup.walking,
                    !!pup.sleep,
                    t
                )
                labels.push({ role: 'dog', x: pup.x + 5, y: pup.y - 8, below: false })
                if (pup.emote && pup.k > 0.1 && pup.k < 0.95)
                    bubbles.push({ x: pup.x, y: pup.y - 20, icon: pup.emote })
            },
        },
    ]
    if (!opsSeated)
        actors.push({ y: ops.y, draw: () => walker(raw, t, ops, 'ops', labels, bubbles) })
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw())
    plant(r, 154, 90, true)

    bubbles.forEach((b) => bubble(raw, b.x, b.y, b.icon))
    return labels
}

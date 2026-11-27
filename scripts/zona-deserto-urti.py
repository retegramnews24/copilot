# Zona Operativa: dati per gli urti della mappa del deserto (docs/zona-operativa.md, tappa 2).
# Si lancia dentro Blender con blender/zona_deserto.blend aperto (scena «Scene»):
#   exec(open(r"<repo>/scripts/zona-deserto-urti.py", encoding="utf-8").read())
# Scrive public/zona/map-deserto.js: scatole, altezza del terreno a griglia, punti. Coordinate di three.js:
# Blender (x, y, z) -> three (x, z, -y).
import bpy, bmesh, math, os, json
from mathutils import Vector

REPO = os.path.dirname(os.path.dirname(os.path.abspath(bpy.data.filepath)))
OUT = os.path.join(REPO, 'public', 'zona', 'map-deserto.js')
scene = bpy.data.scenes['Scene']

# oggetti con le scatole; rocce e casse (ruotate a caso) un poco più strette della loro scatola dritta
SOLID = ['mura', 'muretti', 'muri_alti', 'torre_centrale', 'massi', 'casse']
SHRINK = {'massi': 0.8, 'casse': 0.9}


def islands(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    seen = set()
    out = []
    for v in bm.verts:
        if v in seen:
            continue
        st = [v]
        comp = []
        seen.add(v)
        while st:
            x = st.pop()
            comp.append(x.co.copy())
            for e in x.link_edges:
                y = e.other_vert(x)
                if y not in seen:
                    seen.add(y)
                    st.append(y)
        out.append(comp)
    bm.free()
    return out


cache = {}


def local_boxes(me):
    if me.name not in cache:
        res = []
        for comp in islands(me):
            mn = Vector((min(c.x for c in comp), min(c.y for c in comp), min(c.z for c in comp)))
            mx = Vector((max(c.x for c in comp), max(c.y for c in comp), max(c.z for c in comp)))
            res.append((mn, mx))
        cache[me.name] = res
    return cache[me.name]


def world_box(o, mn, mx, shrink=1.0):
    pts = [o.matrix_world @ Vector((x, y, z)) for x in (mn.x, mx.x) for y in (mn.y, mx.y) for z in (mn.z, mx.z)]
    a = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    b = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    if shrink != 1.0:
        c = (a + b) / 2
        for i in (0, 1):
            h = (b[i] - a[i]) / 2 * shrink
            a[i] = c[i] - h
            b[i] = c[i] + h
    # in three: x, z(su), -y
    return [round(a.x, 2), round(a.z, 2), round(-b.y, 2), round(b.x, 2), round(b.z, 2), round(-a.y, 2)]


boxes = []
for o in bpy.data.collections['case'].objects:
    for mn, mx in local_boxes(o.data):
        boxes.append(world_box(o, mn, mx))
for name in SOLID:
    o = scene.objects[name]
    for mn, mx in local_boxes(o.data):
        boxes.append(world_box(o, mn, mx, SHRINK.get(name, 1.0)))
# via le scatole minuscole (schegge sotto i 5 cm)
boxes = [b for b in boxes if b[3] - b[0] > 0.05 and b[4] - b[1] > 0.05 and b[5] - b[2] > 0.05]
# confini: dalle mura non si esce, nemmeno dai tratti crollati. Settimo numero 1 = i colpi passano (noShot)
boxes += [
    [-75, -5, -75, -64.6, 40, 75, 1],
    [64.6, -5, -75, 75, 40, 75, 1],
    [-75, -5, -75, 75, 40, -64.6, 1],
    [-75, -5, 64.6, 75, 40, 75, 1],
]

# terreno: altezza a griglia, un raggio dall'alto ogni metro (anche le piazzole delle partenze)
STEP = 1.0
X0 = -66.0
N = 133
ground_objs = [scene.objects[n] for n in ('terreno', 'partenza_blu', 'partenza_rossa')]
heights = []
for iz in range(N):
    z3 = X0 + iz * STEP
    for ix in range(N):
        x3 = X0 + ix * STEP
        bx = max(-64.5, min(64.5, x3))
        by = max(-64.5, min(64.5, -z3))
        best = None
        for g in ground_objs:
            inv = g.matrix_world.inverted()
            o = inv @ Vector((bx, by, 50.0))
            d = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
            hit, loc, _n, _i = g.ray_cast(o, d)
            if hit:
                zz = (g.matrix_world @ loc).z
                best = zz if best is None else max(best, zz)
        heights.append(round((best if best is not None else 0.0) * 100))

points = {}
for o in bpy.data.collections['punti'].objects:
    p = o.matrix_world.translation
    yaw = math.atan2(math.sin(o.rotation_euler.z + math.pi), math.cos(o.rotation_euler.z + math.pi))
    points[o.name] = {'tipo': o.get('tipo', ''), 'x': round(p.x, 2), 'y': round(p.z, 2), 'z': round(-p.y, 2), 'yaw': round(yaw, 3)}

def rows(arr, per):
    return ',\n'.join('  ' + ','.join(str(v) for v in arr[i:i + per]) for i in range(0, len(arr), per))

with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// Zona Operativa: la mappa del deserto per gli urti (docs/zona-operativa.md, tappa 2). FILE GENERATO da\n')
    f.write('// scripts/zona-deserto-urti.py dentro blender/zona_deserto.blend: non modificarlo a mano.\n')
    f.write('// Coordinate di three.js (y in alto). Scatole: [minX, minY, minZ, maxX, maxY, maxZ] in metri; un settimo\n')
    f.write('// numero 1 vuol dire che i colpi passano (i confini della mappa).\n')
    f.write('// Terreno: altezze in centimetri, righe lungo z, a passo di %g m da (%g, %g).\n' % (STEP, X0, X0))
    f.write('export const BOXES = [\n' + ',\n'.join('  ' + json.dumps(b, separators=(',', ':')) for b in boxes) + '\n];\n')
    f.write('export const GROUND = { x0: %g, z0: %g, step: %g, nx: %d, nz: %d, h: [\n' % (X0, X0, STEP, N, N))
    f.write(rows(heights, N) + '\n] };\n')
    f.write('export const POINTS = ' + json.dumps(points, indent=2, ensure_ascii=False) + ';\n')
print('scatole', len(boxes), 'punti', len(points), 'file', OUT, os.path.getsize(OUT))

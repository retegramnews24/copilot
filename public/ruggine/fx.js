// Effetti: polvere delle ruote, fumo dei camini, scintille, segni di gomma sull'asfalto. Tutto a sprite instanziati.
import * as THREE from 'three';

function softDot(r, g, b) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'),
    gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.5, `rgba(${r},${g},${b},0.45)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// un "sistema" di particelle: Points con dimensione e trasparenza per particella
class Particles {
  constructor(scene, max, tex, blending, sizeScale = 1) {
    this.max = max;
    this.n = 0;
    this.p = []; // {x,y,z,vx,vy,vz,life,max,size,grow,r,g,b,a}
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    // (attributo "pcol", non "color": three.js dichiara già "color" e lo shader non compilerebbe)
    g.setAttribute('pcol', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending,
      uniforms: { map: { value: tex }, scale: { value: sizeScale * 600 } },
      vertexShader:
        'attribute float size; attribute vec4 pcol; varying vec4 vc; uniform float scale; void main(){ vc = pcol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scale/(-mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader:
        'uniform sampler2D map; varying vec4 vc; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vc.rgb*t.rgb, vc.a*t.a); }'
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  add(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(o);
  }
  update(dt, drag = 1.5, gravity = 0) {
    const P = this.p;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.life -= dt;
      if (q.life <= 0) {
        P.splice(i, 1);
        continue;
      }
      const k = Math.exp(-dt * drag);
      q.vx *= k;
      q.vz *= k;
      q.vy = q.vy * k - gravity * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.y < 0.05 && gravity) {
        q.y = 0.05;
        q.vy *= -0.3;
      }
      q.size += q.grow * dt;
    }
    for (let i = 0; i < this.max; i++) {
      const q = P[i];
      if (!q) {
        this.size[i] = 0;
        continue;
      }
      this.pos[i * 3] = q.x;
      this.pos[i * 3 + 1] = q.y;
      this.pos[i * 3 + 2] = q.z;
      const t = q.life / q.max;
      this.col[i * 4] = q.r;
      this.col[i * 4 + 1] = q.g;
      this.col[i * 4 + 2] = q.b;
      this.col[i * 4 + 3] = q.a * Math.min(1, t * 2) * Math.min(1, (1 - t) * 6 + 0.2);
      this.size[i] = q.size;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = g.attributes.pcol.needsUpdate = g.attributes.size.needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.dust = new Particles(scene, 700, softDot(214, 170, 120), THREE.NormalBlending, 1);
    this.smoke = new Particles(scene, 260, softDot(90, 84, 78), THREE.NormalBlending, 1);
    this.sparks = new Particles(scene, 300, softDot(255, 210, 120), THREE.AdditiveBlending, 0.5);
    // segni di gomma: quadrati scuri appoggiati a terra (pool circolare)
    this.skidMax = 1400;
    this.skidN = 0;
    const g = new THREE.PlaneGeometry(0.34, 0.55);
    g.rotateX(-Math.PI / 2);
    this.skid = new THREE.InstancedMesh(
      g,
      new THREE.MeshBasicMaterial({ color: '#141210', transparent: true, opacity: 0.45, depthWrite: false }),
      this.skidMax
    );
    this.skid.count = 0;
    this.skid.renderOrder = 2;
    this.skid.frustumCulled = false;
    scene.add(this.skid);
    this._d = new THREE.Object3D();
  }
  // polvere dietro le ruote: tanta fuori pista, poca sull'asfalto se la macchina scivola
  wheels(c, dt) {
    const sp = Math.abs(c.v);
    if (sp < 2) return;
    const amount = c.offroad ? sp * 0.45 : c.slide > 2.2 ? c.slide * 0.35 : 0;
    if (Math.random() > amount * dt * 3) return;
    for (const s of [-1, 1]) {
      const bx = c.x - Math.cos(c.a) * 1.3 + Math.sin(c.a) * s * 0.9,
        bz = c.z - Math.sin(c.a) * 1.3 - Math.cos(c.a) * s * 0.9;
      this.dust.add({
        x: bx,
        y: 0.25,
        z: bz,
        vx: -c.vx * 0.15 + (Math.random() - 0.5) * 2,
        vy: 0.8 + Math.random(),
        vz: -c.vz * 0.15 + (Math.random() - 0.5) * 2,
        life: 1.2,
        max: 1.2,
        size: 0.8,
        grow: 2.4,
        r: 1,
        g: 1,
        b: 1,
        a: c.offroad ? 0.55 : 0.3
      });
      if (!c.offroad && c.slide > 2.6) this.mark(bx, bz, c.a);
    }
  }
  mark(x, z, a) {
    const i = this.skidN++ % this.skidMax;
    this._d.position.set(x, 0.03, z);
    this._d.rotation.set(0, -a + Math.PI / 2, 0);
    this._d.updateMatrix();
    this.skid.setMatrixAt(i, this._d.matrix);
    this.skid.count = Math.min(this.skidMax, this.skidN);
    this.skid.instanceMatrix.needsUpdate = true;
  }
  exhaust(c) {
    if (Math.random() > 0.25) return;
    const bx = c.x - Math.cos(c.a) * 1.95,
      bz = c.z - Math.sin(c.a) * 1.95;
    this.smoke.add({
      x: bx,
      y: 0.55,
      z: bz,
      vx: -Math.cos(c.a) * 1.5,
      vy: 0.5,
      vz: -Math.sin(c.a) * 1.5,
      life: 0.7,
      max: 0.7,
      size: 0.35,
      grow: 1.2,
      r: 0.6,
      g: 0.6,
      b: 0.6,
      a: c.boost > 0 ? 0.6 : 0.25
    });
  }
  chimney(x, y, z) {
    this.smoke.add({
      x: x + (Math.random() - 0.5) * 0.4,
      y,
      z: z + (Math.random() - 0.5) * 0.4,
      vx: 1.6 + Math.random(),
      vy: 2.4 + Math.random(),
      vz: 0.6,
      life: 6,
      max: 6,
      size: 1.6,
      grow: 2.2,
      r: 0.75,
      g: 0.7,
      b: 0.65,
      a: 0.5
    });
  }
  burst(x, y, z, n = 18, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        s = (4 + Math.random() * 10) * power;
      this.sparks.add({
        x,
        y,
        z,
        vx: Math.cos(a) * s,
        vy: 2 + Math.random() * 6 * power,
        vz: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
        size: 0.35,
        grow: -0.2,
        r: 1,
        g: 0.85,
        b: 0.55,
        a: 1
      });
    }
  }
  update(dt) {
    this.dust.update(dt, 1.2);
    this.smoke.update(dt, 0.25);
    this.sparks.update(dt, 1.5, 14);
  }
}

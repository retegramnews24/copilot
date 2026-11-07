import {AXLE, WHEEL, HELMET, ground} from './physics.js?v=6';

import {riderPose, HEAD_RADIUS, SUSPENSION} from './rider.js?v=6';

const THEMES = [
  {sky: ['#193345', '#eaa46d', '#f6d399'], haze: '#96736d', far: '#615c68', near: '#43515a', rock: '#573c37', face: '#724b3d', top: '#d49a66', rim: '#f2c183', dust: '#f4c893'},
  {sky: ['#294c52', '#a8b18d', '#e7cc98'], haze: '#849480', far: '#596e62', near: '#3d544f', rock: '#354744', face: '#536154', top: '#a8aa78', rim: '#d0cc95', dust: '#c8c69a'},
  {sky: ['#343650', '#bd8090', '#f6c8a2'], haze: '#99768d', far: '#675971', near: '#51495e', rock: '#493747', face: '#664650', top: '#c08d80', rim: '#f1b9a0', dust: '#f0b4a0'},
  {sky: ['#154054', '#75c5ce', '#c8e7df'], haze: '#75a4ab', far: '#4e7886', near: '#2e5869', rock: '#294556', face: '#3d6279', top: '#82d2df', rim: '#c6f5ec', dust: '#a4e7eb'},
  {sky: ['#2c1625', '#b94f3f', '#fcaa52'], haze: '#924f50', far: '#73333b', near: '#49252e', rock: '#462733', face: '#713741', top: '#e36848', rim: '#ffc477', dust: '#ff924d'},
  {sky: ['#163b37', '#70a680', '#e2d6a1'], haze: '#749c76', far: '#467763', near: '#26544a', rock: '#334638', face: '#536853', top: '#90be76', rim: '#d2dfa2', dust: '#bddb92'},
  {sky: ['#252634', '#8a6161', '#e6b173'], haze: '#846671', far: '#594f5e', near: '#3b3948', rock: '#473239', face: '#6e4742', top: '#cd8355', rim: '#ffd19a', dust: '#e3a67a'},
  {sky: ['#14243d', '#6689b1', '#d2e3ed'], haze: '#7e9fbb', far: '#516f93', near: '#345276', rock: '#334963', face: '#486b88', top: '#9abed8', rim: '#e4f6ff', dust: '#d1efff'},
  {sky: ['#101027', '#33375e', '#7979a5'], haze: '#5b5f87', far: '#45496e', near: '#303456', rock: '#33314f', face: '#514d72', top: '#9c9ac7', rim: '#e3dcfa', dust: '#c9bfff'},
  {sky: ['#291638', '#9e5671', '#f9bd80'], haze: '#9b7280', far: '#714c69', near: '#4f354d', rock: '#52384c', face: '#825168', top: '#de927e', rim: '#ffcd99', dust: '#f8b291'}
];

function polygon(c, points, fill) {
  c.fillStyle = fill;
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  c.fill();
}

function line(c, points, color, width) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

function disc(c, x, y, radius, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
}

function landmarks(c, w, h, bike, kind, theme) {
  if (kind === undefined) return;
  const span = Math.max(90, w / 5), drift = ((bike.x * 3.4) % span + span) % span;
  const row = h * .76;
  for (let i = -1; i < 7; i++) {
    const x = span * i - drift, size = h * (.12 + ((i + 5) % 3) * .027);
    if (kind === 5) {
      for (let j = 0; j < 3; j++) {
        const u = x + j * size * .55;
        polygon(c, [[u, row - size * (j === 1 ? 1.38 : 1)], [u - size * .30, row], [u + size * .31, row]], theme.near);
      }
    } else if (kind === 1 || kind === 6) {
      c.fillStyle = theme.near;
      c.fillRect(x, row - size, size * .16, size);
      c.fillRect(x, row - size, span * .83, size * .11);
      if (kind === 6) line(c, [[x, row - size], [x + span * .75, row]], theme.far, 2);
    } else if (kind === 3 || kind === 7) {
      polygon(c, [[x, row], [x + size * .19, row - size], [x + size * .43, row - size * .7],
        [x + size * .54, row]], theme.near);
      line(c, [[x + size * .19, row - size], [x + size * .29, row - size * .15]], theme.haze, 2);
    } else if (kind === 8) {
      disc(c, x, row, size * .28, theme.far);
      disc(c, x + size * .25, row + size * .13, size * .21, theme.near);
    } else {
      polygon(c, [[x - size * .45, row], [x, row - size], [x + size * .31, row - size * .58],
        [x + size * .66, row]], theme.near);
      if (kind === 4) line(c, [[x, row - size], [x + size * .08, row - size * .62], [x - size * .05, row]], '#f17b5266', 2);
    }
  }
}

function sky(c, w, h, course, bike, theme) {
  const gradient = c.createLinearGradient(0, 0, 0, h);
  theme.sky.forEach((color, i) => gradient.addColorStop(i * .5, color));
  c.fillStyle = gradient;
  c.fillRect(0, 0, w, h);
  const depthShift = Math.min(Math.max(0, bike.y), h * .25);
  const sunX = w * .74 - (bike.x - 4) * .12, sunY = h * .25 - depthShift * .18;
  disc(c, sunX, sunY, h * .091, '#fff0bb33');
  disc(c, sunX, sunY, h * .074, course.theme === 8 ? '#d9d1ff' : '#ffe5ad');
  if (course.theme === 8 || course.theme === 7) {
    for (let i = 0; i < 38; i++) {
      const x = (((i * 73 + 13) % 251) / 251) * w;
      const y = (((i * 97 + 33) % 251) / 251) * h * .58;
      disc(c, x, y, i % 5 === 0 ? 1.5 : .7, '#e3edf9b0');
    }
  }
  for (const [i, fill] of [theme.haze, theme.far, theme.near].entries()) {
    const stride = Math.max(15, w / 35), depth = i + 1, ridge = [];
    const offset = bike.x * depth * 1.8 + course.seed % 997;
    for (let x = 0; x < w + stride; x += stride) {
      const u = (x + offset) / Math.max(260, w);
      const y = h * (.57 + i * .124) - depthShift * depth * .4 +
        Math.sin(u * 9 + i) * h * .095 + Math.cos(u * 22 - i * 3) * h * .049;
      ridge.push([x, y]);
    }
    polygon(c, [...ridge, [w + stride, h], [0, h]], fill);
  }
  landmarks(c, w, h, bike, course.theme, theme);
}

function ledge(c, track, theme) {
  const points = track.map(({x, y}) => [x, y]);
  const underside = points.slice().reverse().map(([x, y], i) => [x, y + (i % 3 === 1 ? 2.2 : 1.4)]);
  polygon(c, [...points, ...underside], theme.rock);
  const strip = points.slice().reverse().map(([x, y], i) => [x, y + (i % 2 ? .46 : .66)]);
  polygon(c, [...points, ...strip], theme.face);
  line(c, points, theme.top, .21);
  line(c, points.map(([x, y]) => [x, y - .055]), theme.rim, .075);
  for (let i = 2; i < points.length - 2; i++) {
    const [x, y] = points[i], side = i % 2 ? -1 : 1;
    line(c, [[x, y + .38], [x + side * .44, y + .85], [x + side * .21, y + 1.14]], '#291f2a55', .09);
  }
}

function sign(c, x, y, direction, flag = false, brake = false) {
  line(c, [[x, y], [x, y - 1.9]], '#38292a', .13);
  if (flag) {
    polygon(c, [[x, y - 1.87], [x + direction * 1.25, y - 1.63], [x, y - 1.30]], '#f5bd73');
  } else {
    c.save();
    c.translate(x, y - 1.67);
    c.scale(direction, 1);
    c.fillStyle = brake ? '#913f24' : '#332a2b';
    c.beginPath();
    c.roundRect(-.67, -.42, 1.34, .84, .14);
    c.fill();
    if (brake) {
      line(c, [[0, -.24], [0, .05]], '#fff1ce', .11);
      disc(c, 0, .21, .057, '#fff1ce');
    } else {
      line(c, [[-.34, 0], [.27, 0], [.04, -.22]], '#ffe1a4', .10);
      line(c, [[.27, 0], [.04, .22]], '#ffe1a4', .10);
    }
    c.restore();
  }
}

function gate(c, x, y) {
  line(c, [[x, y], [x, y - 3.15]], '#30262a', .17);
  c.fillStyle = '#30262a';
  c.fillRect(x, y - 3.12, 1.55, .86);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 7; i++) {
    if ((i + j) % 2 === 0) {
      c.fillStyle = '#ffe5af';
      c.fillRect(x + i * .22, y - 3.12 + j * .215, .22, .215);
    }
  }
}

const PAINT = [
  ['#f4a644', '#70d5ce'], ['#e66a63', '#f1c482'], ['#72c5ef', '#c0daf8'], ['#a3cf67', '#efdb8c'],
  ['#c899ed', '#f3b8d0'], ['#e4cf63', '#a8ded1'], ['#83a2ef', '#dcbbb3'], ['#ee92be', '#efd9a2']
];

function motorcycle(c, bike, time, color, version) {
  const [paint, jersey] = PAINT[color] || PAINT[0];
  c.save();
  c.translate(bike.x, bike.y);
  c.rotate(bike.angle);
  c.scale(bike.facing, 1);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const rearY = -(bike.facing > 0 ? bike.leftSpring ?? 0 : bike.rightSpring ?? 0);
  const frontY = -(bike.facing > 0 ? bike.rightSpring ?? 0 : bike.leftSpring ?? 0);
  for (const [x, y] of [[-AXLE, rearY], [AXLE, frontY]]) {
    disc(c, x, y, WHEEL, '#211f28');
    disc(c, x, y, WHEEL - .075, '#b0a7a0');
    disc(c, x, y, WHEEL - .113, '#38363f');
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + bike.roll * bike.facing;
      line(c, [[x, y], [x + Math.cos(a) * .251, y + Math.sin(a) * .251]], '#a39892', .025);
    }
    disc(c, x, y, .067, '#f3dabb');
  }
  line(c, [[-AXLE, rearY], [-.21, -.19], [.38, -.51], [-.55, -.57], [-AXLE, rearY]], '#1d242a', .17);
  line(c, [[-AXLE, rearY], [-.18, -.18], [.42, -.52], [-.56, -.55], [-AXLE, rearY]], '#efac57', .088);
  line(c, [[AXLE, frontY], [.48, -.64], [.34, -.83], [.57, -.85]], '#e5cfb7', .081);
  polygon(c, [[-.83, -.62], [-.31, -.63], [.30, -.56], [.12, -.34], [-.38, -.42]], paint);
  polygon(c, [[-.88, -.67], [-.32, -.67], [-.23, -.60], [-.83, -.60]], '#31313a');
  polygon(c, [[.57, -.29], [.95, -.41], [1.10, -.28], [.78, -.31]], paint);
  disc(c, -.12, -.31, .146, '#d6c2b4');
  disc(c, -.12, -.31, .084, '#746971');
  if (version >= 6) {
    const {hip, shoulder, head, elbow, hand, knee, foot} = riderPose(bike.lean);
    line(c, [[-AXLE, rearY], SUSPENSION.rear], '#9e8a77', .095);
    line(c, [[AXLE, frontY], SUSPENSION.front, hand], '#e5cfb7', .076);
    line(c, [hip, knee, foot], '#242631', .19);
    line(c, [hip, knee], '#5c5963', .10);
    line(c, [[foot[0] - .16, foot[1]], [foot[0] + .12, foot[1]]], '#1f222a', .115);
    line(c, [hip, shoulder], '#1c2630', .30);
    line(c, [hip, shoulder], jersey, .21);
    line(c, [shoulder, elbow, hand], '#2a3944', .137);
    line(c, [elbow, hand], '#c1dbc9', .073);
    disc(c, hand[0], hand[1], .072, '#292c35');
    disc(c, head[0], head[1], HEAD_RADIUS, '#252834');
    disc(c, head[0], head[1] - .015, HEAD_RADIUS - .028, '#fff0c9');
    polygon(c, [[head[0] - .075, head[1] - .05], [head[0] + .207, head[1] - .055],
      [head[0] + .18, head[1] + .11], [head[0] + .055, head[1] + .09]], '#384e5a');
    c.restore();
    return;
  }
  const rhythm = Math.sin(time * 13) * Math.min(.026, Math.abs(bike.vx) * .003);
  const shift = bike.lean * .16;
  const hip = [-.42 + shift, -.72], shoulder = [-.15 + shift, -1.11 + rhythm];
  line(c, [[-.20, -.27], [-.04 + shift, -.51], hip], '#292b35', .18);
  line(c, [hip, shoulder], '#1c2630', .28);
  line(c, [hip, shoulder], jersey, .195);
  line(c, [shoulder, [.22 + shift * .5, -.90], [.49, -.84]], '#304551', .125);
  line(c, [shoulder, [.22 + shift * .5, -.90], [.49, -.84]], '#a8e6d4', .064);
  const hx = HELMET.x + shift, hy = HELMET.y;
  disc(c, hx, hy, HELMET.radius, '#252834');
  disc(c, hx, hy - .018, .173, '#fff0c9');
  polygon(c, [[hx - .08, hy - .048], [hx + .22, hy - .048],
    [hx + .21, hy + .10], [hx + .09, hy + .11]], '#384e5a');
  c.restore();
}

export function drawTrial(c, width, height, course, bike, time, reduced, riders = [], selfColor = 0) {
  const theme = THEMES[course.theme ?? course.seed % 3];
  sky(c, width, height, course, bike, theme);
  const scale = Math.max(19, Math.min(48, width / 30, height / 14.5));
  const anchorX = width * .5, anchorY = height * .47;
  c.save();
  c.translate(anchorX - bike.x * scale, anchorY - bike.y * scale);
  c.scale(scale, scale);
  const reach = width / scale * .53, below = height / scale * .6;
  for (const [i, tier] of course.tiers.entries()) {
    if (tier.points[0].x > bike.x + reach || tier.points.at(-1).x < bike.x - reach ||
        tier.top > bike.y + below + 3 || tier.bottom < bike.y - below - 3) continue;
    if (tier.jump) {
      const cut = tier.points.findIndex(p => p.gapAfter) + 1;
      ledge(c, tier.points.slice(0, cut), theme);
      ledge(c, tier.points.slice(cut), theme);
      const warning = tier.jump.lip - 4 * tier.direction;
      sign(c, warning, ground(tier, warning), tier.direction, false, tier.jump.short);
    } else ledge(c, tier.points, theme);
    sign(c, tier.marker, ground(tier, tier.marker), tier.direction, true);
    const isLast = i === course.tiers.length - 1;
    const x = isLast ? course.finish : tier.end - 4 * tier.direction;
    const y = ground(tier, x);
    if (isLast) gate(c, x, y);
    else sign(c, x, y, tier.direction, false, tier.precisionDrop);
  }
  if (!reduced && bike.onGround && Math.abs(bike.vx) > 2 && bike.status === 'ride') {
    for (let i = 0; i < 6; i++) {
      const phase = (time * 2.9 + i / 6) % 1;
      const trail = Math.sign(bike.vx) * (1 + phase * 1.8);
      c.globalAlpha = (1 - phase) * .31;
      disc(c, bike.x - trail, bike.y + .28 - phase * .34, .07 + phase * .16, theme.dust);
    }
    c.globalAlpha = 1;
  }
  const visible = riders.filter(({bike: rider}) => Math.abs(rider.x - bike.x) < reach &&
    Math.abs(rider.y - bike.y) < below);
  for (const rider of visible) {
    c.globalAlpha = rider.bike.mode === 'crash' ? .48 : .87;
    motorcycle(c, rider.bike, reduced ? 0 : time, rider.color, course.version);
  }
  c.globalAlpha = 1;
  motorcycle(c, bike, reduced ? 0 : time, selfColor, course.version);
  c.restore();
  const names = [];
  for (const rider of visible) {
    const x = anchorX + (rider.bike.x - bike.x) * scale;
    let y = anchorY + (rider.bike.y - bike.y - 2.05) * scale;
    for (const label of names) if (Math.abs(x - label.x) < 82 && Math.abs(y - label.y) < 17) y = label.y - 18;
    names.push({x, y});
    c.save();
    c.textAlign = 'center';
    c.font = '600 12px system-ui';
    c.lineWidth = 3;
    c.strokeStyle = '#202630e8';
    c.fillStyle = (PAINT[rider.color] || PAINT[0])[1];
    c.strokeText(rider.name, x, y, 116);
    c.fillText(rider.name, x, y, 116);
    c.restore();
  }
}

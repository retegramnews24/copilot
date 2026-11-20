import * as T from '../vendor/three/three.module.min.js';
import { advance, example, makeTrial, member, nodes } from './physics.js';

const $ = (id) => document.getElementById(id);
const view = $('view');
const scene = new T.Scene();
scene.background = new T.Color(0x476662);
scene.fog = new T.Fog(0x476662, 35, 120);
const camera = new T.OrthographicCamera(-13, 13, 7, -7, 0.1, 150);
camera.position.set(2, 5.3, 25);
camera.lookAt(0, -0.8, 0);
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
view.prepend(renderer.domElement);
scene.add(new T.HemisphereLight(0xe4f6de, 0x405446, 2.3));
const sun = new T.DirectionalLight(0xffe0a0, 2.4);
sun.position.set(-12, 16, 10);
scene.add(sun);

const material = (color) => new T.MeshStandardMaterial({ color, flatShading: true });
const stone = material(0x647261), grass = material(0x64885f), dark = material(0x224c46);
function box(w,h,d,x,y,z,mat,parent = scene) {
  const object = new T.Mesh(new T.BoxGeometry(w,h,d),mat);
  object.position.set(x,y,z);
  parent.add(object);
  return object;
}
for (const side of [-1,1]) {
  box(8,0.35,6,side*13,-0.21,0,grass);
  box(8,10,6,side*13,-5.45,0,stone);
  for (let i=0;i<9;i++) {
    const rock = new T.Mesh(new T.DodecahedronGeometry(0.85),stone);
    rock.scale.set(1.3,1.7,1);
    rock.position.set(side*(9.4+(i%3)*0.6),-1.9-Math.floor(i/3)*1.88,1.7-(i%3)*1.4);
    rock.rotation.z = i*0.72;
    scene.add(rock);
  }
  box(0.28,2.7,0.38,side*9,1.2,0,stone);
  box(0.52,0.25,0.53,side*9,2.52,0,grass);
}
box(100,0.18,100,0,-8.2,0,dark);
for (let i=0;i<7;i++) {
  const hill = new T.Mesh(new T.ConeGeometry(13+i%3,14+i%2*4,5), material(0x577668));
  hill.position.set((i-3)*14,-4,-23-(i%2)*7);
  hill.rotation.y=i;
  scene.add(hill);
}
const cart = new T.Group();
scene.add(cart);
const gold = material(0xefae50), tire = material(0x242b27);
box(1.22,0.36,0.92,0,0.5,0,gold,cart);
box(0.55,0.38,0.81,-0.16,0.82,0,material(0x8cbbae),cart);
for (const x of [-0.42,0.42]) for (const z of [-0.48,0.48]) {
  const wheel = new T.Mesh(new T.CylinderGeometry(0.18,0.18,0.14,12),tire);
  wheel.rotation.x=Math.PI/2;
  wheel.position.set(x,0.25,z);
  cart.add(wheel);
}

const anchor = new T.Vector3(), end = new T.Vector3(), up = new T.Vector3(0,1,0);
const beam = new T.BoxGeometry(1,1,1);
const cord = new T.CylinderGeometry(0.043,0.043,1,8);
const normal = { beam: new T.Color(0xc99759), rope: new T.Color(0x79e0ba) };
const stress = new T.Color(0xff522b);
let links = [], objects = [], selected = null, tool = 'beam', trial = null, frame = 0, accumulator = 0;
const limit = 24;
const buttons = nodes.map((node,i) => {
  const button = document.createElement('button');
  button.className = 'joint';
  if (node.fixed) button.dataset.fixed = '';
  button.setAttribute('aria-label', (node.fixed ? 'Ancoraggio ' : 'Nodo ') + (i+1));
  button.addEventListener('click', () => choose(i));
  $('joints').append(button);
  return button;
});
function setMode(value) {
  tool=value;
  clearSelection();
  for(const name of ['beam','rope','erase']) $(name).setAttribute('aria-pressed',String(value===name));
}
function clearSelection() {
  selected=null;
  buttons.forEach((button)=>button.setAttribute('aria-pressed','false'));
}
function choose(index) {
  if (trial) return;
  if (selected === null || selected === index) {
    const wasSelected = selected === index;
    clearSelection();
    if (!wasSelected) {
      selected=index;
      buttons[index].setAttribute('aria-pressed','true');
    }
    return;
  }
  const start=selected;
  clearSelection();
  const existing=links.findIndex((edge)=>(edge.a===start&&edge.b===index)||(edge.b===start&&edge.a===index));
  if (tool==='erase') {
    if(existing>=0) links.splice(existing,1);
    else return hint('Non c’è un pezzo tra questi nodi.');
  } else {
    if(existing>=0) return hint('Questi nodi sono già collegati.');
    if(links.length>=limit) return hint('Hai usato tutti i pezzi disponibili.');
    const edge=member(start,index,tool);
    if(!edge) return hint(tool==='beam'?'Troppo lontani per una trave.':'Troppo lontani anche per una corda.');
    links.push(edge);
  }
  refresh();
}
function hint(message='Travi e corde si montano scegliendo due nodi.') { $('hint').textContent=message; }
function refresh() {
  for(const object of objects) { scene.remove(object); object.material.dispose(); }
  objects=links.map((edge)=>{
    const object=new T.Mesh(edge.type==='rope'?cord:beam,material(normal[edge.type]));
    scene.add(object);
    return object;
  });
  $('count').textContent=links.length+' / '+limit+' pezzi';
  hint();
}
function edit(plan=links) {
  trial=null;
  accumulator=0;
  links=plan;
  clearSelection();
  $('joints').hidden=false;
  $('result').hidden=true;
  $('trial').textContent='Prova';
  refresh();
}
function start() {
  clearSelection();
  trial=makeTrial(links);
  accumulator=0;
  $('joints').hidden=true;
  $('trial').textContent='Torna al ponte';
  hint('I pezzi più sollecitati diventano arancioni e poi rossi.');
}
for(const name of ['beam','rope','erase']) $(name).onclick=()=>{ if(trial)edit();setMode(name); };
$('trial').onclick=()=>trial?edit():start();
$('example').onclick=()=>edit(example());
$('reset').onclick=()=>edit([]);
edit();

function resize() {
  const width=view.clientWidth,height=view.clientHeight;
  if(!width||!height)return;
  const ratio=width/height;
  const horizontal=Math.max(11.8,ratio*5.8);
  const vertical=horizontal/ratio;
  Object.assign(camera,{left:-horizontal,right:horizontal,top:vertical,bottom:-vertical});
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  renderer.setSize(width,height,false);
  for(const [i,point] of nodes.entries()) {
    anchor.set(point.x,point.y,0).project(camera);
    buttons[i].style.left=(anchor.x+1)*50+'%';
    buttons[i].style.top=(1-anchor.y)*50+'%';
  }
}
new ResizeObserver(resize).observe(view);
resize();

renderer.setAnimationLoop((now)=>{
  const dt=Math.min(0.08,(now-(frame||now))/1000);
  frame=now;
  if (trial && !trial.result) {
    accumulator+=dt;
    while(accumulator>=1/180&&!trial.result){advance(trial,1/180);accumulator-=1/180;}
    if(trial.result){
      const result=$('result');
      result.textContent={success:'Il carrello è arrivato dall’altra parte!',gap:'Manca un tratto di strada o si è spezzato.',collapse:'Il ponte ha ceduto. Prova a rinforzarlo con triangoli.'}[trial.result];
      result.hidden=false;
    }
  }
  const joints=trial?.joints??nodes;
  for(const [i,link] of links.entries()) {
    const mesh=objects[i],a=joints[link.a],b=joints[link.b],tested=trial?.members[i];
    mesh.visible=!tested?.broken;
    if(!mesh.visible)continue;
    anchor.set(a.x,a.y,0);
    end.set(b.x,b.y,0);
    mesh.position.copy(anchor).lerp(end,0.5);
    end.sub(anchor);
    const length=end.length();
    mesh.quaternion.setFromUnitVectors(up,end.normalize());
    mesh.scale.set(link.deck?0.19:0.13,length,link.deck?0.88:0.19);
    if(link.type==='rope')mesh.scale.set(1,length,1);
    mesh.material.color.copy(normal[link.type]).lerp(stress,Math.abs(tested?.load??0));
    if(link.type==='rope')mesh.material.opacity=1;
  }
  const position=Math.min(6,trial?.position??0);
  const i=Math.min(5,Math.floor(position));
  const percent=position-i;
  const a=joints[i], b=joints[i+1];
  cart.position.set(T.MathUtils.lerp(a.x,b.x,percent),T.MathUtils.lerp(a.y,b.y,percent)+0.08,0);
  cart.rotation.z=Math.atan2(b.y-a.y,b.x-a.x);
  renderer.render(scene,camera);
});


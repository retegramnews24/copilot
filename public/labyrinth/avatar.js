import {CLOTHES, OUTFIT_KEY, BALL_STYLE_KEY, BALL_KEY, readAppearance,normalizeAppearance, readGolfStyle, golfColors} from '../appearance.js?v=9';
export {readAppearance};

const styles=`
.lab-avatar{display:flex;gap:12px 18px;align-items:center;flex-wrap:wrap}
.lab-avatar-previews{display:flex;align-items:flex-end;gap:14px;flex:none}
.lab-avatar-preview{display:grid;justify-items:center;gap:3px;margin:0}
.lab-avatar-preview figcaption{font-size:11px;white-space:nowrap}
.lab-avatar svg{display:block;width:64px;height:107px}
.lab-avatar-controls{flex:1 1 240px;min-width:0}
.lab-avatar .lab-swatches{display:flex;gap:5px;flex-wrap:wrap;margin:4px 0 7px}
.lab-avatar button.lab-swatch{width:24px;height:24px;min-height:24px;padding:0;border:2px solid transparent;border-radius:50%;background:var(--cloth);box-shadow:inset 0 0 0 1px #ffffff25}
.lab-avatar button.lab-swatch[aria-pressed=true]{border-color:currentColor;outline:1px solid #777}
.lab-avatar button.lab-swatch:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.lab-avatar small{font-size:11px}
.lab-avatar-ball{display:block;width:52px;height:52px;margin:0 0 15px;border-radius:50%;background:radial-gradient(circle at 31% 24%,#fffc 0,transparent 43%),linear-gradient(var(--ball-top) 50%,var(--ball-bottom) 50%);box-shadow:inset -4px -5px 10px #12162588,0 4px 10px #0004}
.lab-avatar label.lab-golf-toggle{display:flex;align-items:center;gap:6px;margin:4px 0;font-size:12px}
.lab-golf-toggle input{margin:0;accent-color:var(--accent);width:16px;height:16px}
.lab-golf-colors{padding-top:5px}
`;

function swatches(container,label,choose){
 const title=document.createElement('small'),row=document.createElement('div');
 title.textContent=label;
 row.className='lab-swatches';row.setAttribute('role','group');row.setAttribute('aria-label',label);
 const add=(name,color)=>{
  const button=document.createElement('button');button.type='button';button.className='lab-swatch';
  button.dataset.color=color;button.style.setProperty('--cloth',color);
  button.title=label+' · '+name;button.setAttribute('aria-label',button.title);
  button.onclick=()=>choose(color);row.append(button);
  return button;
 };
 const buttons=CLOTHES.map(([name,color])=>add(name,color));
 let previous=null;
 container.append(title,row);
 return selected=>{
  const listed=buttons.some(button=>button.dataset.color===selected);
  if(previous&&(listed||previous.dataset.color!==selected)){previous.remove();previous=null;}
  if(!listed&&!previous)previous=add('Colore precedente',selected);
  for(const button of row.children)button.setAttribute('aria-pressed',String(button.dataset.color===selected));
 };
}
function figure(label,preview){
 const element=document.createElement('figure'),caption=document.createElement('figcaption');
 element.className='lab-avatar-preview';caption.textContent=label;
 element.append(preview,caption);return element;
}
function save(key,value){
 try{localStorage.setItem(key,JSON.stringify(value));}catch{}
}
export function avatarSVG(appearance,backpack=false){
 const outfit=normalizeAppearance(appearance);
 return `<svg viewBox="0 0 90 150" role="img" aria-label="Personaggio Binottoland">${backpack?'<rect x="17" y="53" width="56" height="55" rx="13" fill="#586b44"/>':''}<ellipse cx="45" cy="145" rx="28" ry="4" fill="#0003"/><rect x="26" y="105" width="15" height="34" rx="7" fill="#e5ab99"/><rect x="49" y="105" width="15" height="34" rx="7" fill="#e5ab99"/><rect x="12" y="58" width="14" height="44" rx="7" fill="#e5ab99"/><rect x="64" y="58" width="14" height="44" rx="7" fill="#e5ab99"/><rect x="21" y="49" width="48" height="49" rx="16" fill="${outfit.shirt}"/><path d="M25 89H65V115H48V101H42V115H25Z" fill="${outfit.shorts}"/><rect x="35" y="36" width="20" height="21" rx="8" fill="#e5ab99"/><ellipse cx="24" cy="29" rx="4" ry="7" fill="#dfaa96"/><ellipse cx="66" cy="29" rx="4" ry="7" fill="#dfaa96"/><ellipse cx="45" cy="28" rx="21" ry="25" fill="#efb9a8"/><path d="M24 24Q21 1 43 1Q68 -1 66 25L61 18Q49 20 36 13L27 26Z" fill="#49382b"/><path d="M33 23Q38 20 42 23M48 23Q53 20 57 23" fill="none" stroke="#584032" stroke-width="2" stroke-linecap="round"/><ellipse cx="38" cy="29" rx="4" ry="3" fill="#f5eadd"/><ellipse cx="52" cy="29" rx="4" ry="3" fill="#f5eadd"/><circle cx="38" cy="29" r="1.8" fill="#392f29"/><circle cx="52" cy="29" r="1.8" fill="#392f29"/><path d="M45 30L43 36L47 36" fill="none" stroke="#c68d79" stroke-width="1.6" stroke-linecap="round"/><path d="M38 41Q45 46 52 41" fill="none" stroke="#8d6253" stroke-width="1.5" stroke-linecap="round"/><path d="M35 53Q45 63 55 53" fill="none" stroke="#eee8d6" stroke-width="2"/><rect x="25" y="135" width="18" height="7" rx="3" fill="#293c38"/><rect x="48" y="135" width="18" height="7" rx="3" fill="#293c38"/><path d="M26 142H42M49 142H65" stroke="#dfddce" stroke-width="2"/></svg>`;
}

export function mountAppearance(root){
 if(!root)return;
 const withGolf=root.hasAttribute('data-golf-appearance');
 const style=document.createElement('style'),wrap=document.createElement('div');
 style.textContent=styles;wrap.className='lab-avatar';
 const previews=document.createElement('div'),avatar=document.createElement('div'),controls=document.createElement('div');
 previews.className='lab-avatar-previews';controls.className='lab-avatar-controls';
 previews.append(figure('Personaggio',avatar));wrap.append(previews,controls);root.append(style,wrap);
 let outfit=readAppearance(),golf=readGolfStyle(),backpack=false;
 function chooseOutfit(part,color){
  outfit={...outfit,[part]:color};save(OUTFIT_KEY,outfit);paint();
  window.dispatchEvent(new CustomEvent('labyrinth:appearance'));
 }
 const shirt=swatches(controls,'Maglietta',color=>chooseOutfit('shirt',color));
 const shorts=swatches(controls,'Pantaloncini',color=>chooseOutfit('shorts',color));
 const ball=document.createElement('span'),toggle=document.createElement('input'),separate=document.createElement('div');
 let ballTop,ballBottom;
 if(withGolf){
  ball.className='lab-avatar-ball';ball.id='golf-ball-preview';ball.setAttribute('aria-hidden','true');
  previews.append(figure('Pallina',ball));
  const label=document.createElement('label');label.className='lab-golf-toggle';
  toggle.type='checkbox';toggle.id='golf-ball-separate';
  separate.id='golf-ball-colors';separate.className='lab-golf-colors';
  toggle.setAttribute('aria-controls',separate.id);
  label.append(toggle,'Colori separati per la pallina');
  controls.append(label,separate);
  toggle.onchange=()=>{
   golf={separate:toggle.checked,colors:golf.colors??golfColors(outfit,golf)};
   save(BALL_STYLE_KEY,golf);paint();
  };
  const chooseBall=(part,color)=>{
   const colors=[...golfColors(outfit,golf)];colors[part]=color;
   golf={separate:true,colors};save(BALL_STYLE_KEY,golf);paint();
  };
  ballTop=swatches(separate,'Pallina · Sopra',color=>chooseBall(0,color));
  ballBottom=swatches(separate,'Pallina · Sotto',color=>chooseBall(1,color));
 }
 function paint(){
  avatar.innerHTML=avatarSVG(outfit,backpack);
  shirt(outfit.shirt);shorts(outfit.shorts);
  if(withGolf){
   const [top,bottom]=golfColors(outfit,golf);
   ball.style.setProperty('--ball-top',top);ball.style.setProperty('--ball-bottom',bottom);
   toggle.checked=golf.separate;separate.hidden=!golf.separate;
   if(golf.separate){ballTop(top);ballBottom(bottom);}
  }
 }
 paint();
 window.addEventListener('labyrinth:equipment',e=>{backpack=e.detail?.backpack===true;paint();});
 window.addEventListener('storage',e=>{
  if(e.key===null||[OUTFIT_KEY,BALL_STYLE_KEY,BALL_KEY].includes(e.key)){
   outfit=readAppearance();golf=readGolfStyle();paint();
  }
 });
}
for(const root of document.querySelectorAll('[data-labyrinth-avatar]'))mountAppearance(root);

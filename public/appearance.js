export const CLOTHES=[['Panna','#eee4c9'],['Giallo','#e5be43'],['Arancio','#d6813c'],['Corallo','#cf514d'],['Rosa','#d58da9'],['Viola','#8662b1'],['Celeste','#66b8cf'],['Blu','#3c62a3'],['Verde','#529766'],['Antracite','#333b42']];
export const OUTFIT_KEY='labyrinth-appearance', BALL_STYLE_KEY='binotto-golf-style';
export const BALL_KEY='binotto-golf-ball';
const isCloth=color=>CLOTHES.some(([,value])=>value===color);

function read(key){
  try{return JSON.parse(localStorage.getItem(key));}catch{return null;}
}

// Personaggio della Lobby 3D (a blocchi, fatto in Blender): oltre a maglietta (felpa) e pantaloncini (pantaloni)
// si scelgono il colore dei dettagli (lacci, righe, scarpe), dei capelli e della pelle. Stanno nello stesso salvataggio.
export const ACCENTS=[['Rosso','#d62828'],['Bianco','#f2f0ea'],['Giallo','#f2c230'],['Arancio','#ef7d22'],['Rosa','#e36aa5'],['Viola','#8a5ad6'],['Azzurro','#3cc4e6'],['Blu','#2f5fd0'],['Verde','#36b25a'],['Nero','#1d1f23']];
export const HAIRS=[['Castano','#4a2a17'],['Nero','#1c1612'],['Biondo','#c9a256'],['Rame','#8e3b1f'],['Grigio','#8a8a86'],['Blu','#2d5fa8'],['Rosa','#d56fa0']];
export const SKINS=[['Chiara','#f1c7a5'],['Rosata','#e9b393'],['Media','#d79a6b'],['Olivastra','#b77b4c'],['Scura','#8d5a3b'],['Molto scura','#5e3a26']];
const listed=(list,color,fallback)=>list.some(([,value])=>value===color)?color:fallback;
export function readLook(){
  const raw=read(OUTFIT_KEY);
  return {...normalizeAppearance(raw),...normalizeStyle(raw)};
}
export function normalizeStyle(raw){
  return {accent:listed(ACCENTS,raw?.accent,ACCENTS[0][1]),hair:listed(HAIRS,raw?.hair,HAIRS[0][1]),skin:listed(SKINS,raw?.skin,SKINS[2][1])};
}

export function readAppearance(){
  return normalizeAppearance(read(OUTFIT_KEY));
}

export function normalizeAppearance(outfit){
  return {
    shirt:isCloth(outfit?.shirt)?outfit.shirt:CLOTHES[6][1],
    shorts:isCloth(outfit?.shorts)?outfit.shorts:CLOTHES[7][1]
  };
}

export function validBallColors(colors) {
  return Array.isArray(colors) && colors.length===2 &&
    colors.every(color => typeof color==='string' && /^#[0-9a-f]{6}$/i.test(color));
}

export function readGolfStyle(){
  const style=read(BALL_STYLE_KEY),colors=style?.colors??read(BALL_KEY);
  return {separate:style?.separate===true,colors:validBallColors(colors)?colors:null};
}

export function golfColors(outfit=readAppearance(),style=readGolfStyle()){
  return style.separate&&style.colors ? style.colors : [outfit.shirt,outfit.shorts];
}

export const CLOTHES=[['Panna','#eee4c9'],['Giallo','#e5be43'],['Arancio','#d6813c'],['Corallo','#cf514d'],['Rosa','#d58da9'],['Viola','#8662b1'],['Celeste','#66b8cf'],['Blu','#3c62a3'],['Verde','#529766'],['Antracite','#333b42']];
export const OUTFIT_KEY='labyrinth-appearance', BALL_STYLE_KEY='binotto-golf-style';
export const BALL_KEY='binotto-golf-ball';
const isCloth=color=>CLOTHES.some(([,value])=>value===color);

function read(key){
  try{return JSON.parse(localStorage.getItem(key));}catch{return null;}
}

export function readAppearance(){
  const outfit=read(OUTFIT_KEY);
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

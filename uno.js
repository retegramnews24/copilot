export const UNO_COLORS=['red','yellow','green','blue'];
function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export function initialUno(count=0,rng=random){
 const cards=[];for(const color of UNO_COLORS)for(const value of ['0',...Array.from({length:9},(_,i)=>String(i+1)), 'skip','reverse','draw2'])for(let i=0;i<(value==='0'?1:2);i++)cards.push({id:cards.length,color,value});
 for(const value of ['wild','wild4'])for(let i=0;i<4;i++)cards.push({id:cards.length,color:null,value});shuffle(cards,rng);
 const hands=Array.from({length:count},()=>cards.splice(0,7)),top=cards.splice(cards.findIndex(c=>/^\d$/.test(c.value)),1)[0];
 return {hands,deck:cards,discard:[top],color:top.color,turn:0,direction:1,drawn:null,result:null,reason:'',winner:null,dry:0,lastEvent:'Partita pronta'};
}
function take(g,seat,n,rng){let count=0;for(let i=0;i<n;i++){if(!g.deck.length&&g.discard.length>1){const top=g.discard.pop();g.deck=shuffle(g.discard,rng);g.discard=[top]}if(!g.deck.length)break;g.hands[seat].push(g.deck.pop());count++}return count}
function legal(g,c,seat){const top=g.discard.at(-1);if(c.value==='wild4')return !g.hands[seat].some(k=>k.color===g.color);return !c.color||c.color===g.color||c.value===top.value}
export function unoView(g,seat=-1){const hand=g.hands[seat]||[];return {hand,counts:g.hands.map(h=>h.length),top:g.discard.at(-1),color:g.color,direction:g.direction,turn:g.turn,result:g.result,reason:g.reason,winner:g.winner,lastEvent:g.lastEvent,legalMoves:seat===g.turn&&!g.result?hand.filter(c=>(g.drawn===null||c.id===g.drawn)&&legal(g,c,seat)).map(c=>c.id):[],canDraw:seat===g.turn&&!g.result&&g.drawn===null,canPass:seat===g.turn&&!g.result&&g.drawn!==null};}
export function playUno(state,seat,action,rng=random){
 if(state.result||seat!==state.turn||!state.hands[seat])throw Error('Non è il tuo turno.');
 const g=structuredClone(state),n=g.hands.length,next=(steps=1)=>(seat+g.direction*steps+n*3)%n;
 if(action.kind==='draw'){
  if(g.drawn!==null)throw Error('Hai già pescato.');const count=take(g,seat,1,rng),card=g.hands[seat].at(-1);g.lastEvent='Pesca una carta';g.dry=count?0:g.dry+1;
  if(count&&legal(g,card,seat)){g.drawn=card.id}else{g.drawn=null;g.turn=next()}if(g.dry>=n){g.result='1/2-1/2';g.reason='Patta · nessuna carta disponibile'}return g;
 }
 if(action.kind==='pass'){if(g.drawn===null)throw Error('Devi pescare o giocare.');g.drawn=null;g.turn=next();g.lastEvent='Passa dopo aver pescato';return g}
 if(action.kind!=='play')throw Error('Azione non valida.');const index=g.hands[seat].findIndex(c=>c.id===action.card),card=g.hands[seat][index];
 if(!card||g.drawn!==null&&g.drawn!==card.id||!legal(g,card,seat))throw Error('Carta non giocabile.');
 if(!card.color&&!UNO_COLORS.includes(action.color))throw Error('Scegli il colore.');
 g.hands[seat].splice(index,1);g.discard.push(card);g.color=card.color||action.color;g.drawn=null;g.dry=0;
 const names={skip:'Stop',reverse:'Inverti',draw2:'+2',wild:'Cambio colore',wild4:'+4'};g.lastEvent='Gioca '+(names[card.value]||card.value)+' · '+({red:'Rosso',yellow:'Giallo',green:'Verde',blue:'Blu'}[g.color]);
 if(card.value==='reverse'){g.direction*=-1;g.turn=n===2?seat:next()}else if(card.value==='skip')g.turn=next(2);else if(['draw2','wild4'].includes(card.value)){take(g,next(),card.value==='draw2'?2:4,rng);g.turn=next(2)}else g.turn=next();
 if(g.hands[seat].length===1)g.lastEvent+=' · UNO!';if(!g.hands[seat].length){g.winner=seat;g.result='win';g.reason='Vince il giocatore '+(seat+1)}return g;
}

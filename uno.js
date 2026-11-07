import {random,shuffled} from './table-random.js';

export const UNO_COLORS=['red','yellow','green','blue'];
const TARGET=500;
const points=card=>card.color===null?50:/^\d$/.test(card.value)?Number(card.value):20;
const step=(g,seat,distance=1)=>(seat+g.direction*distance+g.hands.length)%g.hands.length;

function deal(g,rng){
 const cards=[];
 for(const color of UNO_COLORS)for(const value of ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2']){
  for(let i=0;i<(value==='0'?1:2);i++)cards.push({id:cards.length,color,value});
 }
 for(const value of ['wild','wild4'])for(let i=0;i<4;i++)cards.push({id:cards.length,color:null,value});
 g.deck=shuffled(cards,rng);
 g.hands=g.scores.map(()=>g.deck.splice(0,7));
 const top=g.deck.splice(g.deck.findIndex(c=>c.value!=='wild4'),1)[0];
 Object.assign(g,{discard:[top],color:top.color,direction:1,openingWild:false,drawn:null,callout:null,penalty:null,reveal:null,dry:0});
 if(!g.hands.length)return;
 const first=step(g,g.dealer);
 g.turn=first;
 if(top.value==='wild')g.openingWild=true;
 if(top.value==='skip')g.turn=step(g,first);
 if(top.value==='reverse'){g.direction=-1;g.turn=g.dealer}
 if(top.value==='draw2'){take(g,first,2,rng);g.turn=step(g,first)}
}
export function initialUno(count=0,rng=random){
 if(count&&(count<2||count>10||!Number.isInteger(count)))throw Error('UNO: servono da 2 a 10 giocatori.');
 const g={scores:Array(count).fill(0),dealer:count?Math.floor(rng()*count):0,round:1,turn:0,result:null,reason:'',winner:null,lastEvent:'Partita pronta'};
 deal(g,rng);
 return g;
}
function take(g,seat,n,rng){
 let count=0;
 for(let i=0;i<n;i++){
  if(!g.deck.length&&g.discard.length>1){const top=g.discard.pop();g.deck=shuffled(g.discard,rng);g.discard=[top]}
  if(!g.deck.length)break;
  g.hands[seat].push(g.deck.pop());count++;
 }
 return count;
}
function matches(g,c){return !c.color||c.color===g.color||c.value===g.discard.at(-1).value}
function endRound(g,seat,rng){
 const award=g.hands.flat().reduce((total,card)=>total+points(card),0);
 g.scores[seat]+=award;
 g.lastEvent='Manche '+g.round+' · giocatore '+(seat+1)+' +'+award+' punti';
 if(g.scores[seat]>=TARGET){
  g.winner=seat;g.result='win';g.reason='Traguardo di 500 punti';
 }else{
  g.round++;g.dealer=(g.dealer+1)%g.hands.length;
  deal(g,rng);g.lastEvent+=' · nuova manche';
 }
}
export function unoView(g,seat=-1){
 const hand=g.hands[seat]||[],active=seat===g.turn&&!g.result&&!g.penalty&&!g.openingWild;
 return {hand,counts:g.hands.map(h=>h.length),scores:g.scores||g.hands.map(()=>0),round:g.round||1,top:g.discard.at(-1),color:g.color,direction:g.direction,turn:g.turn,result:g.result,reason:g.reason,winner:g.winner,lastEvent:g.lastEvent,
  legalMoves:active?hand.filter(c=>(g.drawn===null||c.id===g.drawn)&&matches(g,c)).map(c=>c.id):[],
  canDraw:active&&g.drawn===null,canPass:active&&g.drawn!==null,chooseColor:!g.result&&seat===g.turn&&g.openingWild===true,
  decidePenalty:!g.result&&g.penalty?.to===seat,canDeclare:!g.result&&g.callout?.seat===seat,canCatch:!g.result&&seat>=0&&g.callout!=null&&g.callout.seat!==seat,
  shownHand:g.reveal?.to===seat?g.reveal.hand:[]};
}
export function playUno(state,seat,action,rng=random){
 if(state.result||!state.hands[seat])throw Error('Partita non attiva.');
 const g=structuredClone(state),n=g.hands.length;
 g.scores??=Array(n).fill(0);g.round??=1;g.dealer??=n-1;
 if(action.kind==='uno'||action.kind==='catch-uno'){
  const called=g.callout?.seat;
  if(called===undefined||(action.kind==='uno')!==(called===seat))throw Error('Chiamata UNO non disponibile.');
  if(action.kind==='catch-uno')take(g,called,2,rng);
  g.callout=null;g.lastEvent=action.kind==='uno'?'UNO!':'UNO dimenticato · +2 carte';return g;
 }
 if(seat!==g.turn)throw Error('Non è il tuo turno.');
 g.callout=null;g.reveal=null;
 if(g.openingWild){
  if(action.kind!=='color'||!UNO_COLORS.includes(action.color))throw Error('Scegli il colore iniziale.');
  g.color=action.color;g.openingWild=false;g.lastEvent='Colore iniziale scelto';return g;
 }
 if(g.penalty){
  if(!['accept-four','challenge-four'].includes(action.kind))throw Error('Accetta o contesta il +4.');
  const {by,illegal}=g.penalty,challenge=action.kind==='challenge-four';g.penalty=null;
  const reveal=challenge?{to:seat,hand:[...g.hands[by]]}:null;
  if(challenge&&illegal){take(g,by,4,rng);g.lastEvent='Contestazione riuscita · +4 al giocatore che l’ha calata'}
  else{
   take(g,seat,challenge?6:4,rng);g.turn=step(g,seat);
   if(!g.hands[by].length)endRound(g,by,rng);
   else g.lastEvent=challenge?'Contestazione respinta · +6 carte':'+4 carte · turno saltato';
  }
  g.reveal=reveal;return g;
 }
 if(action.kind==='draw'){
  if(g.drawn!==null)throw Error('Hai già pescato.');
  const count=take(g,seat,1,rng),card=g.hands[seat].at(-1);
  g.lastEvent='Pesca una carta';g.dry=count?0:g.dry+1;
  if(count&&matches(g,card))g.drawn=card.id;
  else{g.drawn=null;g.turn=step(g,seat)}
  if(g.dry>=n){g.result='1/2-1/2';g.reason='Patta · nessuna carta disponibile'}
  return g;
 }
 if(action.kind==='pass'){
  if(g.drawn===null)throw Error('Devi pescare o giocare.');
  g.drawn=null;g.turn=step(g,seat);g.lastEvent='Passa dopo aver pescato';return g;
 }
 if(action.kind!=='play')throw Error('Azione non valida.');
 const hand=g.hands[seat],index=hand.findIndex(c=>c.id===action.card),card=hand[index];
 if(!card||(g.drawn!==null&&g.drawn!==card.id)||!matches(g,card))throw Error('Carta non giocabile.');
 if(!card.color&&!UNO_COLORS.includes(action.color))throw Error('Scegli il colore.');
 const illegalFour=card.value==='wild4'&&hand.some(c=>c.color===g.color);
 hand.splice(index,1);g.discard.push(card);g.color=card.color||action.color;g.drawn=null;g.dry=0;
 const names={skip:'Stop',reverse:'Inverti',draw2:'+2',wild:'Cambio colore',wild4:'+4'};
 g.lastEvent='Gioca '+(names[card.value]||card.value);
 if(card.value==='reverse'){g.direction*=-1;g.turn=n===2?seat:step(g,seat)}
 else if(card.value==='skip')g.turn=step(g,seat,2);
 else if(card.value==='draw2'){take(g,step(g,seat),2,rng);g.turn=step(g,seat,2)}
 else g.turn=step(g,seat);
 if(hand.length===1){
  if(action.uno===true)g.lastEvent+=' · UNO!';
  else g.callout={seat};
 }
 if(card.value==='wild4'){g.penalty={by:seat,to:g.turn,illegal:illegalFour};return g}
 if(!hand.length)endRound(g,seat,rng);
 return g;
}

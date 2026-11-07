export const SUITS=['Coppe','Denari','Spade','Bastoni'];
export const DENARI=SUITS.indexOf('Denari');
export const ORDER=[1,3,10,9,8,7,6,5,4,2];
export const POINTS={1:11,3:10,10:4,9:3,8:2,7:0,6:0,5:0,4:0,2:0};
export const rankName=r=>({1:'Asso',8:'Fante',9:'Cavallo',10:'Re'}[r]||String(r));
export const cardName=c=>rankName(c.rank)+' di '+SUITS[c.suit];
export const makeDeck=()=>Array.from({length:40},(_,id)=>({id,suit:Math.floor(id/10),rank:id%10+1}));
export function trickWinner(trick,trump){const lead=trick[0].card.suit;let best=trick[0];for(const p of trick.slice(1)){const a=p.card,b=best.card;if(a.suit===b.suit?ORDER.indexOf(a.rank)<ORDER.indexOf(b.rank):a.suit===trump||b.suit!==trump&&a.suit===lead)best=p}return best.seat}

import {Chess} from 'chess.js';
import {playConnect4} from './connect4.js';
import {checkersKey,checkersMoves,playCheckers} from './checkers.js';
import {captures,primiera} from './scopa.js';
import {UNO_COLORS} from './uno.js';
import {playScarabeo} from './scarabeo.js';
import {SIZE,VALUES,premium} from './public/scarabeo-data.js';
import {randomFleet,SHIPS,shipCells} from './public/naval-data.js';
import {makeDeck,ORDER,POINTS,trickWinner,DENARI} from './public/briscola-data.js';

const MATE=100000;
const exhausted=Symbol('search budget exhausted');

// Iterative deepening always keeps the last fully evaluated move.
function search(root,engine,maxDepth,budget){
 let remaining=budget;
 const initial=engine.moves(root);
 let best=initial[0];
 if(initial.length<2)return best;
 function visit(state,depth,ply,alpha,beta){
  if(--remaining<0)throw exhausted;
  const result=engine.result(state,ply);
  if(result!==null)return result;
  if(depth===0)return engine.score(state);
  const moves=engine.moves(state);
  if(!moves.length)return engine.noMoves(state,ply);
  let bestScore=-Infinity;
  for(const move of moves){
   const score=-engine.follow(state,move,next=>visit(next,depth-1,ply+1,-beta,-alpha));
   bestScore=Math.max(bestScore,score);
   alpha=Math.max(alpha,score);
   if(alpha>=beta)break;
  }
  return bestScore;
 }
 let ordered=initial;
 for(let depth=1;depth<=maxDepth;depth++){
  let score=-Infinity,chosen=best;
  try{
   for(const move of ordered){
    const current=-engine.follow(root,move,next=>visit(next,depth-1,1,-Infinity,-score));
    if(current>score){score=current;chosen=move;}
   }
  }catch(error){
   if(error!==exhausted)throw error;
   break;
  }
  best=chosen;
  if(score>=MATE-depth)break;
  ordered=[best,...initial.filter(move=>move!==best)];
 }
 return best;
}

const pieceValue={p:100,n:320,b:335,r:505,q:930,k:0};
function chessPosition(game){
 const turn=game.turn();
 const pieces=game.board().flat().filter(Boolean);
 const endgame=pieces.reduce((total,piece)=>total+(piece.type==='p'?0:pieceValue[piece.type]),0)<2650;
 let score=0;
 for(const piece of pieces){
  const file=piece.square.charCodeAt(0)-97,rank=Number(piece.square[1])-1;
  const advance=piece.color==='w'?rank:7-rank;
  const center=7-Math.abs(file-3.5)-Math.abs(rank-3.5);
  let position=0;
  switch(piece.type){
   case 'p':position=advance*6+(file===3||file===4?advance*4:0);break;
   case 'n':position=center*12;break;
   case 'b':position=center*6+advance*3;break;
   case 'r':position=advance===6?24:advance*2;break;
   case 'q':position=center*2-(endgame?0:Math.max(0,advance-1)*4);break;
   case 'k':position=endgame?center*10:(advance===0&&[1,2,6].includes(file)?32:-center*8);break;
  }
  score+=(piece.color===turn?1:-1)*(pieceValue[piece.type]+position);
 }
 return score;
}
const chessPriority=move=>(move.promotion?800:0)+(move.captured?10*pieceValue[move.captured]-pieceValue[move.piece]:0)+(/[+#]/.test(move.san)?40:0);
export function strongChess(view){
 const engine={
  moves:game=>game.moves({verbose:true}).sort((a,b)=>chessPriority(b)-chessPriority(a)),
  score:chessPosition,
  result:(game,ply)=>game.isCheck()&&game.isCheckmate()?-MATE+ply:
   game.isInsufficientMaterial()||game.isDrawByFiftyMoves()||game.isThreefoldRepetition()?0:null,
  noMoves:(game,ply)=>game.isCheck()?-MATE+ply:0,
  follow:(game,move,visit)=>{
   game.move(move);
   try{return visit(game);}finally{game.undo();}
  }
 };
 let game=new Chess(view.fen);
 if(view.moves?.length){
  const history=new Chess();
  try{
   for(const move of view.moves)history.move(move.san);
   if(history.fen()===view.fen)game=history;
  }catch{}
 }
 const move=search(game,engine,3,1350);
 return move?{from:move.from,to:move.to,promotion:move.promotion||'q'}:null;
}

const c4Order=[3,2,4,1,5,0,6];
const c4Windows=[];
for(let row=0;row<6;row++)for(let col=0;col<7;col++)for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
 const endRow=row+3*dr,endCol=col+3*dc;
 if(endRow<6&&endCol>=0&&endCol<7)c4Windows.push(Array.from({length:4},(_,i)=>(row+i*dr)*7+col+i*dc));
}
function connect4Score({board,turn}){
 let score=0;
 for(let i=3;i<42;i+=7)if(board[i]!==null)score+=board[i]===turn?6:-6;
 for(const cells of c4Windows){
  let own=0,enemy=0,playable=false;
  for(const i of cells){
   if(board[i]===null)playable||=i>=35||board[i+7]!==null;
   else if(board[i]===turn)own++;
   else enemy++;
  }
  if(own&&enemy)continue;
  const count=own||enemy;
  const weight=count===3?(playable?95:23):count===2?(playable?11:5):count;
  score+=own?weight:-weight;
 }
 return score;
}
export function strongConnect4(view){
 const engine={
  moves:state=>c4Order.filter(column=>state.legalMoves.includes(column)),
  score:connect4Score,
  result:(state,ply)=>state.result?(state.winning.length?-MATE+ply:0):null,
  noMoves:()=>0,
  follow:(state,move,visit)=>visit(playConnect4(state,move))
 };
 const column=search(view,engine,7,7000);
 return column===undefined?null:{column};
}

function checkerPosition({board,turn}){
 let score=0;
 for(const [square,piece] of Object.entries(board)){
  const owner=piece===piece.toUpperCase()?0:1;
  const row=Number(square[1]),file=square.charCodeAt(0)-97;
  const advance=owner===0?row-1:8-row;
  const center=7-Math.abs(file-3.5)-Math.abs(row-4.5);
  const value=piece.toLowerCase()==='k'?305+center*8:100+advance*7+center*4+(advance===0?8:0);
  score+=(owner===turn?1:-1)*value;
 }
 return score;
}
export function strongCheckers(view){
 const positions=new Map(Object.entries(view.positions||{}));
 const engine={
  moves:state=>checkersMoves(state.board,state.turn),
  score:state=>checkersMoves(state.board,state.turn).length?checkerPosition(state):-MATE+6,
  result:state=>state.quiet>=80||(positions.get(checkersKey(state))||0)>=3?0:null,
  noMoves:(_state,ply)=>-MATE+ply,
  follow:(state,move,visit)=>{
   const next=playCheckers(state,move.path).game;
   const key=checkersKey(next),previous=positions.get(key)||0;
   positions.set(key,previous+1);
   try{return visit(next);}finally{
    if(previous)positions.set(key,previous);else positions.delete(key);
   }
  }
 };
 const move=search(view,engine,5,2400);
 return move?{path:move.path}:null;
}

function highest(items,score){
 let best=null,bestValue=-Infinity;
 for(const item of items){
  const value=score(item);
  if(value>bestValue){best=item;bestValue=value;}
 }
 return best;
}
const navalLayouts=Array.from(new Set(SHIPS.map(ship=>ship.length)),length=>({
 length,cells:Array.from({length:100},(_,cell)=>[shipCells(cell,length),shipCells(cell,length,true)]).flat().filter(Boolean)
}));
export function strongNaval(view,seat){
 if(view.phase==='placement')return {kind:'deploy',fleet:randomFleet()};
 const shots=view.shots[seat];
 const tried=new Set(shots.map(shot=>shot.cell));
 const sunk=new Set(shots.flatMap(shot=>shot.sunkCells||[]));
 const blocked=new Set([...sunk,...shots.filter(shot=>!shot.hit).map(shot=>shot.cell)]);
 const hits=new Set(shots.filter(shot=>shot.hit&&!sunk.has(shot.cell)).map(shot=>shot.cell));
 const density=Array(100).fill(0),target=Array(100).fill(0);
 for(const {length,cells:placements} of navalLayouts){
  const remaining=SHIPS.filter(ship=>ship.length===length).length-shots.filter(shot=>shot.sunkCells?.length===length).length;
  if(!remaining)continue;
  for(const cells of placements){
   if(cells.some(cell=>blocked.has(cell)))continue;
   const matches=cells.filter(cell=>hits.has(cell)).length;
   for(const cell of cells)if(!tried.has(cell)){
    density[cell]+=remaining;
    if(matches)target[cell]+=remaining*matches**3;
   }
  }
 }
 const cell=highest(Array.from({length:100},(_,i)=>i).filter(i=>!tried.has(i)),i=>target[i]*1000+density[i]+Math.random()*.1);
 return cell===null?null:{kind:'fire',cell};
}

export function strongUno(view,seat){
 const {hand,counts,direction}=view,n=counts.length;
 const legal=hand.filter(card=>view.legalMoves.includes(card.id)&&(card.value!=='wild4'||!hand.some(other=>other.color===view.color)));
 if(!legal.length)return {kind:view.canPass?'pass':'draw'};
 const next=(seat+direction+n)%n,previous=(seat-direction+n)%n;
 const threat=player=>Math.max(0,5-counts[player]);
 const choices=legal.flatMap(card=>(card.color?[card.color]:UNO_COLORS).map(color=>({card,color})));
 const choice=highest(choices,({card,color})=>{
  const rest=hand.filter(other=>other.id!==card.id);
  if(!rest.length)return 1000;
  const matching=rest.filter(other=>other.color===color).length;
  const follow=rest.filter(other=>other.value==='wild4'?matching===0:!other.color||other.color===color||other.value===card.value).length;
  const retainsTurn=n===2&&['skip','reverse','draw2','wild4'].includes(card.value);
  if(retainsTurn&&rest.length===1&&follow)return 900;
  let score=matching*1.5+follow*.65;
  if(!card.color)score-=rest.length>2?6:2;
  if(card.value==='skip')score+=2+threat(next)*2.5;
  if(card.value==='reverse')score+=n===2?2+threat(next)*2.5:(threat(next)-threat(previous))*2;
  if(card.value==='draw2'||card.value==='wild4')score+=3+threat(next)*3;
  if(retainsTurn)score+=follow?6:-2;
  return score;
 });
 return {kind:'play',card:choice.card.id,color:choice.color,uno:true};
}

// Only cards from this hand and cards already shown at the table are known.
function unseenCards(view,visible=[]){
 const known=new Set([...view.hand,...(view.seenCards||[]),...visible].map(card=>card.id));
 return makeDeck().filter(card=>!known.has(card.id));
}

export function strongScopa(view,seat){
 const next=(seat+1)%view.counts.length;
 const last=!view.deckCount&&view.counts.every((count,i)=>i===seat?count===1:!count);
 const unseen=unseenCards(view,view.table);
 const prize=card=>3+(card.suit===DENARI?3:0)+(card.rank===7&&card.suit===DENARI?24:0)+(primiera(card)-10)*.47;
 const danger=new Map();
 function replyRisk(table){
  const key=table.map(card=>card.id).join(',');
  if(danger.has(key))return danger.get(key);
  let total=0;
  const byId=new Map(table.map(card=>[card.id,card]));
  const ranks=new Map();
  for(const card of unseen){
   if(!ranks.has(card.rank))ranks.set(card.rank,captures(table,card.rank).reduce((best,ids)=>{
    const value=ids.reduce((sum,id)=>sum+prize(byId.get(id)),0);
    return Math.max(best,value+(ids.length===table.length?20:0));
   },0));
   const gain=ranks.get(card.rank);
   if(gain)total+=gain+prize(card)*.5;
  }
  const risk=unseen.length?total/unseen.length:0;
  danger.set(key,risk);
  return risk;
 }
 return highest(view.legalMoves,move=>{
  const card=view.hand.find(card=>card.id===move.card);
  const taken=view.table.filter(card=>move.take.includes(card.id));
  const remaining=view.table.filter(card=>!move.take.includes(card.id));
  if(!taken.length)remaining.push(card);
  const gain=taken.length?taken.reduce((sum,card)=>sum+prize(card),prize(card)):0;
  const sweep=taken.length&&!remaining.length&&!last?20:0;
  const exposure=last?0:replyRisk(remaining)*Math.max(1,view.counts[next])*.55;
  return gain+sweep-exposure-(taken.length?0:prize(card)*.8);
 });
}

const strength=rank=>ORDER.length-ORDER.indexOf(rank);
function strongestSuit(hand){
 const scores=Array(4).fill(0);
 for(const card of hand)scores[card.suit]+=2+strength(card.rank)*.8+POINTS[card.rank]*.35;
 return scores;
}
function allied(view,seat,other){
 if(seat===other)return true;
 if(view.counts.length===4)return (seat+2)%4===other;
 if(view.variant!=='called')return false;
 const callerSide=view.role==='Socio segreto'||seat===view.caller;
 if(other===view.caller||other===view.partner)return callerSide;
 return !callerSide&&view.partner!==null;
}
function briscolaEndgame(view,seat,opponentHand){
 const hands=seat===0?[view.hand,opponentHand]:[opponentHand,view.hand];
 function play(hands,turn,trick,card){
  const next=hands.map((hand,index)=>index===turn?hand.filter(other=>other.id!==card.id):hand);
  const played=[...trick,{seat:turn,card}];
  if(played.length===1)return solve(next,1-turn,played);
  const winner=trickWinner(played,view.trump);
  const points=played.reduce((sum,entry)=>sum+POINTS[entry.card.rank],0);
  return (winner===seat?points:-points)+solve(next,winner,[]);
 }
 function solve(hands,turn,trick){
  if(!hands[turn].length)return 0;
  const values=hands[turn].map(card=>play(hands,turn,trick,card));
  return turn===seat?Math.max(...values):Math.min(...values);
 }
 return highest(view.hand,card=>play(hands,seat,view.trick,card));
}
export function strongBriscola(view,seat){
 if(view.phase==='auction'){
  const power=Math.max(...strongestSuit(view.hand));
  const rank=ORDER[Math.min(ORDER.length-1,view.bid?ORDER.indexOf(view.bid.rank)+1:power>=30?5:3)];
  if(!view.bid)return {kind:'bid',rank,target:61};
  if(view.bid.rank!==2&&power>=15+ORDER.indexOf(rank)*2)return {kind:'bid',rank,target:61};
  return {kind:'bid-pass'};
 }
 if(view.phase==='call'){
  const suits=strongestSuit(view.hand);
  const call=highest(view.callOptions.flatMap(({suit,ranks})=>ranks.map(rank=>({kind:'call',suit,rank}))),option=>{
   const own=view.hand.some(card=>card.suit===option.suit&&card.rank===option.rank);
   return suits[option.suit]+(own?-13:strength(option.rank)*1.2);
  });
  return call;
 }
 const {hand,trick,trump,counts}=view;
 const unknown=unseenCards(view,[...trick.map(play=>play.card),...(view.bottomAvailable&&view.trumpCard?[view.trumpCard]:[])]);
 if(counts.length===2&&!view.deckCount&&unknown.length===counts[1-seat]){
  const card=briscolaEndgame(view,seat,unknown);
  return card?{kind:'play',card:card.id}:null;
 }
 const nextCount=counts.length-1-trick.length;
 const followers=Array.from({length:nextCount},(_,i)=>(seat+i+1)%counts.length);
 const samples=[];
 let seed=(hand.reduce((sum,card)=>sum*41+card.id+1,1)^unknown.length)>>>0;
 for(let sample=0;sample<(followers.length?24:1);sample++){
  const pool=[...unknown];
  const hands=followers.map(player=>{
   const cards=[];
   for(let i=0;i<counts[player]&&pool.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const index=Math.floor(seed/4294967296*pool.length);
    cards.push(pool[index]);pool[index]=pool.at(-1);pool.pop();
   }
   return cards;
  });
  samples.push(hands);
 }
 const best=highest(hand,card=>{
  let expected=0;
  for(const sample of samples){
   const played=[...trick,{seat,card}];
   for(const [index,player] of followers.entries()){
    const points=played.reduce((sum,play)=>sum+POINTS[play.card.rank],0);
    const choice=highest(sample[index],other=>{
     const winner=trickWinner([...played,{seat:player,card:other}],trump);
     const wins=winner===player||counts.length===4&&(player+2)%4===winner;
     const cost=POINTS[other.rank]*.6+strength(other.rank)*.24+(other.suit===trump?5:0);
     return wins?points+2-cost*.55:-cost;
    });
    if(choice)played.push({seat:player,card:choice});
   }
   const won=allied(view,seat,trickWinner(played,trump));
   const otherPoints=played.reduce((sum,play)=>sum+(play.seat===seat?0:POINTS[play.card.rank]),0);
   expected+=(won?otherPoints:-otherPoints)+(won?.42:-1)*POINTS[card.rank]+(won?1:0);
  }
  const trumpCost=card.suit===trump?2.2+strength(card.rank)*.55:0;
  const reserveCost=hand.length>1?strength(card.rank)*.32+trumpCost:0;
  return expected/samples.length-reserveCost;
 });
 return best?{kind:'play',card:best.id}:null;
}

export function strongWordMove(view,words){
 const {board,rack}=view;
 const first=!board.some(Boolean);
 const alphabet=Object.keys(VALUES).filter(letter=>letter!=='?');
 const initialRack=Object.fromEntries(alphabet.concat('?').map(letter=>[letter,rack.filter(tile=>tile.letter===letter).length]));
 const at=(row,col)=>row>=0&&row<SIZE&&col>=0&&col<SIZE?board[row*SIZE+col]:null;
 const candidates=[];
 for(const [direction,dr,dc] of [['horizontal',0,1],['vertical',1,0]]){
  const anchors=Object.fromEntries(alphabet.map(letter=>[letter,[]]));
  const crosses=[];
  for(let index=0;index<board.length;index++){
   const row=Math.floor(index/SIZE),col=index%SIZE;
   if(first){
    if(row===8&&col===8)for(const letter of alphabet)anchors[letter].push(index);
    continue;
   }
   const tile=board[index];
   if(tile){anchors[tile.letter].push(index);continue;}
   let before='',after='';
   for(let offset=1;at(row-offset*dc,col-offset*dr);offset++)before=at(row-offset*dc,col-offset*dr).letter+before;
   for(let offset=1;at(row+offset*dc,col+offset*dr);offset++)after+=at(row+offset*dc,col+offset*dr).letter;
   if(!before&&!after)continue;
   const permitted=new Set(alphabet.filter(letter=>words.has(before+letter+after)));
   crosses[index]={permitted,value:[...before+after].reduce((sum,letter)=>sum+VALUES[letter],0)};
   for(const letter of permitted)anchors[letter].push(index);
  }
  for(const word of words){
   if(word.length>SIZE)continue;
   const starts=new Set();
   for(let offset=0;offset<word.length;offset++)for(const anchor of anchors[word[offset]]||[]){
    const row=Math.floor(anchor/SIZE)-offset*dr,col=anchor%SIZE-offset*dc;
    if(row>=0&&col>=0&&row+word.length*dr<=SIZE&&col+word.length*dc<=SIZE)starts.add(row*SIZE+col);
   }
   for(const start of starts){
    const row=Math.floor(start/SIZE),col=start%SIZE;
    if(at(row-dr,col-dc)||at(row+word.length*dr,col+word.length*dc))continue;
    const hand={...initialRack};
    let added=0,main=0,multiplier=1,side=0,valid=true;
    for(let i=0;i<word.length;i++){
     const r=row+i*dr,c=col+i*dc,index=r*SIZE+c,letter=word[i],tile=board[index],cross=crosses[index];
     const bonus=premium(r,c),letterFactor=bonus==='2L'?2:bonus==='3L'?3:1;
     const wordFactor=bonus==='2P'?2:bonus==='3P'?3:1;
     main+=VALUES[letter]*letterFactor;
     multiplier*=wordFactor;
     if(tile){if(tile.letter!==letter){valid=false;break;}continue;}
     if(cross&&!cross.permitted.has(letter)){valid=false;break;}
     if(hand[letter])hand[letter]--;
     else if(hand['?'])hand['?']--;
     else {valid=false;break;}
     added++;
     if(cross)side+=(cross.value+VALUES[letter]*letterFactor)*wordFactor;
    }
    if(!valid||!added)continue;
    const estimate=main*multiplier+side+added*2+(added>=6?20:0);
    candidates.push({move:{kind:'place',word,row,col,direction},estimate});
   }
  }
 }
 candidates.sort((a,b)=>b.estimate-a.estimate);
 const fake={...view,racks:view.counts.map((_,seat)=>seat===view.turn?rack:[]),bag:[],passes:0,pending:null};
 let best=null,bestScore=-Infinity;
 for(const {move} of candidates.slice(0,32)){
  try{
   const {pending}=playScarabeo(fake,view.turn,move);
   const score=pending.score+pending.tiles.length*2;
   if(score>bestScore&&pending.words.every(word=>words.has(word))){best=move;bestScore=score;}
  }catch{}
 }
 return best;
}

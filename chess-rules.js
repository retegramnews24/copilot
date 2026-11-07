// FIDE Laws of Chess, articles 5 and 9.2–9.6.
const position=fen=>fen.split(' ').slice(0,4).join(' ');
const halfmoves=game=>Number(game.fen().split(' ')[4]);
const claimReason=game=>game.isThreefoldRepetition()?'Triplice ripetizione':halfmoves(game)>=100?'Regola delle 50 mosse':null;
const moveData=m=>({from:m.from,to:m.to,...(m.promotion?{promotion:m.promotion}:{})});

export function chessSnapshot(game,lastMove=null){
 if(game.isCheckmate())return finished(game,lastMove,game.turn()==='w'?'0-1':'1-0','Scaccomatto');
 const fen=game.fen(),history=game.history({verbose:true}),positions=new Map();
 if(history.length){
  positions.set(position(history[0].before),1);
  for(const move of history){
   const key=position(move.after);positions.set(key,(positions.get(key)||0)+1);
  }
 }
 const repetition=positions.get(position(fen))||1;
 const reason=game.isStalemate()?'Stallo':game.isInsufficientMaterial()?'Materiale insufficiente':repetition>=5?'Quintupla ripetizione':halfmoves(game)>=150?'Regola delle 75 mosse':null;
 if(reason)return finished(game,lastMove,'1/2-1/2',reason);
 const legalMoves=game.moves({verbose:true});
 const claimMoves=legalMoves.flatMap(m=>{
  const eligible=(positions.get(position(m.after))||0)>=2||Number(m.after.split(' ')[4])>=100;
  return eligible?[{...moveData(m),san:m.san}]:[];
 });
 return {fen,check:game.isCheck(),result:null,reason:null,lastMove,legalMoves:legalMoves.map(moveData),claim:claimReason(game),claimMoves};
}
function finished(game,lastMove,result,reason){
 return {fen:game.fen(),check:game.isCheck(),result,reason,lastMove,legalMoves:[],claim:null,claimMoves:[]};
}
export function claimChessDraw(game,lastMove,move){
 let reason;
 if(move){
  game.move(move);
  reason=claimReason(game);
  game.undo();
 }else reason=claimReason(game);
 if(!reason)throw Error('La posizione non consente di reclamare la patta.');
 return finished(game,lastMove,'1/2-1/2',reason);
}

// Italian draughts: 12 men each, short kings, compulsory ranked captures.
// Movement/capture rules: https://www.fid.it/regolamenti/capo1.htm (arts. 2–6).
const files='abcdefgh';
const owner=p=>p===p.toUpperCase()?0:1;
const king=p=>p.toLowerCase()==='k';
const square=(x,y)=>x>=0&&x<8&&y>=1&&y<=8?files[x]+y:null;
const dirs=p=>king(p)?[-1,1]:[owner(p)===0?1:-1];
const crowns=(p,s)=>!king(p)&&Number(s[1])===(owner(p)===0?8:1);
export const squareNumber=s=>(8-Number(s[1]))*4+Math.floor(files.indexOf(s[0])/2)+1;
export function initialCheckers(){
 const board={};
 for(let y=1;y<=8;y++)for(let x=0;x<8;x++)if((x+y)%2===0&&(y<=3||y>=6))board[square(x,y)]=y<=3?'M':'m';
 return {board,turn:0,quiet:0};
}
export function checkersMoves(board,turn){
 const captures=[],quiet=[];
 function walk(b,at,p,path,taken,values){
  let extended=false;
  for(const dy of dirs(p))for(const dx of [-1,1]){
   const x=files.indexOf(at[0]),y=Number(at[1]),over=square(x+dx,y+dy),to=square(x+2*dx,y+2*dy),victim=b[over];
   if(!to||b[to]||!victim||owner(victim)===turn||taken.includes(over)||(!king(p)&&king(victim)))continue;
   extended=true;const next={...b};delete next[at];next[to]=p;
   const nextPath=[...path,to],nextTaken=[...taken,over],nextValues=[...values,king(victim)?1:0];
   if(crowns(p,to))captures.push({path:nextPath,captures:nextTaken,values:nextValues,king:king(p)});
   else walk(next,to,p,nextPath,nextTaken,nextValues);
  }
  if(!extended&&taken.length)captures.push({path,captures:taken,values,king:king(p)});
 }
 for(const [at,p] of Object.entries(board)){
  if(owner(p)!==turn)continue;walk(board,at,p,[at],[],[]);
  for(const dy of dirs(p))for(const dx of [-1,1]){const to=square(files.indexOf(at[0])+dx,Number(at[1])+dy);if(to&&!board[to])quiet.push({path:[at,to],captures:[]})}
 }
 if(!captures.length)return quiet;
 const score=m=>[m.captures.length,Number(m.king),m.values.reduce((a,b)=>a+b,0),...m.values];
 const compare=(a,b)=>{const x=score(a),y=score(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return 0};
 const best=captures.reduce((a,b)=>compare(a,b)>=0?a:b);
 return captures.filter(m=>compare(m,best)===0).map(({path,captures})=>({path,captures}));
}
export function playCheckers(game,path){
 if(!Array.isArray(path)||path.length<2||path.length>13||path.some(s=>typeof s!=='string'||!/^([a-h])([1-8])$/.test(s)))throw Error('Mossa non valida.');
 const move=checkersMoves(game.board,game.turn).find(m=>m.path.length===path.length&&m.path.every((s,i)=>s===path[i]));
 if(!move)throw Error('Mossa non consentita: rispetta le prese obbligatorie e le precedenze.');
 const board={...game.board},from=path[0],to=path.at(-1),p=board[from],promoted=crowns(p,to);
 delete board[from];for(const s of move.captures)delete board[s];board[to]=promoted?(game.turn===0?'K':'k'):p;
 const next={board,turn:1-game.turn,quiet:move.captures.length||!king(p)?0:(game.quiet||0)+1};
 return {game:next,move:{from,to,path:[...path],captures:move.captures,promoted,san:path.map(squareNumber).join(move.captures.length?'x':'-')}};
}
export function checkersKey(game){return game.turn+':'+Object.keys(game.board).sort().map(s=>s+game.board[s]).join(',')}
export function checkersSnapshot(game,lastMove=null,repetitions=1){
 const legalMoves=checkersMoves(game.board,game.turn);let result=null,reason=null;
 if(!legalMoves.length){result=game.turn===0?'0-1':'1-0';reason=Object.values(game.board).some(p=>owner(p)===game.turn)?'Avversario senza mosse':'Tutte le pedine catturate'}
 // Club adaptations: automatic draws, without an arbiter or manual claim.
 else if(repetitions>=3){result='1/2-1/2';reason='Triplice ripetizione'}
 else if(game.quiet>=80&&Object.values(game.board).includes('K')&&Object.values(game.board).includes('k')){result='1/2-1/2';reason='40 mosse per parte senza prese o movimento di pedine'}
 return {...game,lastMove,result,reason,legalMoves:result?[]:legalMoves};
}

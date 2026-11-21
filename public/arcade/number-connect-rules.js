export const rows=6,cols=5,maxMoves=20000;
export const ranges={easy:4,medium:6,hard:9};
export const row=index=>Math.floor(index/cols);
export const col=index=>index%cols;
export const validLevel=level=>typeof level==='string'&&Object.hasOwn(ranges,level);
function nextTile(game){
  game.random=(game.random+0x6d2b79f5)>>>0;
  let value=game.random;
  value=Math.imul(value^(value>>>15),value|1);
  value^=value+Math.imul(value^(value>>>7),value|61);
  const random=((value^(value>>>14))>>>0)/4294967296;
  return 2**(1+Math.floor(random*ranges[game.level]));
}
function adjacent(a,b){
  return a!==b&&Math.abs(row(a)-row(b))<=1&&Math.abs(col(a)-col(b))<=1;
}
export function canMerge(game,from,to){
  return Number.isInteger(from)&&Number.isInteger(to)&&from>=0&&to>=0&&from<rows*cols&&to<rows*cols&&
    adjacent(from,to)&&game.board[from]===game.board[to];
}
export function hasMove(game){
  return game.board.some((value,index)=>[1,cols-1,cols,cols+1].some(offset=>
    value===game.board[index+offset]&&adjacent(index,index+offset)));
}
export function createNumberGame(seed,level){
  const game={seed,level,random:seed,board:[],score:0};
  game.board=Array.from({length:rows*cols},()=>nextTile(game));
  if(!hasMove(game))game.board[1]=game.board[0];
  return game;
}
export function mergeNumbers(game,from,to,combo){
  const sum=game.board[to]*2,column=col(from);
  game.board[to]=sum;
  for(let y=row(from);y>0;y--)game.board[y*cols+column]=game.board[(y-1)*cols+column];
  game.board[column]=nextTile(game);
  game.score+=sum*(combo?2:1);
  return row(to)<row(from)&&col(to)===column?to+cols:to;
}
export function replayNumberGame(run){
  if(!validLevel(run?.level)||!Number.isInteger(run.seed)||run.seed<0||run.seed>0xffffffff||
    !Array.isArray(run.moves)||run.moves.length>maxMoves)return null;
  const game=createNumberGame(run.seed,run.level);
  for(const [index,move] of run.moves.entries()){
    if(!Array.isArray(move)||move.length!==3)return null;
    const [from,to,delay]=move;
    if(!Number.isInteger(delay)||delay<0||delay>3000||!canMerge(game,from,to))return null;
    mergeNumbers(game,from,to,index>0&&delay<3000);
  }
  return game;
}

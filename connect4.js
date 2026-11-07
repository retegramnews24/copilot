export const ROWS=6,COLS=7;
export function initialConnect4(){return {board:Array(ROWS*COLS).fill(null),turn:0,result:null,reason:'',winning:[],lastMove:null,legalMoves:Array.from({length:COLS},(_,i)=>i)}}
export function playConnect4(state,column){
 if(state.result)throw Error('Partita conclusa.');
 if(!Number.isInteger(column)||column<0||column>=COLS)throw Error('Colonna non valida.');
 const board=[...state.board];let row=ROWS-1;while(row>=0&&board[row*COLS+column]!==null)row--;if(row<0)throw Error('Colonna piena.');
 const who=state.turn,at=row*COLS+column;board[at]=who;let winning=[];
 for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){const line=[at];for(const sign of [-1,1]){let x=column+dx*sign,y=row+dy*sign;while(x>=0&&x<COLS&&y>=0&&y<ROWS&&board[y*COLS+x]===who){line.push(y*COLS+x);x+=dx*sign;y+=dy*sign}}if(line.length>=4){winning=line;break}}
 const legalMoves=Array.from({length:COLS},(_,i)=>i).filter(c=>board[c]===null),result=winning.length?(who===0?'1-0':'0-1'):!legalMoves.length?'1/2-1/2':null;
 return {board,turn:1-who,result,reason:winning.length?(who===0?'Vince il Rosso':'Vince il Giallo'):result?'Patta · griglia piena':'',winning,lastMove:{row,column,player:who},legalMoves:result?[]:legalMoves};
}

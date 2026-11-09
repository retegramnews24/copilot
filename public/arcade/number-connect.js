import {rows,cols,row,col,validLevel,createNumberGame,replayNumberGame,canMerge,mergeNumbers,hasMove,maxMoves} from './number-connect-rules.js?v=1';

const grid=document.getElementById('grid'),difficulty=document.getElementById('difficulty');
const scoreLabel=document.getElementById('score'),recordLabel=document.getElementById('record');
const message=document.getElementById('message'),ranking=document.getElementById('ranking');
const embedded=window.parent!==window;
let game,moves,lastMerge,selected,pointer,finished,best,player,submitting=null;
const send=(type,data={})=>parent.postMessage({type:'number-connect:'+type,...data},location.origin);
const cells=Array.from({length:rows*cols},(_,index)=>{
  const cell=document.createElement('button');
  cell.type='button';cell.className='cell';cell.dataset.index=index;
  grid.append(cell);
  return cell;
});
const sessionKey=()=> 'binottoland-number-connect:save:'+player;
const pendingKey=()=> 'binottoland-number-connect:pending:'+player;
const deviceRecordKey=()=> 'binottoland-number-connect:'+game.level;
const recordKey=()=>deviceRecordKey()+(player==='local'?'':':'+player);
function read(key){
  try{return JSON.parse(localStorage.getItem(key));}catch{return null;}
}
function write(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));}catch{}
}
function draw(pulse=null){
  cells.forEach((cell,index)=>{
    const value=game.board[index];
    cell.textContent=value.toLocaleString('it-IT',{useGrouping:false});
    cell.style.backgroundColor='hsl('+((Math.log2(value)*47)%360)+' 63% 77%)';
    cell.setAttribute('aria-pressed',String(index===selected));
    cell.setAttribute('aria-label',value+', riga '+(row(index)+1)+', colonna '+(col(index)+1));
    cell.classList.remove('pulse');
  });
  if(pulse!==null){
    const cell=cells[pulse];cell.getBoundingClientRect();cell.classList.add('pulse');
  }
  scoreLabel.textContent=game.score.toLocaleString('it-IT');
  recordLabel.textContent=best.toLocaleString('it-IT');
}
const run=()=>({seed:game.seed,level:game.level,moves,lastMerge});
function save(){
  write(sessionKey(),run());
}
function sendPending(){
  if(!embedded||player==='local'||submitting!==null)return;
  const pending=read(pendingKey());
  if(!pending)return;
  submitting=pending.seed;
  ranking.textContent='Sincronizzo i punti…';
  send('score',{run:{seed:pending.seed,level:pending.level,moves:pending.moves}});
}
function finish(){
  if(player==='local')return;
  if(game.score>(read(pendingKey())?.points??0)){
    write(pendingKey(),{...run(),points:game.score});
  }
  sendPending();
}
function showGame(){
  difficulty.value=game.level;selected=null;pointer=null;
  best=Math.max(game.score,Number(read(recordKey()))||0,Number(read(deviceRecordKey()))||0);
  finished=!hasMove(game);
  message.textContent=finished?'Partita conclusa. Vuoi riprovare?':'';
  draw();
}
function restart(){
  if(!player||!validLevel(difficulty.value))return;
  game=createNumberGame(crypto.getRandomValues(new Uint32Array(1))[0],difficulty.value);
  moves=[];lastMerge=0;showGame();save();
}
function load(id){
  if(player===id)return;
  player=id;
  const saved=read(sessionKey()),restored=replayNumberGame(saved);
  if(restored){
    game=restored;moves=saved.moves;
    lastMerge=Number.isFinite(saved.lastMerge)?Math.min(Date.now(),saved.lastMerge):0;
    showGame();
  }else restart();
  sendPending();
}
function choose(index){
  if(!game||finished)return;
  if(index===selected){selected=null;draw();return;}
  if(selected===null||!canMerge(game,selected,index)){
    selected=index;draw();return;
  }
  const now=Date.now(),delay=moves.length?Math.max(0,Math.min(3000,now-lastMerge)):3000;
  const combo=delay<3000,from=selected;
  const pulse=mergeNumbers(game,from,index,combo);
  moves.push([from,index,delay]);lastMerge=now;selected=null;
  if(game.score>best){best=game.score;write(recordKey(),best);}
  finished=!hasMove(game);
  message.textContent=finished?'Partita conclusa. Vuoi riprovare?':combo?'Combo ×2':'';
  if(finished&&moves.length<=maxMoves)finish();
  save();
  draw(pulse);
}
function indexOf(target){
  const cell=target?.closest('.cell');
  return cell&&grid.contains(cell)?Number(cell.dataset.index):null;
}
grid.addEventListener('pointerdown',event=>{
  const index=indexOf(event.target);
  if(!game||index===null||event.button!==0||pointer||finished)return;
  pointer={id:event.pointerId,index};
  grid.setPointerCapture(event.pointerId);
  cells[index].setAttribute('aria-pressed','true');
});
grid.addEventListener('pointerup',event=>{
  if(pointer?.id!==event.pointerId)return;
  const from=pointer.index,to=indexOf(document.elementFromPoint(event.clientX,event.clientY));
  pointer=null;
  if(to!==null&&to!==from){selected=from;choose(to);}
  else if(to===from)choose(from);
  else draw();
});
grid.addEventListener('lostpointercapture',event=>{
  if(pointer?.id===event.pointerId){pointer=null;draw();}
});
grid.addEventListener('click',event=>{
  if(event.detail===0){const index=indexOf(event.target);if(index!==null)choose(index);}
});
grid.addEventListener('keydown',event=>{
  const index=indexOf(event.target);
  if(index===null)return;
  const offset={ArrowLeft:col(index)>0?-1:0,ArrowRight:col(index)<cols-1?1:0,
    ArrowUp:row(index)>0?-cols:0,ArrowDown:row(index)<rows-1?cols:0}[event.key];
  if(offset===undefined)return;
  event.preventDefault();cells[index+offset].focus();
});
document.getElementById('start').onclick=restart;
difficulty.onchange=restart;
window.addEventListener('message',event=>{
  if(!embedded||event.origin!==location.origin||event.source!==parent)return;
  const data=event.data;
  if(data?.type==='number-connect:identity'){
    load(data.player||'local');return;
  }
  if(data?.type!=='number-connect:result'||data.seed!==submitting)return;
  submitting=null;
  if(data.ok){
    if(read(pendingKey())?.seed===data.seed)write(pendingKey(),null);
    ranking.textContent='Punteggio registrato in classifica.';
    sendPending();
  }else ranking.textContent='Punteggio in attesa di sincronizzazione.';
});
window.addEventListener('online',sendPending);
if(embedded)send('ready');
else load('local');

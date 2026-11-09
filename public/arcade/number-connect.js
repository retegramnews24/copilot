const grid=document.getElementById('grid');
const difficulty=document.getElementById('difficulty');
const scoreLabel=document.getElementById('score');
const recordLabel=document.getElementById('record');
const message=document.getElementById('message');
const rows=6,cols=5,ranges={easy:4,medium:6,hard:9};
let board=[],level,score,best,lastMerge,selected,pointer,finished;

const cells=Array.from({length:rows*cols},(_,index)=>{
  const cell=document.createElement('button');
  cell.type='button';
  cell.className='cell';
  cell.dataset.index=index;
  grid.append(cell);
  return cell;
});
const recordKey=()=> 'binottoland-number-connect:'+level;
const nextNumber=()=>2**(1+Math.floor(Math.random()*ranges[level]));
const row=index=>Math.floor(index/cols);
const col=index=>index%cols;
function adjacent(a,b){
  return a!==b&&Math.abs(row(a)-row(b))<=1&&Math.abs(col(a)-col(b))<=1;
}
function hasMove(){
  return board.some((value,index)=>board.some((other,target)=>target>index&&value===other&&adjacent(index,target)));
}
function draw(pulse=null){
  cells.forEach((cell,index)=>{
    const value=board[index];
    cell.textContent=value.toLocaleString('it-IT',{useGrouping:false});
    cell.style.backgroundColor='hsl('+((Math.log2(value)*47)%360)+' 63% 77%)';
    cell.setAttribute('aria-pressed',String(index===selected));
    cell.setAttribute('aria-label',value+', riga '+(row(index)+1)+', colonna '+(col(index)+1));
    cell.classList.remove('pulse');
  });
  if(pulse!==null){
    const cell=cells[pulse];
    cell.getBoundingClientRect();
    cell.classList.add('pulse');
  }
  scoreLabel.textContent=score.toLocaleString('it-IT');
  recordLabel.textContent=best.toLocaleString('it-IT');
}
function restart(){
  level=difficulty.value;
  board=cells.map(nextNumber);
  if(!hasMove())board[1]=board[0];
  score=0;best=0;lastMerge=-Infinity;selected=null;pointer=null;finished=false;
  try{best=Math.max(0,Number(localStorage.getItem(recordKey()))||0);}catch{}
  message.textContent='';
  draw();
}
function choose(index){
  if(finished)return;
  if(index===selected){selected=null;draw();return;}
  if(selected===null||!adjacent(selected,index)||board[selected]!==board[index]){
    selected=index;draw();return;
  }
  const from=selected,sum=board[index]*2;
  board[index]=sum;
  const column=col(from);
  for(let y=row(from);y>0;y--)board[y*cols+column]=board[(y-1)*cols+column];
  board[column]=nextNumber();
  const now=performance.now(),combo=now-lastMerge<3000;
  lastMerge=now;score+=sum*(combo?2:1);selected=null;
  if(score>best){
    best=score;
    try{localStorage.setItem(recordKey(),String(best));}catch{}
  }
  finished=!hasMove();
  message.textContent=finished?'Nessuna mossa rimasta. Vuoi riprovare?':combo?'Combo ×2':'';
  draw(row(index)<row(from)&&col(index)===column?index+cols:index);
}
function indexOf(target){
  const cell=target?.closest('.cell');
  return cell&&grid.contains(cell)?Number(cell.dataset.index):null;
}
grid.addEventListener('pointerdown',event=>{
  const index=indexOf(event.target);
  if(index===null||event.button!==0||pointer||finished)return;
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
  event.preventDefault();
  cells[index+offset].focus();
});
document.getElementById('start').onclick=restart;
difficulty.onchange=restart;
restart();

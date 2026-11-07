import { WIDTH, DEPTH, CUP, COLORS, rotorWall } from './courses.js';

const RAINBOW=['#ff8ba9','#ffbd78','#ffe27a','#79efbf','#72d4ff','#b69aff'];
export function viewFor(width,height){
  const s=Math.min((width-28)/(WIDTH+.67*DEPTH),(height-26)/(.23*WIDTH+.66*DEPTH));
  const scale=Math.max(1,s);
  const cx=width/2, cy=height/2;
  const point=(x,z,y=0)=>[cx+(x-WIDTH/2-.67*(z-DEPTH/2))*scale,
    cy+(.23*(x-WIDTH/2)+.66*(z-DEPTH/2)-y)*scale];
  const direction=(dx,dy)=>[(.66*dx+.67*dy)/.8141,(-.23*dx+dy)/.8141];
  return {point,direction,scale};
}

function polygon(c,points,color){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.closePath();c.fillStyle=color;c.fill();
}

function line(c,a,b,color,width){
  c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
}

function circle(c,x,y,r,color){
  c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
}

export function drawCourse(c,width,height,course,players,me,aim,power,clock){
  const {point:p,scale:s}=viewFor(width,height);
  const sky=c.createLinearGradient(0,0,0,height);
  sky.addColorStop(0,course.colors[2]);sky.addColorStop(1,'#1d3446');
  c.fillStyle=sky;c.fillRect(0,0,width,height);
  for(let i=0;i<42;i++){
    const x=(i*157+39)%width,y=(i*83+11)%height;
    circle(c,x,y,i%7===0?1.7:.8,'#e9fbff45');
  }
  const rect=(x,z,w,h,color)=>polygon(c,[p(x,z),p(x+w,z),p(x+w,z+h),p(x,z+h)],color);
  const corner=[p(0,0),p(WIDTH,0),p(WIDTH,DEPTH),p(0,DEPTH)];
  polygon(c,[corner[1],corner[2],p(WIDTH,DEPTH,-.8),p(WIDTH,0,-.8)],'#103a49');
  polygon(c,[corner[2],corner[3],p(0,DEPTH,-.8),p(WIDTH,DEPTH,-.8)],'#245366');
  rect(0,0,WIDTH,DEPTH,course.colors[0]);
  for(let x=0;x<WIDTH;x+=2)rect(x,0,1,DEPTH,'#ffffff11');
  for(const r of course.rough||[])rect(r.x,r.z,r.w,r.h,'#f6cf80');
  for(const r of course.water||[]){
    rect(r.x,r.z,r.w,r.h,'#236a9e');
    for(let z=r.z+.38;z<r.z+r.h;z+=.64){
      const shift=(Math.sin(z*3+clock*2)+1)*.21;
      line(c,p(r.x+.22+shift,z),p(r.x+r.w-.25,z),'#84e8ff7a',Math.max(1,s*.03));
    }
  }
  const rail=(a,b,height,color)=>{
    polygon(c,[p(...a),p(...b),p(...b,height),p(...a,height)],color);
    line(c,p(...a,height),p(...b,height),'#f9fff5a0',Math.max(1,s*.08));
  };
  rail([0,0],[WIDTH,0],.26,course.colors[1]);
  rail([0,0],[0,DEPTH],.26,course.colors[1]);
  for(const wall of course.walls)rail([wall.x,wall.z],[wall.toX,wall.toZ],.53,course.colors[1]);
  for(const [x,z,r] of course.bumpers||[]){
    const a=p(x,z,.31),b=p(x,z);
    circle(c,b[0],b[1],s*r*.75,'#ac457e');circle(c,a[0],a[1],s*r*.68,'#ff92c5');
    circle(c,a[0],a[1],s*r*.28,'#ffeed5');
  }
  const rotor=rotorWall(course,clock);
  if(rotor){
    rail([rotor.x,rotor.z],[rotor.toX,rotor.toZ],.35,'#d770ab');
    const [x,z]=course.rotor, a=p(x,z,.45);
    circle(c,a[0],a[1],s*.27,'#ffedc7');
  }
  rail([0,DEPTH],[WIDTH,DEPTH],.26,course.colors[1]);
  rail([WIDTH,0],[WIDTH,DEPTH],.26,course.colors[1]);
  for(let i=0;i<6;i++){
    const x=i*WIDTH/6;
    line(c,p(x,DEPTH+.02,-.18),p(x+WIDTH/6,DEPTH+.02,-.18),RAINBOW[i],Math.max(2,s*.14));
  }
  const tee=p(...course.tee),cup=p(...course.cup);
  c.beginPath();c.ellipse(...tee,s*.82,s*.44,.23,0,Math.PI*2);c.strokeStyle='#f4fff399';c.lineWidth=1.4;c.stroke();
  c.beginPath();c.ellipse(...cup,s*CUP,s*CUP*.63,.23,0,Math.PI*2);c.fillStyle='#19323b';c.fill();
  const pole=p(...course.cup,2.65);
  line(c,cup,pole,'#fff0df',Math.max(1,s*.08));
  for(let i=0;i<6;i++)polygon(c,[[pole[0],pole[1]+s*i*.14],[pole[0]+s*1.36,pole[1]+s*i*.1+.08*s],
    [pole[0]+s*1.36,pole[1]+s*(i+1)*.1+.08*s],[pole[0],pole[1]+s*(i+1)*.14]],RAINBOW[i]);

  if(me){
    const {x,z}=me, len=1.25+power*4.7, a=p(x,z,.3), b=p(x+Math.cos(aim)*len,z+Math.sin(aim)*len,.3);
    c.setLineDash([s*.19,s*.2]);line(c,a,b,'#fffbed',Math.max(2,s*.12));c.setLineDash([]);
    circle(c,...b,s*.14,'#fff5bf');
  }
  for(const ball of players){
    const foot=p(ball.x,ball.z),pos=p(ball.x,ball.z,.28),r=Math.max(3.4,s*.28);
    circle(c,foot[0]+r*.32,foot[1]+r*.2,r*.95,'#172c3860');
    circle(c,...pos,r,COLORS[ball.color]);circle(c,pos[0]-r*.28,pos[1]-r*.32,r*.34,'#fff9ea');
    if(ball.id===me?.id){c.strokeStyle='#fff5ca';c.lineWidth=1.3;c.beginPath();c.arc(...pos,r+2.5,0,Math.PI*2);c.stroke();}
  }
}

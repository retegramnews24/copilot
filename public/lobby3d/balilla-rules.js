// Metres; rows ordered from the red goal to the blue goal.
export const rows=[
  [0,0,1],[0,0,2],[1,1,3],[0,1,5],[1,1,5],[0,1,3],[1,0,2],[1,0,1]
].map(([team,attack,count],i)=>({team,attack,count,x:(i-3.5)*.143,spacing:count===2?.24:count===3?.204:.118,
  travel:count===1?.135:count===2?.208:count===3?.127:.096}));
export function newField(){
  return {ball:{x:0,z:0,vx:0,vz:0},score:[0,0],restart:"announce",defence:false,hold:.7,serve:1,finished:false,
    rods:rows.map(()=>({shift:0,angle:0,slide:0,turn:0}))};
}
export function simulate(field,dt){
  if(field.finished||field.restart)return;
  const ball=field.ball,radius=.017;
  if(field.hold>0){
    field.hold-=dt;
    if(field.hold<=0){ball.vx=(field.defence?-.42:.035)*field.serve;ball.vz=-.68*field.serve;if(!field.defence){ball.z=.30*field.serve;field.toRail=true}}
  }
  for(const [index,row] of rows.entries()){
    const rod=field.rods[index],old=rod.angle,previous=rod.shift;
    rod.shift+=Math.max(-dt*1.35,Math.min(dt*1.35,rod.slide*row.travel-rod.shift));
    rod.angle+=Math.max(-dt*13,Math.min(dt*13,rod.turn*1.12-rod.angle));
    const foot=row.x-.066*Math.sin(rod.angle);
    if(field.hold>0||field.toRail||Math.abs(ball.x-foot)>.04)continue;
    for(let n=0;n<row.count;n++){
      const z=(n-(row.count-1)/2)*row.spacing+rod.shift;
      const dx=ball.x-foot,dz=ball.z-z,d=Math.hypot(dx,dz);
      if(d>=.032)continue;
      const nx=d>.0001?dx/d:field.serve,nz=d>.0001?dz/d:0;
      const vx=-.075*(rod.angle-old)/dt,vz=(rod.shift-previous)/dt;
      const approach=(ball.vx-vx)*nx+(ball.vz-vz)*nz;
      if(approach<0){ball.vx-=1.82*approach*nx;ball.vz-=1.82*approach*nz}
      ball.x=foot+nx*.032;ball.z=z+nz*.032;
    }
  }
  if(field.hold>0)return;
  ball.x+=ball.vx*dt;ball.z+=ball.vz*dt;
  const drag=Math.exp(-.38*dt);ball.vx*=drag;ball.vz*=drag;
  if(Math.abs(ball.z)>.35-radius){ball.z=Math.sign(ball.z)*(.35-radius);ball.vz=-Math.sign(ball.z)*Math.abs(ball.vz)*.86;field.toRail=false}
  if(Math.abs(ball.x)>.565-radius){
    if(Math.abs(ball.z)<.094-radius){
      if(Math.abs(ball.x)<.583)return;
      const team=ball.x>0?0:1;field.score[team]++;field.finished=field.score[team]>=8;
      field.serve=team===0?-1:1;field.hold=.25;field.defence=false;field.restart='announce';Object.assign(ball,{x:0,z:0,vx:0,vz:0});
    }else{ball.x=Math.sign(ball.x)*(.565-radius);ball.vx=-Math.sign(ball.x)*Math.abs(ball.vx)*.87}
  }
  if(!field.finished&&field.hold<=0&&Math.hypot(ball.vx,ball.vz)<.035){field.serve=Math.abs(ball.x)>.071?(ball.x<0?1:-1):field.serve;field.defence=true;field.restart='announce';field.hold=.25;Object.assign(ball,{x:-.46*field.serve,z:0,vx:0,vz:0})}
}

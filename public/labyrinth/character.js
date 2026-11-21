// Model coordinates face -Z. Both cameras use these shoulder, elbow and wrist positions.
export function armPose(side,holding,swing,walk,firstPerson=false,guard=false,shield=false){
 const shoulder=[side*.235,1.27,firstPerson?.15:0];
 if(guard&&(side===-1||!swing)){
  const shieldArm=shield&&side===-1;
  return {shoulder,elbow:[side*.31,1.13,-.19],wrist:[side*(shieldArm?.19:.13),shieldArm?1.25:1.44,shieldArm?-.55:-.43]};
 }
 if(shield&&side===-1)return {shoulder,elbow:[-.31,1.0,-.085],wrist:[-.32,1.01,-.38]};
 const raised=holding&&side===1;
 const thrust=swing&&side===1?Math.sin(Math.PI*swing):0;
 const elbow=[side*(.29+.045*thrust),1.025+.11*thrust,raised?-.19-.19*thrust:-.04+walk*side];
 const wrist=raised
  ? [.35-.23*thrust,1.20+.10*thrust,-.46-.26*thrust]
  : [side*.29-.24*thrust,.79+.46*thrust,-.07-.53*thrust+walk*side*1.7];
 if(firstPerson){
  elbow[2]+=.045;
  if(!raised){wrist[1]+=.025;wrist[2]-=.14}
 }
 return {shoulder,elbow,wrist};
}
export const between=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*t);

export function limbModel(from,to){
 const axis=to.map((v,i)=>v-from[i]),length=Math.hypot(...axis);
 const y=axis.map(v=>v/length),r=Math.hypot(y[1],y[2]);
 const x=r>.001?[0,y[2]/r,-y[1]/r]:[0,1,0];
 const z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
 return new Float32Array([...x,0,...axis,0,...z,0,...from,1]);
}

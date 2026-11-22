// The socket holds the reservation. Storage holds the last confirmed placement.
const start = Array.from({length:12},(_,i)=>i<8
  ? {x:[9,11.6,14.4,17][i>>1],z:i%2?5.6:-5.6}
  : {x:i<10?-14.7:-11.3,z:i%2?1.9:-1.9});
export async function changeStool(ctx,ws,{id,action,x,z,height}){
  const a=ws.deserializeAttachment();
  if(!a.inClub||a.closed||!Number.isInteger(id)||!start[id])return;
  const layout=await ctx.storage.get('stools')??{};
  const at=layout[id]??start[id],p=a.clubPose;
  const reply=ok=>ws.send(JSON.stringify({type:'stool-result',ok,id,action}));
  if(action==='carry'||action==='sit'){
    const busy=ctx.getWebSockets().some(socket=>{
      const owner=socket.deserializeAttachment();
      return owner?.inClub&&!owner.closed&&owner.stool?.id===id;
    });
    if(a.stool||busy||p?.station!=='walk'||Math.hypot(p.x-at.x,p.z-at.z)>1.85)return reply(false);
    a.stool={id,action};
  }else{
    if(a.stool?.id!==id)return reply(false);
    if(action==='drop'&&a.stool.action==='carry'){
      if(!Number.isFinite(x)||!Number.isFinite(z)||!p||Math.hypot(x-p.x,z-p.z)>2.6)return reply(false);
      if(!(Math.abs(x)<6.8&&Math.abs(z)<18.1||Math.abs(x)<18.2&&Math.abs(z)<6))return reply(false);
      if(start.some((v,j)=>j!==id&&Math.hypot(x-(layout[j]??v).x,z-(layout[j]??v).z)<.48))return reply(false);
      layout[id]={...at,x,z};
    }else if(action==='stand'&&a.stool.action==='sit'){
      layout[id]={...at,height:Number.isFinite(height)?Math.max(-.12,Math.min(.26,height)):at.height??0};
    }else if(action!=='cancel')return reply(false);
    if(action!=='cancel')await ctx.storage.put('stools',layout);
    delete a.stool;
  }
  ws.serializeAttachment(a);reply(true);
}

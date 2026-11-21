import {rows,newField,simulate} from './public/lobby3d/balilla-rules.js';
export class BalillaHub{
  constructor(){this.viewers=new Map();this.mode=2;this.field=newField();this.timer=null}
  controls(member,row){
    return member.slot>=0 && row.team===Math.floor(member.slot/2) && (this.mode===2||row.attack===member.slot%2);
  }
  message(ws,id,b){
    if(b.action==='leave'){this.leave(ws);return}
    let member=this.viewers.get(ws);
    if(!member){
      if(b.action!=='watch')return;
      member={id,slot:-1};this.viewers.set(ws,member);this.send(ws,member);return;
    }
    if(b.action==='practice-sound'){
      const now=Date.now();
      if(this.timer||now-(member.lastSound??0)<110||!['kick','rail','goal'].includes(b.sound))return;
      member.lastSound=now;
      for(const [peer] of this.viewers)if(peer!==ws){try{peer.send(JSON.stringify({type:'balilla',sound:b.sound}))}catch{}}
      return;
    }
    if(b.action==='watch'){this.send(ws,member);return}
    if(b.action==='join'){
      if(member.slot>=0)return;
      const occupied=[...this.viewers.values()].filter(v=>v.slot>=0);
      if(!occupied.length){this.mode=b.mode===4?4:2;this.field=newField()}
      if(!Number.isInteger(b.slot)||b.slot<0||b.slot>3||(this.mode===2&&b.slot%2)||occupied.some(v=>v.slot===b.slot||v.id===id))return this.send(ws,member);
      if(b.mode!==this.mode)return this.send(ws,member);
      member.slot=b.slot;
      if(occupied.length+1===this.mode)this.start();
      this.broadcast();
    }else if(b.action==='ready' && member.slot>=0 && this.timer){
      const serving=(this.field.serve===1?0:1)===Math.floor(member.slot/2);
      if(serving && this.field.restart==='announce' && (this.mode===2||member.slot%2===(this.field.defence?0:1)))this.field.restart='confirm';
      else if(!serving && this.field.restart==='confirm')this.field.restart='';
      this.broadcast();
    }else if(b.action==='input' && member.slot>=0 && Number.isFinite(b.slide)&&[-1,0,1].includes(b.turn)){
      rows.forEach((row,i)=>{if(!this.controls(member,row))return;
        const rod=this.field.rods[i];
        if(this.mode===2 && (b.pair===0||b.pair===1) && row.attack!==b.pair){rod.turn=0;return}
        Object.assign(rod,{slide:Math.max(-1,Math.min(1,b.slide)),turn:b.turn*(row.team?1:-1)})});
    }else if(b.action==='again'&&member.slot>=0&&this.field.finished){this.field=newField();this.start();this.broadcast()}
  }
  start(){
    if(this.timer||[...this.viewers.values()].filter(v=>v.slot>=0).length!==this.mode)return;
    let last=Date.now(),carry=0;
    this.timer=setInterval(()=>{
      const now=Date.now();carry+=Math.min(.12,(now-last)/1000);last=now;
      while(carry>=1/120){simulate(this.field,1/120);carry-=1/120}
      if(this.field.finished)this.stop();this.broadcast();
    },50);
  }
  stop(){clearInterval(this.timer);this.timer=null}
  leave(ws){
    const member=this.viewers.get(ws);if(!member)return;
    this.viewers.delete(ws);
    if(member.slot>=0){this.stop();for(const [i,row] of rows.entries())if(this.controls(member,row))this.field.rods[i].turn=0}
    if(![...this.viewers.values()].some(v=>v.slot>=0))this.field=newField();
    this.broadcast();
  }
  send(ws,m){
    const occupied=[...this.viewers.values()].filter(v=>v.slot>=0).map(v=>v.slot);
    try{ws.send(JSON.stringify({type:'balilla',mode:this.mode,slot:m.slot,occupied,playing:!!this.timer,field:this.field}))}catch{}
  }
  broadcast(){for(const [ws,m] of this.viewers)this.send(ws,m)}
}

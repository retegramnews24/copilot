import * as THREE from 'three';
import {rows,newField,simulate} from './balilla-rules.js?v=a7fa00b1a8';

export function buildBalilla(scene,el,send,playSound){
  const table=new THREE.Group();table.position.set(-13,0,0);scene.add(table);
  const material=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness:metalness?.3:.56});
  const frame=material('#23384a'),chrome=material('#bccbd4',.82),rubber=material('#202228'),white=material('#fff1cc'),pitch=material('#207b63');
  const brass=material('#c7a16c',.7),sole=material('#17202c'),skin=material('#e0b390');
  const kits=[material('#ef4438'),material('#388cec')];
  function mesh(geo,mat,x,y,z,parent=table){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m}
  function box(w,h,d,m,x,y,z,parent){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent)}
  function cylinder(radius,length,m,x,y,z,parent){
    const c=mesh(new THREE.CylinderGeometry(radius,radius,length,16),m,x,y,z,parent);c.rotation.x=Math.PI/2;return c;
  }
  for(const x of [-.56,.56])for(const z of [-.29,.29]){
    box(.08,.59,.08,chrome,x,.31,z);box(.095,.03,.095,rubber,x,.016,z);
  }
  box(1.38,.17,.76,frame,0,.645,0);
  for(const sign of [-1,1]){
    box(1.34,.016,.013,brass,0,.585,.382*sign);
    box(.23,.072,.014,rubber,.35,.65,.382*sign);
    for(const x of [-.59,.59])box(.10,.20,.013,chrome,x,.675,.383*sign);
  }
  box(1.13,.014,.70,pitch,0,.733,0);
  for(const z of [-.365,.365]){box(1.38,.16,.03,frame,0,.82,z);box(1.38,.011,.034,chrome,0,.895,z)}
  for(const sign of [-1,1]){
    for(const z of [-.223,.223])box(.125,.16,.254,frame,sign*.627,.82,z);
    box(.018,.16,.19,rubber,sign*.682,.82,0);box(.12,.02,.19,chrome,sign*.627,.89,0);
    for(let n=0;n<8;n++)box(.012,.017,.02,kits[sign===1?1:0],sign*(.58+n*.011),.911,.25);
    box(1.08,.001,.003,white,0,.741,sign*.30);
    box(.003,.001,.60,white,.54*sign,.741,0);
    for(const z of [-.16,.16])box(.13,.001,.003,white,sign*.476,.742,z);
    box(.003,.001,.32,white,sign*.41,.742,0);
  }
  box(.003,.001,.60,white,0,.742,0);
  const circle=mesh(new THREE.RingGeometry(.076,.079,48),white,0,.742,0);circle.rotation.x=-Math.PI/2;
  const sticks=rows.map(row=>{
    const dir=row.team?-1:1, group=new THREE.Group();table.add(group);group.position.set(row.x,.818,0);
    for(const side of [-1,1]){
      cylinder(.022,.025,brass,row.x,.818,side*.382);
      cylinder(.014,.032,rubber,row.x,.818,side*.362);
    }
    cylinder(.009,.81,chrome,row.x,.818,0);
    cylinder(.009,.50,chrome,0,0,dir*.23,group);
    cylinder(.019,.105,rubber,0,0,dir*.49,group);
    for(let n=0;n<6;n++)cylinder(.020,.004,sole,0,0,dir*(.45+n*.015),group);
    for(let n=0;n<row.count;n++){
      const z=(n-(row.count-1)/2)*row.spacing;
      mesh(new THREE.SphereGeometry(.017,12,10),skin,0,.025,z,group);
      box(.032,.046,.034,kits[row.team],0,-.009,z,group);
      box(.035,.012,.035,white,0,-.031,z,group);
      box(.024,.04,.024,kits[row.team],0,-.048,z,group);
      box(.03,.016,.029,sole,0,-.066,z,group);
    }return group;
  });
  const training=newField();
  let lastPracticeHit=0,lastRemoteHit=null,lastBeat=0;
  let soloPair=1,trainingTeam=0,trainingAttack=1,shotUntil=0;
  function resetTraining(){
    lastPracticeHit=0;Object.assign(training,newField());training.restart='';training.hold=0;
    const side=trainingTeam?-1:1;
    Object.assign(training.ball,{x:(trainingAttack?.28:-.33)*side,z:.08,vx:.20*side,vz:.19});
  }
  const ball=mesh(new THREE.SphereGeometry(.017,16,12),white,0,.758,0);
  const ui=document.createElement('section');ui.hidden=true;
  ui.style.cssText='position:absolute;bottom:calc(var(--ui-safe-bottom,0px) + 12px);left:50%;transform:translateX(-50%);width:max-content;max-width:94%;padding:10px;border-radius:10px;background:#101924ee;color:white;text-align:center;touch-action:none';
  const status=document.createElement('div'),choices=document.createElement('div'),hint=document.createElement('small');
  const button=(parent,title,fn)=>{const b=document.createElement('button');b.textContent=title;b.onclick=fn;parent.append(b);return b};
  ui.append(status,choices,hint);el.append(ui);
  let watching=false,active=false,state=null,mode=2,slide=0,turn=0,lastInput='',lastUI='',lastSend=0,lastWatch=0;
  const post=(action,data={})=>send?.({type:'balilla',action,...data});
  function render(){
    if(!active)return;
    const occupied=state?.occupied??[],slot=state?.slot??-1;
    if(occupied.length)mode=state.mode;
    const key=JSON.stringify([mode,slot,occupied,state?.field.score,state?.field.finished,state?.field.restart,state?.field.serve,!!state,soloPair]);
    if(key===lastUI)return;lastUI=key;
    status.textContent=!state?'Allenamento libero':(!state.playing&&!state.field.finished?'Allenamento · Rossi – Blu':state.field.finished?'Finale':'Rossi – Blu')+'  '+state.field.score.join(' : ')+' · '+occupied.length+'/'+mode;
    choices.replaceChildren();
    if(state && slot<0){
      if(!occupied.length)button(choices,mode===2?'1 contro 1 ▾':'2 contro 2 ▾',()=>{mode=mode===2?4:2;render()});
      for(let n=0;n<4;n++){
        if(mode===2&&n%2)continue;
        button(choices,(n<2?'Rossi':'Blu')+(mode===4?(n%2?' attacco':' difesa'):''),()=>post('join',{slot:n,mode})).disabled=occupied.includes(n);
      }
    }
    if(slot<0||mode===2)button(choices,soloPair?'Attacco ⇄':'Difesa ⇄',()=>{soloPair=1-soloPair;render()});
    if(slot>=0&&state.playing&&state.field.restart){
      const serving=(state.field.serve===1?0:1)===Math.floor(slot/2);
      const announce=serving&&state.field.restart==='announce'&&(mode===2||slot%2===(state.field.defence?0:1));
      const confirm=!serving&&state.field.restart==='confirm';
      if(announce||confirm)button(choices,announce?'Vado':'Vai',()=>post('ready'));
      else status.textContent+=' · Attesa battuta';
    }
    if(slot>=0 && matchMedia('(pointer: coarse)').matches){
      for(const [label,value] of [['Indietro',-1],['Avanti',1]]){
        const b=button(choices,label,()=>{});
        b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);turn=value};
        b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{turn=0};
      }
    }
    if(slot>=0&&state.field.finished)button(choices,'Rivincita',()=>post('again'));
    button(choices,'Lascia il tavolo',close);
    hint.textContent='Mouse ↕ sposta le aste · A carica · D tira · Esc esci';
  }
  function close(){if(!active&&!watching)return;watching=active=false;lastRemoteHit=null;ui.hidden=true;post('leave');state=null;turn=slide=0;lastInput=lastUI=''}
  function input(e){
    if(!active)return false;
    if(e.target.closest?.('button')&&['Space','Enter','Tab'].includes(e.code))return false;
    if(e.code==='KeyQ'&&e.type==='keydown'&&!e.repeat&&(state?.slot<0||state?.mode!==4)){soloPair=1-soloPair;render()}
    if(e.code==='Escape'&&e.type==='keydown')close();
    if(['KeyA','KeyD'].includes(e.code)){const v=e.code==='KeyA'?-1:1;if(e.type==='keydown'){turn=v;if(v===1&&!e.repeat)shotUntil=performance.now()+135}else if(turn===v)turn=0}
    return true;
  }
  function move(e,bounds){
    if(!active)return;
    const direction=state?.slot>=2?-1:1;
    if(e.pointerType==='touch')slide=THREE.MathUtils.clamp((e.clientY-bounds.top)/bounds.height*2-1,-1,1)*direction;
    else slide=THREE.MathUtils.clamp(slide+(e.movementY||0)*direction*4/Math.max(260,bounds.height),-1,1);
  }
  function pose(slot,mode,pairIndex){
    const team=Math.floor(slot/2),pair=rows.map((r,i)=>r.team===team&&r.attack===(mode===4?slot%2:pairIndex??1)?i:-1).filter(i=>i>=0);
    const handles=pair.map(i=>new THREE.Vector3(-13+rows[i].x,.818,(team?-1:1)*.49+sticks[i].position.z));
    const x=(handles[0].x+handles[1].x)/2;
    return {x,z:(team?-1:1)*.77,yaw:team?Math.PI:0,handles:team?handles.sort((a,b)=>b.x-a.x):handles.sort((a,b)=>a.x-b.x)};
  }
  return {pose,get seat(){return active&&state?.slot>=0?{station:'balilla',slot:state.slot,mode:state.mode,pair:soloPair}:null},get active(){return active},open(){active=true;soloPair=1;slide=turn=shotUntil=0;trainingTeam=0;trainingAttack=1;resetTraining();ui.hidden=false;state=null;lastUI='';lastWatch=performance.now();post('watch');render()},close,input,move,
    receive(data){
      if(!active&&!watching)return;
      if(data.sound){playSound?.(data.sound);return}
      if(data.field?.hit>0&&lastRemoteHit!==null&&data.field.hit>lastRemoteHit)playSound?.(data.field.sound);
      lastRemoteHit=data.field?.hit??null;state=data;render()
    },
    update(camera,dt,nearby){
      if(!active&&!nearby){if(watching)close();return}
      if(!active&&!watching){watching=true;post('watch');lastWatch=performance.now()}
      const now=performance.now();
      if(now-lastWatch>3000){post('watch');lastWatch=now}
      const stroke=now<shotUntil?1:turn;
      if(state?.slot>=0){const data={slide:Math.round(slide*100)/100,turn:stroke,pair:soloPair};const key=JSON.stringify(data);
        if(key!==lastInput&&now-lastSend>35){post('input',data);lastInput=key;lastSend=now}}
      const dir=state?.slot>=2?-1:1;
      if(active){camera.position.set(-13,1.93,dir*.68);camera.lookAt(-13,.75,0)}
      let f=state?.field;
      if(active&&!state?.playing&&!f?.finished){
        const team=state?.slot>=2?1:0,attack=state?.mode===4&&state.slot>=0?state.slot%2:soloPair;
        if(team!==trainingTeam||attack!==trainingAttack||training.restart||training.finished){
          trainingTeam=team;trainingAttack=attack;resetTraining();
        }
        rows.forEach((row,i)=>{
          if(row.team===team&&row.attack===attack){training.rods[i].slide=slide;training.rods[i].turn=stroke*(team?1:-1)}
        });
        const steps=Math.max(1,Math.ceil(dt*120));
        for(let n=0;n<steps;n++)simulate(training,dt/steps);
        if(training.hit!==lastPracticeHit){
          lastPracticeHit=training.hit;
          if(now-lastBeat>=110){lastBeat=now;playSound?.(training.sound);post('practice-sound',{sound:training.sound})}
        }
        f=training;
      }
      if(!f)return;
      const smooth=1-Math.exp(-dt*34);
      ball.position.x+=(f.ball.x-ball.position.x)*smooth;ball.position.z+=(f.ball.z-ball.position.z)*smooth;
      sticks.forEach((s,i)=>{s.position.z+=(f.rods[i].shift-s.position.z)*smooth;s.rotation.z+=(-f.rods[i].angle-s.rotation.z)*smooth});
    },blur(){turn=0}
  };
}

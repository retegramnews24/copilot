'use strict';
let ac,master,voices=null,audioRevision=0;
function fadeVoices(){if(!voices)return;const {env,osc}=voices;voices=null;env.gain.cancelScheduledValues(ac.currentTime);env.gain.setTargetAtTime(0,ac.currentTime,1/5);for(const o of osc)o.stop(ac.currentTime+2);setTimeout(()=>env.disconnect(),2584)}
function setLevel(n){if(master)master.gain.setTargetAtTime(n/89,ac.currentTime,1/8)}
async function sound(mode,i,level){
 const revision=++audioRevision;fadeVoices();if(mode==='off')return true;
 try{if(!ac){ac=new (window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=0;master.connect(ac.destination)}await ac.resume();if(revision!==audioRevision)return true;
 setLevel(level);let root=[89,144,233,377,610,987,1597][i];while(root>233)root/=2;
 const env=ac.createGain();env.gain.value=0;env.connect(master);env.gain.setTargetAtTime(1,ac.currentTime,1/2);
 const osc=[];for(const [j,ratio] of [1,3/2,8/5].entries()){
 const o=ac.createOscillator(),amp=ac.createGain(),pulse=ac.createOscillator(),depth=ac.createGain();
 o.type=mode==='strings'&&j===0?'triangle':'sine';o.frequency.value=root*ratio*(mode==='bells'?2:1);const gain=1/[5,8,13][j];amp.gain.value=gain;pulse.frequency.value=1/([5,8,13][j]*(mode==='tide'?2:1));depth.gain.value=mode==='bells'?gain:gain*5/8;pulse.connect(depth);depth.connect(amp.gain);o.connect(amp);amp.connect(env);o.start();pulse.start();osc.push(o,pulse)}
 voices={env,osc};return true
 }catch{return false}
}

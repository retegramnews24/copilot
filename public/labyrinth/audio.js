export class Atmosphere{
 constructor(enabled=true){this.enabled=enabled;this.running=false;this.ctx=null}
 init(){if(this.ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{
  const c=this.ctx=new AC(),master=this.master=c.createGain();master.gain.value=0;master.connect(c.destination);
  const hum=c.createGain();hum.gain.value=.035;hum.connect(master);for(const f of [55,110,165]){const o=c.createOscillator();o.type='sine';o.frequency.value=f;o.connect(hum);o.start()}
  const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.08)/1.03;data[i]=last}this.noiseBuffer=buffer;
  const wind=c.createBufferSource();wind.buffer=buffer;wind.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;const gain=c.createGain();gain.gain.value=.025;wind.connect(filter);filter.connect(gain);gain.connect(master);wind.start();
 }catch{this.ctx=null}}
 resume(){if(!this.enabled)return;this.init();this.ctx?.resume().catch(()=>{});this.active(this.running)}
 active(value){this.running=value;if(this.ctx)this.master.gain.setTargetAtTime(this.enabled&&value ? .7 : 0,this.ctx.currentTime,.1)}
 toggle(){this.enabled=!this.enabled;if(this.enabled)this.resume();this.active(this.running);return this.enabled}
 layer({duration,volume,attack=.009,from,to=from,type='sine',noise=false,delay=0}){
  if(!this.enabled||!this.running||!this.ctx)return;
  const c=this.ctx,t=c.currentTime+delay,g=c.createGain();
  const source=noise?c.createBufferSource():c.createOscillator();
  if(noise){
   source.buffer=this.noiseBuffer;
   const filter=c.createBiquadFilter();filter.type=type;filter.Q.value=type==='bandpass'?.65:.45;
   filter.frequency.setValueAtTime(from,t);filter.frequency.exponentialRampToValueAtTime(to,t+duration);
   source.connect(filter);filter.connect(g);
  }else{
   source.type=type;source.frequency.setValueAtTime(from,t);
   source.frequency.exponentialRampToValueAtTime(to,t+duration);source.connect(g);
  }
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+attack);
  g.gain.exponentialRampToValueAtTime(.0001,t+duration);g.connect(this.master);
  if(noise)source.start(t,Math.random()*1.3);else source.start(t);
  source.stop(t+duration+.01);
 }
 step(fast=false){
  const pitch=.85+Math.random()*.32;
  this.layer({noise:true,type:'lowpass',from:(fast?660:495)*pitch,to:290,duration:fast?.12:.16,volume:fast?.19:.12});
  this.layer({from:95*pitch,to:44,duration:.087,volume:fast?.072:.04});
 }
 jump(spring=false){
  this.layer({noise:true,type:'bandpass',from:480,to:spring?1500:950,duration:.15,volume:.14});
  this.layer({from:spring?130:88,to:spring?270:55,duration:.15,volume:.052});
 }
 land(){
  this.layer({noise:true,type:'lowpass',from:1060,to:230,duration:.20,volume:.23});
  this.layer({from:108,to:44,duration:.15,volume:.15});
 }
 swish(kind='sword'){
  this.layer({noise:true,type:'bandpass',from:kind==='sword'?3100:850,to:kind==='sword'?780:360,duration:kind==='sword'?.24:.14,attack:.026,volume:kind==='sword'?.29:.18});
 }
 guard(shield){
  this.layer({noise:true,type:'bandpass',from:shield?1450:780,to:430,duration:.12,volume:.095});
 }
 impact(kind,shielded,strength=1){
  const metal=kind==='sword'&&shielded;
  this.layer({noise:true,type:'bandpass',from:metal?3300:kind==='sword'?2200:690,to:metal?1900:260,duration:metal?.16:.13,attack:.003,volume:.42*strength});
  if(metal||kind==='sword')for(const [from,duration,volume] of [[1730,.24,.085],[2680,.13,.045],[940,.31,.035]]){
   this.layer({from,to:from*.94,duration,attack:.004,volume:volume*strength});
  }
  else this.layer({from:kind==='frame'?115:95,to:42,duration:kind==='frame'?.23:.12,volume:.18*strength});
 }
 chime(){if(!this.enabled||!this.ctx)return;const c=this.ctx;for(let i=0;i<2;i++){const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+i*.14;o.type='sine';o.frequency.value=i?880:660;g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.52)}}
 destroy(){this.ctx?.close().catch(()=>{});this.ctx=null}
}

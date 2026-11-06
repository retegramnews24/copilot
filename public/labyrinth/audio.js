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
 step(fast=false){if(!this.enabled||!this.running||!this.ctx)return;const c=this.ctx,t=c.currentTime,s=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter();s.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.value=fast?520:360;gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(.11,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+.16);s.connect(filter);filter.connect(gain);gain.connect(this.master);s.start(t,.2);s.stop(t+.18)}
 chime(){if(!this.enabled||!this.ctx)return;const c=this.ctx;for(let i=0;i<2;i++){const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+i*.14;o.type='sine';o.frequency.value=i?880:660;g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.52)}}
 destroy(){this.ctx?.close().catch(()=>{});this.ctx=null}
}

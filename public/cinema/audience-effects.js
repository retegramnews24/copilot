const CRUNCH_TIMES=[0,.32,.65];

function noise(context,duration,sample){
  const buffer=context.createBuffer(1,Math.ceil(duration*context.sampleRate),context.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=sample(i/context.sampleRate,duration);
  return buffer;
}

export function audienceAudio(){
  let context,output,crunch,shush;
  function unlock(){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    try{
      if(!context){
        context=new Audio();
        output=context.createDynamicsCompressor();
        output.threshold.value=-14;
        output.ratio.value=5;
        output.connect(context.destination);
      }
      if(context.state==='suspended')context.resume().catch(()=>{});
    }catch{}
  }
  function play(effect,volume){
    if(!context||context.state!=='running'||!volume)return;
    const popcorn=effect==='popcorn';
    if(popcorn&&!crunch){
      crunch=noise(context,.22,t=>{
        const cracks=Math.exp(-t*42)+.5*Math.exp(-Math.abs(t-.041)*125)+.32*Math.exp(-Math.abs(t-.086)*93);
        return (Math.random()*2-1)*cracks;
      });
    }
    if(!popcorn&&!shush){
      shush=noise(context,.86,(t,duration)=>{
        const breath=Math.min(1,t/.07)*Math.pow(1-t/duration,1.4);
        return (Math.random()*2-1)*breath*(.84+.16*Math.sin(t*43));
      });
    }
    const filter=context.createBiquadFilter(),gain=context.createGain();
    filter.type='bandpass';filter.frequency.value=popcorn?2250:3650;filter.Q.value=popcorn ? .65 : .72;
    gain.gain.value=volume/100*(popcorn ? .64 : .44);
    filter.connect(gain);gain.connect(output);
    const now=context.currentTime+.02,starts=popcorn?CRUNCH_TIMES:[0];
    if(!popcorn){
      filter.frequency.setValueAtTime(5100,now);
      filter.frequency.exponentialRampToValueAtTime(3400,now+.22);
    }
    let playing=starts.length;
    for(const delay of starts){
      const source=context.createBufferSource();
      source.buffer=popcorn?crunch:shush;
      source.playbackRate.value=popcorn?1+delay*.18:1;
      source.connect(filter);
      source.onended=()=>{
        source.disconnect();
        if(--playing===0){filter.disconnect();gain.disconnect();}
      };
      source.start(now+delay);
    }
  }
  return {unlock,play};
}

export function showPopcorn(sofa){
  sofa.querySelector('.popcorn-effect')?.remove();
  const burst=document.createElement('span');
  burst.className='popcorn-effect';
  burst.setAttribute('aria-hidden','true');
  CRUNCH_TIMES.forEach((delay,index)=>{
    const kernel=document.createElement('span');
    kernel.textContent='🍿';
    kernel.style.setProperty('--pop-delay',delay+'s');
    kernel.style.setProperty('--pop-x',[-12,10,2][index]+'px');
    burst.append(kernel);
  });
  sofa.append(burst);
  setTimeout(()=>burst.remove(),1000);
}

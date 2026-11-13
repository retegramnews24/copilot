// Fit each pitwall's real controls into its allocated rectangle without losing inputs.
export function fitPanel(content,width,height){
 if(width<1||height<1)return;
 const measure=scale=>{content.style.width=(width/scale)+'px';return content.scrollHeight*scale<=height+.5&&content.scrollWidth*scale<=width+.5;};
 let low=.12,high=1;
 if(measure(1))low=1;else for(let i=0;i<9;i++){const mid=(low+high)/2;if(measure(mid))low=mid;else high=mid;}
 content.style.width=(width/low)+'px';content.style.transform=`scale(${low})`;
 content.dataset.scale=low.toFixed(3);
}
export function installCockpit(root){
 let stopped=false,queued=false;const frames=new Set();
 function update(){queued=false;if(stopped)return;
  for(const frame of root.querySelectorAll('.session-car,.live-card,.fit-panel')){
   frame.classList.add('fit-frame');
   let content=frame.querySelector(':scope > .cockpit-content');
   if(!content){content=document.createElement('div');content.className='cockpit-content';while(frame.firstChild)content.append(frame.firstChild);frame.append(content);}
   if(!frames.has(frame)){frames.add(frame);resize?.observe(frame);}
   const css=getComputedStyle(frame);content.style.left=css.paddingLeft;content.style.top=css.paddingTop;const w=frame.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight),h=frame.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);
   fitPanel(content,w,h);
  }
  for(const frame of frames)if(!frame.isConnected){resize?.unobserve(frame);frames.delete(frame);}
 }
 const schedule=()=>{if(!queued&&!stopped){queued=true;requestAnimationFrame(update);}};
 const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);
 const observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true,characterData:true});
 root.addEventListener('toggle',schedule,true);window.addEventListener('resize',schedule);schedule();
 return()=>{stopped=true;resize?.disconnect();observer.disconnect();root.removeEventListener('toggle',schedule,true);window.removeEventListener('resize',schedule);};
}

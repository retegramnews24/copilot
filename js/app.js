(()=>{'use strict';
const $=id=>document.getElementById(id),catalog=window.FRACTAL_CATALOG;let active=catalog[0],category='all',job=0,worker=null,renderer3d=null,centerX=-.5,centerY=0,scale=3.2,rotation=0,iterations=220,power=2,palette='cosmic',juliaReal=-.8,juliaImag=.156,quality=.7,drag=null,pinch=null,renderTimer=0,is3d=false,collapsed=false,deepEnabled=false,deepBits=512,deepCx=0n,deepCy=0n,deepScale=0n,favorites=new Set((()=>{try{return JSON.parse(localStorage.getItem('fractint-favorites')||'[]')}catch(_){return []}})());
const canvas2d=$('canvas2d'),canvas3d=$('canvas3d'),previewCanvas=$('previewCanvas'),detailRevealCanvas=$('detailRevealCanvas'),stage=$('visualStage');
let lastFrame=null,lastRenderView=null,activeRenderView=null,previewActive=false;
let sessionThemeSeed=Math.random(),uiThemeBase=null;
const INTERFACE_THEMES=[
 {name:'opaline',panelA:'#14172a',panelB:'#0f2032',edge:'#3b5473',mist:'#d8f2ff',glow:'#8ddcff'},
 {name:'amethyst',panelA:'#19152a',panelB:'#211537',edge:'#55407b',mist:'#f4dbff',glow:'#c67cff'},
 {name:'ember',panelA:'#211520',panelB:'#30181e',edge:'#75475a',mist:'#ffe0c6',glow:'#ff9970'},
 {name:'lagoon',panelA:'#101c27',panelB:'#102737',edge:'#2f6670',mist:'#d5fff4',glow:'#60dfc8'},
 {name:'aurora',panelA:'#101827',panelB:'#171331',edge:'#355570',mist:'#e7f7ff',glow:'#7ec3ff'}
];
// Color cycling is a compositor-only filter over the existing image: never
// cancels a render, modifies camera coordinates, or schedules a new worker job.
// Web Animations preserves the hue phase when changing speed or pausing.
let colorCycleOn=false,colorCycleRate=1,colorCycleAnimations=[],colorCycleFallback=false;
function initColorCycle(){
 const canvases=[canvas2d,canvas3d,previewCanvas,detailRevealCanvas];
 colorCycleFallback=typeof canvas2d.animate!=='function';
 if(!colorCycleFallback){
  try{
   colorCycleAnimations=canvases.map(c=>{
    const a=c.animate([{filter:'hue-rotate(0deg)'},{filter:'hue-rotate(360deg)'}],
      {duration:36000,iterations:Infinity,easing:'linear',fill:'both'});
    a.pause();return a;
   });
  }catch(e){
   for(const a of colorCycleAnimations)a.cancel();
   colorCycleAnimations=[];colorCycleFallback=true;
  }
 }
 const btn=$('colorCycleBtn'),speed=$('colorCycleSpeed');
 btn.addEventListener('click',()=>setColorCycle(!colorCycleOn));
 speed.addEventListener('change',()=>{
  colorCycleRate=Math.max(.5,Math.min(4,Number(speed.value)||1));
  if(colorCycleFallback){stage.style.setProperty('--hue-cycle-duration',(36/colorCycleRate)+'s');}
  else for(const a of colorCycleAnimations){
   if(typeof a.updatePlaybackRate==='function')a.updatePlaybackRate(colorCycleRate);
   else a.playbackRate=colorCycleRate;
  }
 });
 speed.dispatchEvent(new Event('change'));
}
function setColorCycle(enable,reset=false){
 colorCycleOn=!!enable;
 const btn=$('colorCycleBtn');
 btn.setAttribute('aria-pressed',String(colorCycleOn));
 btn.classList.toggle('playing',colorCycleOn);
 btn.innerHTML=colorCycleOn?'Ⅱ <span>PAUSA</span>':'↻ <span>CICLA</span>';
 btn.title=colorCycleOn?'Metti in pausa il ciclo colori':'Riprendi il ciclo colori';
 if(colorCycleFallback){
  stage.classList.toggle('cycle-colors',colorCycleOn||!reset);
  stage.classList.toggle('cycle-colors-paused',!colorCycleOn);
  if(reset)stage.classList.remove('cycle-colors');
 }else for(const a of colorCycleAnimations){
  if(reset)a.currentTime=0;
  if(colorCycleOn)a.play();else a.pause();
 }
}

function clamp01(v){return Math.max(0,Math.min(1,v));}
function hexToRgb(hex){const h=(hex||'#000000').replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2)||'00',16));}
function rgbToHex(rgb){return '#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
function mixHex(a,b,t){const ra=hexToRgb(a),rb=hexToRgb(b),u=clamp01(t);return rgbToHex(ra.map((v,i)=>v+(rb[i]-v)*u));}
function alphaHex(hex,a){const [r,g,b]=hexToRgb(hex);return `rgba(${r},${g},${b},${clamp01(a)})`;}
function paletteStopsFor(key){return (window.FRACTAL_PALETTES?.[key]?.stops||['#8a78ff','#43d7c5','#f5bd67']);}
function refreshInterfaceTheme(){
 if(!uiThemeBase)uiThemeBase=INTERFACE_THEMES[Math.floor(Math.random()*INTERFACE_THEMES.length)];
 const stops=paletteStopsFor(palette),primary=stops[1]||stops[0]||'#8a78ff',secondary=stops[3]||stops[stops.length-1]||'#43d7c5';
 const tertiary=stops[2]||mixHex(primary,secondary,.5);
 const root=document.documentElement.style;
 root.setProperty('--ui-accent',primary);
 root.setProperty('--ui-accent-2',secondary);
 root.setProperty('--ui-accent-3',tertiary);
 root.setProperty('--ui-panel-a',mixHex(uiThemeBase.panelA,primary,.18));
 root.setProperty('--ui-panel-b',mixHex(uiThemeBase.panelB,secondary,.14));
 root.setProperty('--ui-edge',mixHex(uiThemeBase.edge,primary,.32));
 root.setProperty('--ui-mist',mixHex(uiThemeBase.mist,secondary,.18));
 root.setProperty('--ui-glow',mixHex(uiThemeBase.glow,primary,.28));
 root.setProperty('--ui-glass',alphaHex(mixHex(uiThemeBase.panelA,primary,.12),.72));
 root.setProperty('--ui-glass-soft',alphaHex(mixHex(uiThemeBase.panelB,secondary,.10),.58));
 root.setProperty('--ui-track',`linear-gradient(90deg, ${primary}, ${tertiary}, ${secondary})`);
 root.setProperty('--ui-bar-shadow',alphaHex(mixHex(primary,secondary,.45),.55));
 stage?.style?.setProperty('--render-sheen',`radial-gradient(circle at ${35+Math.round(sessionThemeSeed*40)}% 50%, ${alphaHex(primary,.16)} 0%, transparent 58%)`);
 const tg=window.Telegram?.WebApp;
 tg?.setHeaderColor?.(mixHex('#0b1020',primary,.15));
 tg?.setBackgroundColor?.(mixHex('#080b16',secondary,.10));
}
function primeProgressivePreview(targetW,targetH){
 if(previewCanvas){previewCanvas.style.opacity='1';previewCanvas.style.transition='opacity .16s linear';}
 seedRenderBase(targetW,targetH);
}
// An alpha-masked, separate canvas always leaves the previous finished frame
// untouched underneath the new detail. The mask moves smoothly downward with
// a feathered frontier: no black bands and no hard edges between render chunks.
const revealMaskSupported=!!(detailRevealCanvas && typeof CSS!=='undefined' &&
 (CSS.supports('mask-image','linear-gradient(black,transparent)') ||
  CSS.supports('-webkit-mask-image','linear-gradient(black,transparent)')));
let revealActive=false,revealCursor=0,revealTarget=0,revealRaf=0,revealLastTick=0;
let revealPendingFinal=null,revealLoadedThrough=0;
function setFeatherPosition(p){
 if(!detailRevealCanvas)return;
 const y=Math.min(100,Math.max(0,p));
 const stageH=Math.max(1,stage.clientHeight||500);
 const feather=Math.min(5.6,Math.max(1.2,19/stageH*100));
 const from=Math.max(0,y-feather);
 const mask=y<.05?'linear-gradient(transparent,transparent)':
  `linear-gradient(to bottom, black 0%, black ${from.toFixed(3)}%, transparent ${y.toFixed(3)}%, transparent 100%)`;
 detailRevealCanvas.style.maskImage=mask;
 detailRevealCanvas.style.webkitMaskImage=mask;
 stage.style.setProperty('--reveal-y',y.toFixed(3)+'%');
}
function stopReveal(){
 if(revealRaf)cancelAnimationFrame(revealRaf);
 revealRaf=0;revealLastTick=0;revealCursor=0;revealTarget=0;
 revealPendingFinal=null;revealActive=false;revealLoadedThrough=0;
 if(detailRevealCanvas){detailRevealCanvas.hidden=true;detailRevealCanvas.style.maskImage='';detailRevealCanvas.style.webkitMaskImage='';}
 stage.classList.remove('revealing');
}
function commitRenderedFrame(m,meta,interrupted=false){
 if(!m||(!m.pixels&&!revealActive)){stopReveal();return;}
 try{
  if(canvas2d.width!==m.width)canvas2d.width=m.width;
  if(canvas2d.height!==m.height)canvas2d.height=m.height;
  const ctx=canvas2d.getContext('2d',{alpha:false});
  // When the feathered layer already contains a complete result, re-use its
  // pixels directly. Do not allocate another full-screen ImageData buffer.
  if(revealActive&&detailRevealCanvas.width===m.width&&detailRevealCanvas.height===m.height){
   ctx.drawImage(detailRevealCanvas,0,0);
  }else if(m.pixels){
   ctx.putImageData(new ImageData(new Uint8ClampedArray(m.pixels),m.width,m.height),0,0);
  }else{stopReveal();return;}
  if(!lastFrame||lastFrame.width!==m.width||lastFrame.height!==m.height){
   lastFrame=document.createElement('canvas');lastFrame.width=m.width;lastFrame.height=m.height;
  }
  lastFrame.getContext('2d',{alpha:false}).drawImage(canvas2d,0,0);
  lastRenderView=meta.view||getViewState();
  stopReveal();clearPreview();
  if(interrupted){hideLoader();return;}
  finishLoader();updateStats();
  if(!meta.high)planQuietRefinement(m.job);
 }catch(err){console.warn('Composizione finale non disponibile:',err);stopReveal();hideLoader();}
}
function flushRevealForInteraction(){
 const p=revealPendingFinal;
 if(p&&p.m.job===job){commitRenderedFrame(p.m,p.meta,true);return;}
 stopReveal();
}
function revealStep(t){
 revealRaf=0;
 if(!revealActive)return;
 const dt=revealLastTick?Math.min(48,Math.max(8,t-revealLastTick)):16;
 revealLastTick=t;
 const delta=Math.max(0,revealTarget-revealCursor);
 if(delta>.04){
  // At most ~350 ms for a complete finished frame, yet fast enough to
  // keep up with a worker that emits many small strips.
  const transitionFactor=performance.now()<artTransitionUntil?.72:1;
  const speed=Math.min(5.8,1.35+delta*.16)*(dt/16)*transitionFactor;
  revealCursor=Math.min(revealTarget,revealCursor+Math.max(.22,speed));
  setFeatherPosition(revealCursor);
 }
 if(revealPendingFinal&&revealTarget>=99.98&&revealCursor>=99.95){
  const p=revealPendingFinal;commitRenderedFrame(p.m,p.meta);return;
 }
 if(revealCursor+.04<revealTarget)revealRaf=requestAnimationFrame(revealStep);
}
function feedReveal(row,fullH){
 if(!revealActive)return;
 revealTarget=Math.max(revealTarget,Math.min(100,100*row/Math.max(1,fullH)));
 if(!revealRaf)revealRaf=requestAnimationFrame(revealStep);
}
function prepareReveal(w,h){
 stopReveal();
 if(!revealMaskSupported||Number(navigator.deviceMemory||0)>0&&navigator.deviceMemory<=2 || !w || !h)return;
 try{
  detailRevealCanvas.width=w;detailRevealCanvas.height=h;
  if(!detailRevealCanvas.getContext('2d',{alpha:false}))return;
  detailRevealCanvas.hidden=false;
  revealCursor=0;revealTarget=0;revealLoadedThrough=0;revealActive=true;
  setFeatherPosition(0);
  stage.classList.add('revealing');
 }catch(err){console.warn('Transizione morbida non supportata:',err);stopReveal();}
}
function paintRenderChunk(m){
 if(!m||m.job!==job||is3d)return;
 try{
  const image=new ImageData(new Uint8ClampedArray(m.pixels),m.width,m.height);
  if(revealActive&&detailRevealCanvas.width===m.width&&detailRevealCanvas.height===m.fullHeight){
   detailRevealCanvas.getContext('2d',{alpha:false}).putImageData(image,0,m.y);
   if(m.y<=revealLoadedThrough)revealLoadedThrough=Math.max(revealLoadedThrough,m.y+m.height);
   feedReveal(m.y+m.height,m.fullHeight);
  }else{
   if(canvas2d.width!==m.width)canvas2d.width=m.width;
   if(canvas2d.height!==m.fullHeight)canvas2d.height=m.fullHeight;
   canvas2d.getContext('2d',{alpha:false}).putImageData(image,0,m.y);
  }
  stage.classList.remove('reprojecting');
  workerProgress(m.progress);
 }catch(err){console.warn('Strato non disponibile:',err);}
}

// A separate, lightweight copy of the real renderer builds a wider low-resolution
// map around the visible frame. It keeps unexplored edges filled during gestures.
let overviewWorker=null,overviewFrame=null,overviewView=null,overviewPendingView=null,overviewJob=0,overviewBusy=false,overviewRefresh=false;
// Two and a half visible spans per axis, with adaptive overscan resolution.
// Greater detail than v4.6.8 (typically 420-560px vs 205px), without
// increasing resolution on devices that report limited RAM or CPU cores.
const OVERVIEW_SPAN=2.55;
let stageGeometryRef=null,stageResizeRAF=0;
function stopOverview(){overviewJob++;overviewBusy=false;overviewRefresh=false;overviewFrame=null;overviewView=null;overviewPendingView=null;clearPreview();}
function overviewGood(view){
 if(!overviewFrame||!overviewView||overviewView.id!==view.id||overviewView.palette!==view.palette||overviewView.params!==view.params||overviewView.deep!==view.deep)return false;
 if(Math.abs(Math.atan2(Math.sin((overviewView.rotation||0)-(view.rotation||0)),Math.cos((overviewView.rotation||0)-(view.rotation||0))))>.22)return false;
 let relative=overviewView.scale/view.scale,dx=Math.hypot(overviewView.cx-view.cx,overviewView.cy-view.cy);
 if(view.deep&&overviewView.deep){
  const bits=Math.max(view.bits,overviewView.bits),oldSpan=fixedRescale(overviewView.dscale,overviewView.bits,bits),newSpan=fixedRescale(view.dscale,view.bits,bits);
  relative=ratioBigInt(oldSpan,newSpan);
  const odx=fixedRescale(overviewView.dcx,overviewView.bits,bits)-fixedRescale(view.dcx,view.bits,bits);
  const ody=fixedRescale(overviewView.dcy,overviewView.bits,bits)-fixedRescale(view.dcy,view.bits,bits);
  dx=Math.hypot(ratioBigInt(odx,newSpan),ratioBigInt(ody,newSpan))*view.scale;
 }
 return relative>1.35&&relative<7&&dx/Math.max(1e-300,view.scale)<.48;
}
function ensureOverviewWorker(){
 if(overviewWorker||typeof Worker==='undefined')return !!overviewWorker;
 try{
  overviewWorker=new Worker('js/render-worker.js?v=4710');
  overviewWorker.onmessage=e=>{
   const m=e.data;if(m.job!==overviewJob||m.progress!==undefined)return;
   overviewBusy=false;
   if(m.error){console.warn('Anteprima estesa:',m.error);return;}
   try{
    const frame=document.createElement('canvas');frame.width=m.width;frame.height=m.height;
    frame.getContext('2d',{alpha:false}).putImageData(new ImageData(new Uint8ClampedArray(m.pixels),m.width,m.height),0,0);
    overviewFrame=frame;overviewView=overviewPendingView;
    if(!is3d&&previewActive)updatePreview();
    // Queue at most one new map, using the latest gesture position.
    if(overviewRefresh&&!is3d){overviewRefresh=false;setTimeout(()=>requestOverview(),130);}
   }catch(err){console.warn('Anteprima estesa non disponibile:',err);}
  };
  overviewWorker.onerror=e=>{console.warn('Worker anteprima:',e.message);overviewBusy=false;overviewWorker?.terminate();overviewWorker=null;};
  return true;
 }catch(_){return false;}
}
function requestOverview(){
 if(is3d||!ensureOverviewWorker())return;
 const view=getViewState();if(overviewGood(view))return;
 if(overviewBusy){overviewRefresh=true;return;}
 overviewBusy=true;overviewRefresh=false;
 // One low-resolution map (not a stretched bitmap), covering 2.8 screen spans.
 const lowSpec=(navigator.deviceMemory>0&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency>0&&navigator.hardwareConcurrency<=4);
 const longSide=view.deep?(lowSpec?230:315):(lowSpec?390:540);
 const factor=longSide/Math.max(1,view.stageW,view.stageH);
 const width=Math.max(72,Math.round(view.stageW*factor)),height=Math.max(72,Math.round(view.stageH*factor));
 const coarseScale=scale*OVERVIEW_SPAN,coarseDeep=deepEnabled?deepScale*255n/100n:0n;
 const config={job:++overviewJob,preview:true,width,height,type:active.id,cx:centerX,cy:centerY,
  scale:coarseScale,baseCx:active.center[0],baseCy:active.center[1],baseScale:active.scale,
  rotation,iterations:Math.min(iterations,deepEnabled?95:(lowSpec?125:160)),power,juliaReal,juliaImag,palette,
  deep:deepEnabled,deepBits,deepCx:deepEnabled?deepCx.toString():'0',
  deepCy:deepEnabled?deepCy.toString():'0',deepScale:deepEnabled?coarseDeep.toString():'0'};
 overviewPendingView={...view,scale:coarseScale,dscale:coarseDeep};
 overviewWorker.postMessage(config);
}

let renderProgressTimer=0,renderHideTimer=0,renderStartedAt=0,renderEstimateMs=3500,renderHasWorkerProgress=false,renderToken=0;
let fullscreenResizeTimer=0,fullscreenViewport=null,fullscreenPendingRender=false;
// Quality pipeline: 1) wide preview, 2) responsive base pass, 3) quiet-time
// supersampled refinement. Any interaction cancels the pending third pass.
let refineTimer=0,refineSerial=0,activeRenderAutomatic=false,activeRenderHigh=false;
let focusNormX=.5,focusNormY=.5,lastZoomFocusAt=0,artTransitionUntil=0;
function cancelRefinement(){clearTimeout(refineTimer);refineTimer=0;refineSerial++;}
function zoomDepth(){
 const depth=deepEnabled?Math.log2(3.2)-bigintLog2(deepScale)+deepBits:
  Math.log2(Math.max(1,active.scale/Math.max(scale,Number.MIN_VALUE)));
 return Math.max(0,Math.min(300,Number.isFinite(depth)?depth:0));
}
function detailIterations(highQuality){
 if(!highQuality)return iterations;
 if(!['mandelbrot','julia','multibrot','burning','buffalo','perpendicular','tricorn','celtic','phoenix','mcmullen'].includes(active.id))return iterations;
 const depth=zoomDepth(),extra=Math.min(950,Math.round(55+18*depth));
 return Math.min(deepEnabled?(deepBits>=1024?1450:deepBits>=512?1750:2050):2400,iterations+extra);
}
function planQuietRefinement(completedJob){
 clearTimeout(refineTimer);
 const serial=refineSerial;
 refineTimer=setTimeout(()=>{
  if(serial!==refineSerial||job!==completedJob||drag||pinch||document.hidden)return;
  if(is3d)draw3d(true,true);
  else draw2d(true,true);
 },performance.now()-lastZoomFocusAt<1600?460:720);
}

const qFactor=()=>1n<<BigInt(deepBits);
function getRenderTarget(rect,highQuality=false,for3d=false,automatic=false){
 const dpr=Math.min(3.25,Math.max(1,window.devicePixelRatio||1));
 const density=highQuality?Math.min(3.35,dpr*(automatic?1.32:1.65)):Math.min(dpr,1.6)*quality;
 let w=Math.max(240,Math.round(rect.width*density)),h=Math.max(180,Math.round(rect.height*density));
 let budget=highQuality?(automatic?4_000_000:7_200_000):3_600_000;
 if(for3d)budget=highQuality?(automatic?1_350_000:2_800_000):1_800_000;
 const memory=Number(navigator.deviceMemory)||0,cores=Number(navigator.hardwareConcurrency)||0;
 if(highQuality&&memory>=6&&cores>=6)budget*=1.14;
 if(memory>0&&memory<=4)budget*=.72;
 if(cores>0&&cores<=4)budget*=.82;
 const pixelScale=Math.min(1,Math.sqrt(budget/(w*h)));
 const sideScale=Math.min(1,6144/Math.max(w,h));
 const fit=Math.min(pixelScale,sideScale);
 w=Math.max(160,Math.round(w*fit));h=Math.max(120,Math.round(h*fit));
 return {width:w,height:h,pixels:w*h,density};
}
function setRenderProgress(value){const pct=Math.max(0,Math.min(100,Math.round(value)));$('renderPercent').textContent=pct+'%';$('renderProgressBar').style.width=pct+'%';}
function showLoader(msg='CALCOLO IN CORSO',estimateMs=3500){
 clearInterval(renderProgressTimer);clearTimeout(renderHideTimer);renderToken++;
 renderStartedAt=performance.now();renderEstimateMs=Math.max(650,Math.min(45000,estimateMs||3500));renderHasWorkerProgress=false;
 $('renderMessage').textContent=msg;$('renderQualityHint').textContent='LIVELLI E SFUMATURE IN ARRIVO';setRenderProgress(1);
 $('renderOverlay').classList.add('show');$('engineStatus').innerHTML='<i style="background:#efbd67"></i> RENDERING';
 const token=renderToken;
 renderProgressTimer=setInterval(()=>{if(token!==renderToken||renderHasWorkerProgress)return;const elapsed=performance.now()-renderStartedAt;const estimated=4+90*(1-Math.exp(-elapsed/renderEstimateMs));setRenderProgress(Math.min(94,estimated));},120);
}
function workerProgress(value){renderHasWorkerProgress=true;setRenderProgress(value);}
function finishLoader(){clearInterval(renderProgressTimer);renderHasWorkerProgress=true;setRenderProgress(100);const token=renderToken;clearTimeout(renderHideTimer);renderHideTimer=setTimeout(()=>{if(token===renderToken){hideLoader();}},420);}
function hideLoader(){clearInterval(renderProgressTimer);clearTimeout(renderHideTimer);$('renderOverlay').classList.remove('show');$('engineStatus').innerHTML='<i></i> ENGINE READY';if(previewCanvas)previewCanvas.style.opacity='1';}
function numberToFixed(n,bits=deepBits){const q=1n<<BigInt(bits),den=1000000000000000n,num=BigInt(Math.round(n*1e15));return num*q/den;}
function fixedToNumber(v,bits=deepBits){if(v===0n)return 0;const shift=Math.max(0,bits-44),sv=v>>BigInt(shift);return Number(sv)/Math.pow(2,bits-shift);}
function fixedMul(a,b){return(a*b)>>BigInt(deepBits);}
function fixedRescale(v,from,to){return to>=from?v<<BigInt(to-from):v>>BigInt(from-to);}
function deepInit(){deepCx=numberToFixed(centerX);deepCy=numberToFixed(centerY);deepScale=numberToFixed(scale);if(deepScale<minDeepSpan())deepScale=minDeepSpan();deepEnabled=true;updateDeepApprox();}
function updateDeepApprox(){centerX=fixedToNumber(deepCx);centerY=fixedToNumber(deepCy);scale=Math.max(Number.MIN_VALUE,fixedToNumber(deepScale));}
function deepRatioQ(numerator,denominator){const q=qFactor();return BigInt(Math.round(numerator*1000))*q/BigInt(Math.max(1,Math.round(denominator*1000)));}
function minDeepSpan(){const r=canvas2d.getBoundingClientRect(),pixels=Math.max(64,Math.round(Math.min(r.width||320,r.height||320)));return BigInt(pixels*2);}
function bigintLog2(n){if(n<=0n)return -Infinity;const b=n.toString(2),take=Math.min(52,b.length),head=parseInt(b.slice(0,take),2);return b.length-1+Math.log2(head/Math.pow(2,take-1));}
function zoomDisplay(){if(!deepEnabled)return(3.2/scale).toFixed(2)+'×';const log2z=Math.log2(3.2)-bigintLog2(deepScale)+deepBits;if(log2z<35)return Math.pow(2,log2z).toFixed(2)+'×';return '2^'+log2z.toFixed(1)+'×';}
function deepAllowed(){return ['mandelbrot','julia'].includes(active.id);}
function setDeepMode(enabled){if(enabled&&!deepAllowed()){showToast('Precisione multipla disponibile per Mandelbrot e Julia');return;}if(enabled&&!deepEnabled){if(typeof BigInt!=='function'){showToast('Questo dispositivo non supporta BigInt');return;}deepInit();}else if(!enabled&&deepEnabled){updateDeepApprox();deepEnabled=false;}$('deepZoomBtn')?.classList.toggle('active',deepEnabled);$('deepZoomBtn')?.setAttribute('aria-pressed',String(deepEnabled));$('deepZoomBtn').innerHTML=deepEnabled?'∞ <span>DEEP ON</span>':'∞ <span>DEEP ZOOM</span>';updateHUD();scheduleDraw();}
function setDeepPrecision(bits){bits=+bits;if(![128,256,512,1024].includes(bits))return;if(!deepEnabled){deepBits=bits;return;}deepCx=fixedRescale(deepCx,deepBits,bits);deepCy=fixedRescale(deepCy,deepBits,bits);deepScale=fixedRescale(deepScale,deepBits,bits);deepBits=bits;if(deepScale<minDeepSpan())deepScale=minDeepSpan();updateDeepApprox();scheduleDraw();updateHUD();}
function deepZoomAt(f,x,y){const r=canvas2d.getBoundingClientRect(),px=(x??(r.left+r.width/2))-r.left,py=(y??(r.top+r.height/2))-r.top,s=Math.min(r.width,r.height);const ox=deepRatioQ(2*px-r.width,2*s),oy=deepRatioQ(2*py-r.height,2*s);const wx=deepCx+fixedMul(ox,deepScale),wy=deepCy+fixedMul(oy,deepScale);f=Math.max(.05,Math.min(20,Number(f)||1));deepScale=fixedMul(deepScale,numberToFixed(f));if(deepScale<minDeepSpan())deepScale=minDeepSpan();deepCx=wx-fixedMul(ox,deepScale);deepCy=wy-fixedMul(oy,deepScale);updateDeepApprox();scheduleDraw();updateHUD();}
function initWorker(){
 try{
  worker=new Worker('js/render-worker.js?v=4710');
  worker.onmessage=e=>{
   const m=e.data;if(m.job!==job)return;
   if(m.chunk){paintRenderChunk(m);return;}
   if(m.progress!==undefined){workerProgress(m.progress);return;}
   if(m.error){console.warn('Errore renderer:',m.error);stopReveal();if(!lastFrame)showFallback2d();hideLoader();return;}
   if(revealActive){
    try{
     // Formulae that render in one pass still need the full frame. Streamed
     // formulae have already painted every band to this canvas.
     if(revealLoadedThrough<m.height){
      detailRevealCanvas.getContext('2d',{alpha:false}).putImageData(new ImageData(new Uint8ClampedArray(m.pixels),m.width,m.height),0,0);
     }
     revealPendingFinal={m:{job:m.job,width:m.width,height:m.height},meta:{view:activeRenderView,high:activeRenderHigh,automatic:activeRenderAutomatic}};
     feedReveal(m.height,m.height);
     return;
    }catch(err){console.warn('Dissolvenza non disponibile:',err);stopReveal();}
   }
   commitRenderedFrame(m,{view:activeRenderView,high:activeRenderHigh,automatic:activeRenderAutomatic});
  };
  worker.onerror=e=>{console.warn('Worker non disponibile',e);stopReveal();worker?.terminate();worker=null;if(!lastFrame)showFallback2d();hideLoader();showToast('Anteprima semplificata: motore in riavvio');};
 }catch(e){console.warn('Impossibile avviare il worker',e);worker=null;if(!lastFrame)showFallback2d();}
}

function showFallback2d(){
 if(is3d)return;
 const r=stage.getBoundingClientRect(),w=180,h=Math.max(90,Math.round(180*(r.height||400)/Math.max(1,r.width||300)));
 const scratch=document.createElement('canvas');scratch.width=w;scratch.height=h;
 const c=scratch.getContext('2d',{alpha:false}),im=c.createImageData(w,h),p=im.data;
 const max=45,cs=Math.cos(rotation),sn=Math.sin(rotation);
 const stops=(window.FRACTAL_PALETTES?.[palette]||window.FRACTAL_PALETTES?.cosmic)?.stops||['#120d2c','#4c238d','#ac50bf','#f68cae','#ffe8cf'];
 const rgb=stops.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const dx=(x-w/2)/Math.min(w,h)*scale,dy=(y-h/2)/Math.min(w,h)*scale;
  const wx=centerX+cs*dx-sn*dy,wy=centerY+sn*dx+cs*dy;
  let a=active.id==='julia'?wx:0,b=active.id==='julia'?wy:0,n=0;
  const cx=active.id==='julia'?juliaReal:wx,cy=active.id==='julia'?juliaImag:wy;
  while(n<max&&a*a+b*b<100){let aa=a*a-b*b+cx;b=2*a*b+cy;a=aa;n++;}
  const t=n===max?0:n/max,idx=Math.min(3,Math.floor(t*4)),f=t*4-idx;
  let k=(y*w+x)*4;for(let j=0;j<3;j++)p[k+j]=rgb[idx][j]*(1-f)+rgb[idx+1][j]*f;p[k+3]=255;
 }
 c.putImageData(im,0,0);if(!canvas2d.width||canvas2d.width<2){canvas2d.width=w;canvas2d.height=h;}
 canvas2d.getContext('2d',{alpha:false}).drawImage(scratch,0,0,canvas2d.width,canvas2d.height);
}

function showToast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600);}
function setCanvasMode(three){if(three)stopReveal();is3d=three;if(three)clearPreview();canvas2d.classList.toggle('hidden',three);canvas3d.classList.toggle('hidden',!three);$('threeControls').hidden=!three;if(three)requestAnimationFrame(()=>resize3d(false));$('powerBlock').hidden=three;$('juliaBlock').hidden=active.id!=='julia';$('modeLabel').textContent=three?'3D RAY MARCH':'2D FRACTAL';$('precisionLabel').textContent=three?'WEBGL2 GPU':'CPU / WORKER';$('stageHint').textContent=three?'TRASCINA PER RUOTARE · DUE DITA PER ZOOM E ROTAZIONE':'TRASCINA · PIZZICA PER ZOOM · RUOTA CON DUE DITA';$('renderQualityBlock').hidden=three;}
function draw2d(hd=false,automatic=false){
 if(revealActive)flushRevealForInteraction();
 if(is3d){draw3d(hd,automatic);return;}
 if(!worker)initWorker();if(!worker)return;
 const rect=stage.getBoundingClientRect(),highQuality=!!hd;
 const target=getRenderTarget(rect,highQuality,false,automatic);
 let w=target.width,h=target.height,renderIterations=detailIterations(highQuality);
 if(deepEnabled){
  const baseSide=deepBits>=1024?400:deepBits>=512?560:deepBits>=256?720:920;
  const maxSide=Math.min(1800,Math.round(baseSide*(highQuality?(automatic?1.20:1.45):1)));
  const basePixels=deepBits>=1024?430000:deepBits>=512?730000:deepBits>=256?950000:1300000;
  const deepBudget=Math.min(2_000_000,Math.round(basePixels*(highQuality?(automatic?1.35:1.7):1)));
  const shrink=Math.min(1,maxSide/Math.max(w,h),Math.sqrt(deepBudget/(w*h)));
  w=Math.max(96,Math.round(w*shrink));h=Math.max(96,Math.round(h*shrink));
  renderIterations=Math.min(renderIterations,highQuality?(deepBits>=1024?1450:deepBits>=512?1750:2050):Math.max(iterations,deepBits>=1024?700:deepBits>=512?900:1200));
 }
 // Do not resize canvas here: resizing clears its pixels and produces black
 // flashes before the new worker result arrives (especially in Telegram).
 job++;activeRenderView=getViewState();activeRenderAutomatic=automatic;activeRenderHigh=highQuality;
 const mp=w*h/1000000,weight=deepEnabled?4.2:Math.max(.45,renderIterations/220);
 const estimate=Math.min(45000,Math.max(900,mp*weight*1350));
 const showProgress=automatic||fullscreenPendingRender||!artOnly||highQuality;
 fullscreenPendingRender=false;
 if(showProgress)showLoader(performance.now()<artTransitionUntil?'ARTISTIC TRANSITION':(deepEnabled?'INFINITE DETAIL · '+deepBits+' BIT':'LIVING CANVAS'),estimate);
 else hideLoader();
 primeProgressivePreview(w,h);
 prepareReveal(w,h);
 $('renderQualityHint').textContent=`${w} × ${h} · ${mp.toFixed(1)} MP · ${highQuality?(automatic?'RIFINITURA PROGRESSIVA':'ALTA DEFINIZIONE'):'STRATI PROGRESSIVI'}`;
 if(!highQuality)requestOverview();
 const focusAssist=!highQuality&&(performance.now()-lastZoomFocusAt<1800)&&!drag&&!pinch;
 const cfg={job,width:w,height:h,type:active.id,cx:centerX,cy:centerY,scale,
  baseCx:active.center[0],baseCy:active.center[1],baseScale:active.scale,
  rotation,iterations:renderIterations,power,juliaReal,juliaImag,palette,
  deep:deepEnabled,deepBits,deepCx:deepEnabled?deepCx.toString():'0',
  deepCy:deepEnabled?deepCy.toString():'0',deepScale:deepEnabled?deepScale.toString():'0',
  supersampled:highQuality,focusAssist,focusX:focusNormX,focusY:focusNormY,
  focusBoostIters:deepEnabled?180:150};
 worker.postMessage(cfg);updateHUD();
}
function getViewState(){const r=stage.getBoundingClientRect();return {id:active.id,palette,params:[iterations,power,juliaReal,juliaImag].join(':'),cx:centerX,cy:centerY,scale,rotation,deep:deepEnabled,bits:deepBits,dcx:deepCx,dcy:deepCy,dscale:deepScale,stageW:r.width,stageH:r.height};}
function clearPreview(){
 if(!previewCanvas)return;
 stage.classList.remove('reprojecting');
 previewCanvas.width=1;previewCanvas.height=1;previewCanvas.hidden=true;previewCanvas.style.opacity='1';previewActive=false;
}
function ratioBigInt(a,b){if(b===0n)return 1;const neg=(a<0n)!==(b<0n),aa=a<0n?-a:a,bb=b<0n?-b:b;if(bb===0n)return 1;const q=(aa<<40n)/bb;let v=Number(q)/Math.pow(2,40);if(!Number.isFinite(v))v=1e6;v=Math.min(1e6,v);return neg?-v:v;}
// Transform a previously rendered world-coordinate map into the *new* camera.
// The same affine reprojection is used for the detailed frame and the broad
// overview; aspect ratios and current pinch rotation are preserved exactly.
function paintReference(ctx,frame,from,rect,d,opacity=1){
 if(!frame||!from||from.id!==active.id)return false;
 const oldW=from.stageW||rect.width,oldH=from.stageH||rect.height;
 const oldMin=Math.min(oldW,oldH),newMin=Math.min(rect.width,rect.height);
 let ratio=from.scale/scale,dx=0,dy=0;
 if(deepEnabled||from.deep){
  const bits=Math.max(deepBits,from.bits),os=from.deep?fixedRescale(from.dscale,from.bits,bits):numberToFixed(from.scale,bits);
  const ns=deepEnabled?fixedRescale(deepScale,deepBits,bits):numberToFixed(scale,bits);
  ratio=ratioBigInt(os,ns);
  const ocx=from.deep?fixedRescale(from.dcx,from.bits,bits):numberToFixed(from.cx,bits);
  const ocy=from.deep?fixedRescale(from.dcy,from.bits,bits):numberToFixed(from.cy,bits);
  const ncx=deepEnabled?fixedRescale(deepCx,deepBits,bits):numberToFixed(centerX,bits);
  const ncy=deepEnabled?fixedRescale(deepCy,deepBits,bits):numberToFixed(centerY,bits);
  dx=ratioBigInt(ocx-ncx,ns)*newMin;dy=ratioBigInt(ocy-ncy,ns)*newMin;
 }else{dx=(from.cx-centerX)*newMin/scale;dy=(from.cy-centerY)*newMin/scale;}
 const co=Math.cos(rotation),si=Math.sin(rotation),screenDx=co*dx+si*dy,screenDy=-si*dx+co*dy;
 ratio=Math.min(1e5,Math.max(1e-5,ratio*newMin/oldMin));
 const dw=oldW*ratio,dh=oldH*ratio;
 ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.globalAlpha=opacity;
 ctx.translate((rect.width/2+screenDx)*d,(rect.height/2+screenDy)*d);
 ctx.rotate((from.rotation||0)-rotation);
 ctx.drawImage(frame,-dw*d/2,-dh*d/2,dw*d,dh*d);
 ctx.restore();return true;
}

function seedRenderBase(targetW,targetH){
 if(is3d)return false;
 const hasDetail=lastFrame&&lastRenderView&&lastRenderView.id===active.id;
 const hasOverview=overviewFrame&&overviewView&&overviewView.id===active.id;
 if(!hasDetail&&!hasOverview)return false;
 const rect=stage.getBoundingClientRect();
 if(rect.width<1||rect.height<1||targetW<2||targetH<2)return false;
 if(canvas2d.width!==targetW)canvas2d.width=targetW;
 if(canvas2d.height!==targetH)canvas2d.height=targetH;
 const ctx=canvas2d.getContext('2d',{alpha:false});
 const d=targetW/Math.max(1,rect.width);
 ctx.setTransform(1,0,0,1,0,0);
 ctx.clearRect(0,0,targetW,targetH);
 if(!hasOverview&&hasDetail){
  const oldRatio=lastRenderView.stageW/Math.max(1,lastRenderView.stageH);
  const fittedW=Math.max(targetW,targetH*oldRatio),fittedH=fittedW/oldRatio;
  const coverScale=Math.max(targetW/fittedW,targetH/fittedH);
  const fw=fittedW*coverScale,fh=fittedH*coverScale;
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.filter='blur(13px) brightness(.68)';
  ctx.drawImage(lastFrame,(targetW-fw)/2,(targetH-fh)/2,fw,fh);
  ctx.restore();
 }
 if(hasOverview)paintReference(ctx,overviewFrame,overviewView,rect,d,1);
 if(hasDetail)paintReference(ctx,lastFrame,lastRenderView,rect,d,1);
 clearPreview();
 stage.classList.remove('reprojecting');
 return true;
}
function updatePreview(){
 if(is3d||!previewCanvas)return;
 const hasDetail=lastFrame&&lastRenderView&&lastRenderView.id===active.id;
 const hasOverview=overviewFrame&&overviewView&&overviewView.id===active.id;
 if(!hasDetail&&!hasOverview)return;
 const rect=stage.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
 const d=Math.min(window.devicePixelRatio||1,1.35),w=Math.max(1,Math.round(rect.width*d)),h=Math.max(1,Math.round(rect.height*d));
 if(previewCanvas.width!==w)previewCanvas.width=w;if(previewCanvas.height!==h)previewCanvas.height=h;
 const ctx=previewCanvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
 // Until the real overview is ready, diffuse the last frame behind the sharp
 // reprojected area. Unlike the old code this never paints black borders.
 if(!hasOverview&&hasDetail){
  // The temporary background must be uniformly scaled. A direct stretch
  // from a portrait canvas to a landscape canvas would visibly squash the art.
  const oldRatio=lastRenderView.stageW/Math.max(1,lastRenderView.stageH);
  const fittedW=Math.max(w,h*oldRatio),fittedH=fittedW/oldRatio;
  const coverScale=Math.max(w/fittedW,h/fittedH);
  const fw=fittedW*coverScale,fh=fittedH*coverScale;
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.filter='blur(13px) brightness(.68)';
  ctx.drawImage(lastFrame,(w-fw)/2,(h-fh)/2,fw,fh);ctx.restore();
 }
 if(hasOverview)paintReference(ctx,overviewFrame,overviewView,rect,d);
 if(hasDetail)paintReference(ctx,lastFrame,lastRenderView,rect,d);
 previewCanvas.hidden=false;previewCanvas.style.opacity='1';previewActive=true;
 // Hide the old canvas while the viewport dimensions differ from the last
 // finished render. Otherwise CSS stretches its obsolete bitmap for a frame.
 stage.classList.add('reprojecting');
}

function ensureRenderer3d(){
 if(renderer3d)return !!renderer3d.ok;
 try{renderer3d=new FractInt3D(canvas3d);if(!renderer3d.ok)throw Error('WebGL2 assente');return true;}
 catch(e){console.warn('Renderer 3D non disponibile',e);renderer3d={ok:false};showToast('3D non disponibile su questo telefono');return false;}
}
function resize3d(highQuality=false){if(!renderer3d||!renderer3d.ok)return;if(highQuality){const target=getRenderTarget(stage.getBoundingClientRect(),true,true);renderer3d.resize(target.width,target.height);}else renderer3d.resize();}
function draw3d(highQuality=false,automatic=false){
 if(!ensureRenderer3d())return;
 const rect=stage.getBoundingClientRect(),target=highQuality?getRenderTarget(rect,true,true,automatic):null;
 const estimate=Math.max(800,Math.min(12000,(target?target.pixels:canvas3d.width*canvas3d.height)/1000000*1700));
 const showProgress=!automatic&&(fullscreenPendingRender||!artOnly||highQuality);
 fullscreenPendingRender=false;
 if(showProgress)showLoader('SCULTURA IN RENDERING',estimate);else hideLoader();
 $('renderQualityHint').textContent=target?`${target.width} × ${target.height} · ${(target.pixels/1e6).toFixed(1)} MP · ALTA DEFINIZIONE`:'RENDER GPU';
 const serial=refineSerial;
 requestAnimationFrame(()=>{
  if(serial!==refineSerial)return;
  try{
   renderer3d.setQuality(highQuality?1:0);
   if(target)renderer3d.resize(target.width,target.height,true);
   else renderer3d.resize(undefined,undefined,true);
   renderer3d.set({kind:active.id==='mandelbulb'?0:active.id==='menger'?1:active.id==='mandelbox'?2:3,
    power:+$('threePower').value,detail:Math.min(18,+$('threeDetail').value+(highQuality?2:0)),palette});
   if(!automatic)workerProgress(85);
   requestAnimationFrame(()=>{
    if(serial!==refineSerial)return;
    if(automatic)hideLoader();else finishLoader();
    $('renderStat').textContent='WebGL2 GPU'+(highQuality?' · dettaglio':'');
    if(!highQuality)planQuietRefinement(job);
   });
  }catch(e){console.warn('Render 3D:',e);hideLoader();}
 });
}
function scheduleDraw(hd=false){
 if(revealActive)flushRevealForInteraction();
 cancelRefinement();
 if(!is3d){job++;updatePreview();}
 clearTimeout(renderTimer);
 renderTimer=setTimeout(()=>is3d?draw3d(!!hd):draw2d(!!hd),45);
}
function updateHUD(){const z=zoomDisplay();$('zoomLabel').textContent='ZOOM '+(is3d?renderer3d?.zoom.toFixed(2)+'×':z);$('coordLabel').textContent='x: '+(deepEnabled?centerX.toPrecision(7):centerX.toFixed(5))+' · y: '+(deepEnabled?centerY.toPrecision(7):centerY.toFixed(5));$('positionStat').textContent=centerX.toFixed(3)+' / '+centerY.toFixed(3);$('zoomStat').textContent=is3d?renderer3d?.zoom.toFixed(2)+'×':z;$('precisionLabel').textContent=is3d?'WEBGL2 GPU':deepEnabled?'BIGINT '+deepBits+' BIT':'CPU / WORKER';}
function updateStats(){updateHUD();$('renderStat').textContent=is3d?'WebGL2 GPU':'Canvas CPU / Worker';}
function selectFormula(id){const found=catalog.find(f=>f.id===id);if(!found)return;if(found.id!==active.id){lastFrame=null;lastRenderView=null;stopOverview();}if(deepEnabled&&!['mandelbrot','julia'].includes(id)){updateDeepApprox();deepEnabled=false;}active=found;rotation=0;centerX=found.center[0];centerY=found.center[1];scale=found.scale;if(deepEnabled)deepInit();iterations=found.iterations;power=found.power||2;$('iterations').value=iterations;$('iterationsValue').value=iterations;$('power').value=power;$('powerValue').value=power.toFixed(1);$('currentTitle').textContent=found.name;$('currentCategory').textContent=found.group.toUpperCase();$('deepZoomBtn').hidden=!['mandelbrot','julia'].includes(id);$('deepPrecisionBlock').hidden=!['mandelbrot','julia'].includes(id);$('deepZoomBtn').classList.toggle('active',deepEnabled);$('deepZoomBtn').innerHTML=deepEnabled?'∞ <span>DEEP ON</span>':'∞ <span>DEEP ZOOM</span>';$('juliaBlock').hidden=id!=='julia';$('powerBlock').hidden=!['multibrot','julia'].includes(id);$('power').disabled=false;$('power').value=power;$('powerValue').value=power.toFixed(1);setCanvasMode(found.mode==='3D');$('threePower').value=found.power||8;$('threePowerValue').value=$('threePower').value;$('threePower').disabled=id!=='mandelbulb';$('threeDetail').value=found.iterations;$('threeDetailValue').value=$('threeDetail').value;populatePresets();renderLibrary();scheduleDraw();updateHUD();}
function renderLibrary(){let q=$('searchFormula').value.toLowerCase().trim(),items=catalog.filter(f=>(category==='all'||f.category===category)&&(!q||(f.name+' '+f.group+' '+f.description).toLowerCase().includes(q)));let html='',last='';for(let f of items){if(f.group!==last){html+=`<div class="list-group">${f.group}</div>`;last=f.group;}html+=`<button class="formula-item ${active.id===f.id?'active':''}" data-id="${f.id}"><span class="formula-glyph">${f.glyph}</span><span class="formula-meta"><span class="formula-name">${f.name}</span><span class="formula-type">${f.mode} · ${f.category==='complex'?'DYNAMICS':f.category==='geometry'?'GEOMETRY':f.category==='nature'?'NATURE':f.category==='attractors'?'CHAOS':f.category==='random'?'STOCHASTIC':'VOLUMETRIC'}</span></span>${favorites.has(f.id)?'<span class="item-star">★</span>':''}</button>`;} $('formulaList').innerHTML=html||'<div class="empty-state">Nessun frattale trovato</div>'; $('formulaCount').textContent=items.length+' FORMULE';}
function populatePresets(){let presets=window.FRACTAL_PRESETS[active.id]||[];$('preset').innerHTML='<option value="">Scegli una composizione…</option>'+presets.map((p,i)=>`<option value="${i}">${p[0]}</option>`).join('');}
function applyPreset(index){let list=window.FRACTAL_PRESETS[active.id]||[],p=list[index];if(!p)return;rotation=0;centerX=p[1][0];centerY=p[1][1];scale=p[2];if(active.mode==='3D'){$('threePower').value=p[3];$('threePowerValue').value=p[3];renderer3d.power=p[3];}else{iterations=p[3];$('iterations').value=iterations;$('iterationsValue').value=iterations;}if(deepEnabled)deepInit();scheduleDraw();}
function screenOffset(x,y){
 const r=stage.getBoundingClientRect(),side=Math.max(1,Math.min(r.width,r.height));
 return {dx:((x??(r.left+r.width/2))-r.left-r.width/2)/side,dy:((y??(r.top+r.height/2))-r.top-r.height/2)/side};
}
function noteFocus(x,y){
 const r=stage.getBoundingClientRect();
 const sx=(x==null?r.left+r.width/2:x),sy=(y==null?r.top+r.height/2:y);
 focusNormX=clamp01((sx-r.left)/Math.max(1,r.width));
 focusNormY=clamp01((sy-r.top)/Math.max(1,r.height));
 lastZoomFocusAt=performance.now();
}
function worldAt(x,y){
 const {dx,dy}=screenOffset(x,y),co=Math.cos(rotation),si=Math.sin(rotation);
 if(deepEnabled){
  const qx=deepRatioQ(co*dx-si*dy,1),qy=deepRatioQ(si*dx+co*dy,1);
  return [deepCx+fixedMul(qx,deepScale),deepCy+fixedMul(qy,deepScale)];
 }
 return [centerX+(co*dx-si*dy)*scale,centerY+(si*dx+co*dy)*scale];
}
function centerOnAnchor(anchor,x,y){
 const {dx,dy}=screenOffset(x,y),co=Math.cos(rotation),si=Math.sin(rotation);
 if(deepEnabled){
  deepCx=anchor[0]-fixedMul(deepRatioQ(co*dx-si*dy,1),deepScale);
  deepCy=anchor[1]-fixedMul(deepRatioQ(si*dx+co*dy,1),deepScale);updateDeepApprox();
 }else{
  centerX=anchor[0]-(co*dx-si*dy)*scale;
  centerY=anchor[1]-(si*dx+co*dy)*scale;
 }
}
function angleDifference(next,prev){return Math.atan2(Math.sin(next-prev),Math.cos(next-prev));}
function pinchGesture(touches){
 if(touches.length!==2)return;
 const a=touches[0],b=touches[1],distance=Math.max(1,Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY));
 const angle=Math.atan2(b.clientY-a.clientY,b.clientX-a.clientX);
 const midX=(a.clientX+b.clientX)/2,midY=(a.clientY+b.clientY)/2; noteFocus(midX,midY);
 if(!pinch){pinch={distance,angle,midX,midY};drag=null;disarmInvisibleExit();return;}
 const factor=Math.max(.5,Math.min(2,pinch.distance/distance));
 const delta=angleDifference(angle,pinch.angle);
 if(is3d){
  renderer3d.zoom=Math.max(.35,Math.min(12,renderer3d.zoom/factor));
  renderer3d.rotZ-=delta;
 }else{
  const anchor=worldAt(pinch.midX,pinch.midY);
  if(deepEnabled){deepScale=fixedMul(deepScale,numberToFixed(factor));if(deepScale<minDeepSpan())deepScale=minDeepSpan();}
  else{const nextScale=scale*factor;if(nextScale<1e-13&&deepAllowed())deepInit();if(deepEnabled){deepScale=fixedMul(deepScale,numberToFixed(factor));if(deepScale<minDeepSpan())deepScale=minDeepSpan();}else scale=Math.max(1e-300,Math.min(1000,nextScale));}
  rotation-=delta;
  if(Math.abs(rotation)>Math.PI*2)rotation=angleDifference(rotation,0);
  centerOnAnchor(anchor,midX,midY);
 }
 pinch={distance,angle,midX,midY};scheduleDraw();updateHUD();
}
function zoom(f,x,y){
 if(is3d){renderer3d.zoom=Math.max(.35,Math.min(12,renderer3d.zoom/f));scheduleDraw();return;}
 if(x==null&&y==null&&active.id==='sierpinski'){
  const r=stage.getBoundingClientRect(),wx=.285142857-centerX,wy=.599428571-centerY,co=Math.cos(rotation),si=Math.sin(rotation),side=Math.min(r.width,r.height);
  x=r.left+r.width/2+(co*wx+si*wy)/scale*side;
  y=r.top+r.height/2+(-si*wx+co*wy)/scale*side;
 }
 noteFocus(x,y);
 const anchor=worldAt(x,y);
 if(deepEnabled){deepScale=fixedMul(deepScale,numberToFixed(f));if(deepScale<minDeepSpan())deepScale=minDeepSpan();}
 else{let next=scale*f;if(next<1e-13&&deepAllowed()){deepInit();deepScale=fixedMul(deepScale,numberToFixed(f));if(deepScale<minDeepSpan())deepScale=minDeepSpan();}else scale=Math.max(1e-300,Math.min(1000,next));}
 centerOnAnchor(deepEnabled&&typeof anchor[0]!=='bigint'?[numberToFixed(anchor[0]),numberToFixed(anchor[1])]:anchor,x,y);scheduleDraw();updateHUD();
}
function resetView(){centerX=active.center[0];centerY=active.center[1];scale=active.scale;if(deepEnabled)deepInit();rotation=0;if(is3d){renderer3d.zoom=1;renderer3d.rotX=-.28;renderer3d.rotY=.45;renderer3d.rotZ=0;}scheduleDraw();updateHUD();}
function toggleFavorite(){if(favorites.has(active.id))favorites.delete(active.id);else favorites.add(active.id);try{localStorage.setItem('fractint-favorites',JSON.stringify([...favorites]));}catch(_){}$('favoriteBtn').innerHTML=(favorites.has(active.id)?'★':'☆')+' <span>Preferiti</span>';renderLibrary();}
function showFormulaInfo(){const f=active;$('modalContent').innerHTML=`<div class="modal-kicker">${f.group.toUpperCase()} · ${f.mode}</div><h2>${f.name}</h2><div class="formula-equation">${f.formula}</div><p>${f.description}</p><div class="modal-grid"><div><span>FAMIGLIA</span><b>${f.category}</b></div><div><span>RENDERER</span><b>${f.mode==='3D'?'WebGL2 ray marching':'CPU multithread / worker'}</b></div><div><span>POSIZIONE X</span><b>${centerX.toFixed(6)}</b></div><div><span>ZOOM</span><b>${is3d?renderer3d.zoom.toFixed(3)+'×':zoomDisplay()}</b></div></div>`;openModal();}
function openModal(){ $('modalBackdrop').classList.add('open');}function closeModal(){$('modalBackdrop').classList.remove('open');}
// v4.6.9: a single CSS-pixel world scale survives every Telegram viewport
// resize. Do not snap to an early intermediate dimension, nor use any
// size-dependent correction from an old anchor after the gesture has moved.
let artOnly=false,pressExitTimer=0,tgBackHandler=null;
let fullscreenGeneration=0;
function screenGeometry(){const r=stage.getBoundingClientRect();return {width:r.width,height:r.height,short:Math.max(1,Math.min(r.width,r.height))};}
function syncViewportGeometry(){
 const next=screenGeometry();if(next.width<1||next.height<1)return false;
 if(!stageGeometryRef){stageGeometryRef=next;return false;}
 const old=stageGeometryRef;
 if(Math.abs(next.width-old.width)<.25&&Math.abs(next.height-old.height)<.25)return false;
 stageGeometryRef=next;
 const ratio=next.short/old.short;
 // Keep world units / CSS pixel invariant. Centre and rotation never change.
 if(deepEnabled){deepScale=deepScale*BigInt(Math.round(ratio*1000000000))/1000000000n;
  if(deepScale<minDeepSpan())deepScale=minDeepSpan();updateDeepApprox();}
 else if(!is3d)scale*=ratio;
 else if(renderer3d?.ok){
  // The 3D shader normalizes uv by canvas height, not its shortest side.
  renderer3d.frameRatio*=next.height/Math.max(1,old.height);
 }
 if(!is3d){updatePreview();scheduleDraw(false);}else{resize3d(false);scheduleDraw(false);}
 updateHUD();return true;
}
function scheduleGeometrySync(){
 if(stageResizeRAF)return;
 stageResizeRAF=requestAnimationFrame(()=>{stageResizeRAF=0;syncViewportGeometry();});
}
async function toggleArtOnly(force){
 const next=typeof force==='boolean'?force:!artOnly,tg=window.Telegram?.WebApp;
 if(next===artOnly)return;
 const token=++fullscreenGeneration;
 cancelRefinement();clearTimeout(renderTimer);
 // Take the previous frame as the stable reference before CSS changes.
 if(!is3d&&lastFrame&&lastRenderView)updatePreview();
 stageGeometryRef=screenGeometry();
 job++;
 artOnly=next;
 document.body.classList.toggle('art-only',next);
 $('fullscreenBtn').setAttribute('aria-pressed',String(next));
 syncViewportGeometry();
 // Telegram changes its viewport in several separate steps. ResizeObserver
 // handles each settled layout; keep the preview until the new image arrives.
 if(next){
  try{
   if(tg?.isVersionAtLeast?.('8.0')&&typeof tg.requestFullscreen==='function'){
    tg.setHeaderColor?.('#000000');tg.setBackgroundColor?.('#000000');tg.requestFullscreen();
   }else if(!document.fullscreenElement&&document.documentElement.requestFullscreen){
    await document.documentElement.requestFullscreen({navigationUI:'hide'});
   }
  }catch(e){console.warn('Fullscreen API:',e);}
  if(tg?.BackButton){tgBackHandler=()=>toggleArtOnly(false);tg.BackButton.onClick(tgBackHandler);tg.BackButton.show();}
 }else{
  if(tg?.BackButton){try{tg.BackButton.hide();if(tgBackHandler)tg.BackButton.offClick?.(tgBackHandler);}catch(_){}tgBackHandler=null;}
  try{if(tg?.isFullscreen&&typeof tg.exitFullscreen==='function')tg.exitFullscreen();else if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen();}catch(e){console.warn('Fullscreen exit:',e);}
  tg?.setHeaderColor?.('#0b1020');tg?.setBackgroundColor?.('#080b16');
 }
 if(token!==fullscreenGeneration)return;
 scheduleGeometrySync();
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(token!==fullscreenGeneration)return;
  if(!syncViewportGeometry()){
   // Trigger at least one render for the viewport restored with no size diff.
   scheduleDraw(false);
  }
 }));
}
function armInvisibleExit(e){if(!artOnly)return;const r=stage.getBoundingClientRect();if(e.clientX>r.right-78&&e.clientY<r.top+78){clearTimeout(pressExitTimer);pressExitTimer=setTimeout(()=>toggleArtOnly(false),900);}}
function disarmInvisibleExit(){clearTimeout(pressExitTimer);pressExitTimer=0;}
function randomFractal(){let list=catalog.filter(f=>f.category!=='three');selectFormula(list[Math.floor(Math.random()*list.length)].id);}
function bindRange(id,fn){$(id).addEventListener('input',e=>fn(+e.target.value));}
function setupInteractions(){
 $('formulaList').addEventListener('click',e=>{let b=e.target.closest('[data-id]');if(b){selectFormula(b.dataset.id);$('library').classList.remove('open');}});
 $('categoryTabs').addEventListener('click',e=>{let b=e.target.closest('[data-category]');if(!b)return;category=b.dataset.category;document.querySelectorAll('.cat-tab').forEach(x=>x.classList.toggle('active',x===b));renderLibrary();});$('searchFormula').addEventListener('input',renderLibrary);
 bindRange('iterations',v=>{iterations=v;$('iterationsValue').value=v;scheduleDraw();});bindRange('power',v=>{power=v;$('powerValue').value=v.toFixed(1);scheduleDraw();});bindRange('juliaReal',v=>{juliaReal=v;$('juliaRealValue').value=v.toFixed(2);scheduleDraw();});bindRange('juliaImag',v=>{juliaImag=v;$('juliaImagValue').value=v.toFixed(3);scheduleDraw();});bindRange('quality',v=>{quality=v/100;$('qualityValue').value=v+'%';scheduleDraw();});bindRange('threePower',v=>{$('threePowerValue').value=v;if(renderer3d)renderer3d.power=v;scheduleDraw();});bindRange('threeDetail',v=>{$('threeDetailValue').value=v;if(renderer3d)renderer3d.detail=v;scheduleDraw();});
 $('palette').onchange=e=>{palette=e.target.value;syncPaletteButtons();refreshInterfaceTheme();scheduleDraw();};$('paletteCycle').onclick=()=>{let list=[...$('palette').options].map(o=>o.value),i=list.indexOf(palette);palette=list[(i+1)%list.length];$('palette').value=palette;syncPaletteButtons();refreshInterfaceTheme();scheduleDraw();};$('preset').onchange=e=>applyPreset(+e.target.value);
 $('resetBtn').onclick=resetView;$('zoomIn').onclick=()=>zoom(.7);$('zoomOut').onclick=()=>zoom(1.4);$('deepZoomBtn').onclick=()=>setDeepMode(!deepEnabled);$('deepPrecision').onchange=e=>setDeepPrecision(+e.target.value);$('randomBtn').onclick=randomFractal;$('favoriteBtn').onclick=toggleFavorite;$('formulaInfoBtn').onclick=showFormulaInfo;$('highQualityBtn').onclick=()=>{cancelRefinement();clearTimeout(renderTimer);is3d?draw3d(true,false):draw2d(true,false);};$('randomJulia').onclick=()=>{juliaReal=+(Math.random()*1.2-.6).toFixed(3);juliaImag=+(Math.random()*1.2-.6).toFixed(3);$('juliaReal').value=juliaReal;$('juliaImag').value=juliaImag;$('juliaRealValue').value=juliaReal.toFixed(2);$('juliaImagValue').value=juliaImag.toFixed(3);selectFormula('julia');};
 $('fullscreenBtn').onclick=()=>toggleArtOnly();
 $('helpBtn').onclick=()=>{$('modalContent').innerHTML='<h2>Esplora i colori</h2><p>Scegli un’opera dalla collezione, esplora le <b>32 palette artistiche</b> o premi ✦ COLORI per una combinazione a sorpresa. Il pulsante ↻ CICLA anima le tinte; scegli ½×–4× per la velocità e ripremilo per fermarle.</p><p>Trascina con un dito; usa due dita per ingrandire, spostare e ruotare. Il tasto ⛶ mostra soltanto il frattale, senza i pannelli dell’app. Per uscire usa Indietro, Esc o una pressione prolungata nell’angolo in alto a destra.</p>';openModal();};
 $('modalClose').onclick=closeModal;$('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeModal();};
 $('openLibrary').onclick=()=>$('library').classList.add('open');$('closeLibrary').onclick=()=>$('library').classList.remove('open');$('collapseControls').onclick=()=>{$('controlPanel').classList.toggle('collapsed');};
 const pointerDown=e=>{

  if(e.target.closest('button,a,input,select'))return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(pinch)return;
  armInvisibleExit(e);stage.setPointerCapture?.(e.pointerId);
  drag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,cx:centerX,cy:centerY,dcx:deepCx,dcy:deepCy,rx:renderer3d?.rotX,ry:renderer3d?.rotY,moved:false};
 };
 const pointerMove=e=>{
  if(!drag||pinch||drag.pointerId!==e.pointerId)return;
  let dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.abs(dx)+Math.abs(dy)>2){drag.moved=true;disarmInvisibleExit();}
  if(is3d){renderer3d.rotY=drag.ry+dx*.008;renderer3d.rotX=Math.max(-1.5,Math.min(1.5,drag.rx+dy*.008));}
  else{
   const r=stage.getBoundingClientRect(),side=Math.max(1,Math.min(r.width,r.height)),co=Math.cos(rotation),si=Math.sin(rotation);
   const wx=(co*dx-si*dy)/side,wy=(si*dx+co*dy)/side;
   if(deepEnabled){deepCx=drag.dcx-fixedMul(deepScale,deepRatioQ(wx,1));deepCy=drag.dcy-fixedMul(deepScale,deepRatioQ(wy,1));updateDeepApprox();}
   else{centerX=drag.cx-wx*scale;centerY=drag.cy-wy*scale;}
  }
  scheduleDraw();updateHUD();
 };
 const pointerUp=e=>{if(!drag||drag.pointerId!==e.pointerId)return;disarmInvisibleExit();drag=null;};
 stage.addEventListener('pointerdown',pointerDown);
 stage.addEventListener('pointermove',pointerMove);
 stage.addEventListener('pointerup',pointerUp);
 stage.addEventListener('pointercancel',pointerUp);
 stage.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?.8:1.25,e.clientX,e.clientY);},{passive:false});
 stage.addEventListener('dblclick',e=>zoom(.5,e.clientX,e.clientY));
 stage.addEventListener('touchstart',e=>{if(e.touches.length===2)pinchGesture(e.touches);},{passive:false});
 stage.addEventListener('touchmove',e=>{if(e.touches.length===2){e.preventDefault();pinchGesture(e.touches);}},{passive:false});
 stage.addEventListener('touchend',e=>{if(e.touches.length<2)pinch=null;if(e.touches.length===1)drag=null;},{passive:true});
 stage.addEventListener('touchcancel',()=>{pinch=null;drag=null;});
 window.addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;if(e.key==='+'||e.key==='=')zoom(.7);if(e.key==='-')zoom(1.4);if(e.key.toLowerCase()==='r')resetView();if(e.key==='Escape'){if(artOnly){toggleArtOnly(false);return;}$('library').classList.remove('open');closeModal();}if(e.key===' '){e.preventDefault();$('controlPanel').classList.toggle('collapsed');}if(e.key.startsWith('Arrow')){if(deepEnabled){let d=deepScale/12n;if(e.key==='ArrowLeft')deepCx-=d;if(e.key==='ArrowRight')deepCx+=d;if(e.key==='ArrowUp')deepCy-=d;if(e.key==='ArrowDown')deepCy+=d;updateDeepApprox();}else{let d=scale*.08;if(e.key==='ArrowLeft')centerX-=d;if(e.key==='ArrowRight')centerX+=d;if(e.key==='ArrowUp')centerY-=d;if(e.key==='ArrowDown')centerY+=d;}scheduleDraw();updateHUD();}});
 window.addEventListener('resize',scheduleGeometrySync);
 window.visualViewport?.addEventListener('resize',scheduleGeometrySync);
}

function setupPaletteChooser(){
 const entries=Object.entries(window.FRACTAL_PALETTES||{});
 const select=$('palette'),strip=$('paletteStrip');
 select.replaceChildren(...entries.map(([key,v])=>new Option(v.name,key)));
 strip.innerHTML=entries.map(([key,v])=>`<button class="palette-chip" type="button" data-palette="${key}" aria-label="Colori ${v.name}"><i class="swatch" style="background:linear-gradient(105deg,${v.stops.join(',')})"></i><span>${v.name}</span></button>`).join('');
 $('paletteCycle').title='Palette successiva';
 $('colorSurpriseBtn').onclick=()=>{const values=entries.map(e=>e[0]).filter(key=>key!==palette);palette=values[Math.floor(Math.random()*values.length)];select.value=palette;syncPaletteButtons();refreshInterfaceTheme();scheduleDraw();};
}
function syncPaletteButtons(){document.querySelectorAll('.palette-chip').forEach(b=>b.classList.toggle('active',b.dataset.palette===palette));}
let activeArtId='violet-reverie',artFilter='all';
function renderArtCards(){
 const list=(window.FRACTAL_ART_PRESETS||[]).filter(p=>artFilter==='all'||p.mood===artFilter);
 $('artCards').innerHTML=list.map(p=>`<button class="art-card ${activeArtId===p.id?'selected':''}" data-art-id="${p.id}" aria-label="Apri ${p.title}"><span class="art-thumb art-${p.scene}"><i></i><b></b></span><span class="art-card-copy"><strong>${p.title}</strong><small>${p.subtitle}</small></span></button>`).join('');
 $('artCount').textContent=list.length+' '+(list.length===1?'opera':'opere');
}
function applyArtPreset(id){
 const p=(window.FRACTAL_ART_PRESETS||[]).find(x=>x.id===id);if(!p)return;rotation=0;
 if(deepEnabled){updateDeepApprox();deepEnabled=false;}
 selectFormula(p.fractal);
 activeArtId=p.id;centerX=p.cx;centerY=p.cy;scale=p.scale;iterations=p.iterations||active.iterations;palette=p.palette||'cosmic';
 if(typeof p.power==='number')power=p.power;
 if(typeof p.juliaReal==='number')juliaReal=p.juliaReal;
 if(typeof p.juliaImag==='number')juliaImag=p.juliaImag;
 $('iterations').value=iterations;$('iterationsValue').value=iterations;
 $('power').value=power;$('powerValue').value=power.toFixed(1);
 $('juliaReal').value=juliaReal;$('juliaRealValue').value=juliaReal.toFixed(2);
 $('juliaImag').value=juliaImag;$('juliaImagValue').value=juliaImag.toFixed(3);
 $('palette').value=palette;
 if(active.mode==='3D'){$('threePower').value=p.threePower||8;$('threePowerValue').value=$('threePower').value;$('threeDetail').value=p.threeDetail||10;$('threeDetailValue').value=$('threeDetail').value;if(ensureRenderer3d()){renderer3d.power=+$('threePower').value;renderer3d.detail=+$('threeDetail').value;renderer3d.zoom=1;renderer3d.rotX=p.rotX??-.28;renderer3d.rotY=p.rotY??.45;}}
 $('currentTitle').textContent=p.title;$('currentCategory').textContent=({cosmos:'COSMIC COLLECTION',floral:'BOTANICAL DREAMS',geometry:'INFINITE PATTERNS',nature:'INSPIRED BY NATURE',chaos:'DYNAMICAL WORLDS',random:'STOCHASTIC ART',three:'SCULPTURES IN SPACE'})[p.mood]||'FRACTAL ART';
 $('favoriteBtn').textContent=favorites.has(active.id)?'★':'♡';
 document.body.dataset.artMood=p.mood;
 renderArtCards();
 syncPaletteButtons();
 refreshInterfaceTheme();
 noteFocus();
 artTransitionUntil=performance.now()+1200;
 $('deepZoomBtn').classList.remove('active');$('deepZoomBtn').setAttribute('aria-pressed','false');
 scheduleDraw();updateHUD();
}
function initArtExplorer(){
 renderArtCards();
 $('artFilters').addEventListener('click',e=>{const b=e.target.closest('[data-art-filter]');if(!b)return;artFilter=b.dataset.artFilter;document.querySelectorAll('.art-filter').forEach(x=>x.classList.toggle('active',x===b));renderArtCards();});
 $('artCards').addEventListener('click',e=>{const b=e.target.closest('[data-art-id]');if(b)applyArtPreset(b.dataset.artId);});
 document.querySelectorAll('.palette-chip').forEach(b=>b.addEventListener('click',()=>{palette=b.dataset.palette;$('palette').value=palette;document.querySelectorAll('.palette-chip').forEach(x=>x.classList.toggle('active',x===b));refreshInterfaceTheme();scheduleDraw();}));
 $('formulaList').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(!b)return;const p=(window.FRACTAL_ART_PRESETS||[]).find(x=>x.fractal===b.dataset.id);if(p)setTimeout(()=>applyArtPreset(p.id),0);});
 $('randomBtn').onclick=()=>{const list=(window.FRACTAL_ART_PRESETS||[]).filter(p=>p.id!==activeArtId);applyArtPreset(list[Math.floor(Math.random()*list.length)].id);};
 $('resetBtn').onclick=()=>applyArtPreset(activeArtId||'violet-reverie');
 $('favoriteBtn').onclick=()=>toggleFavorite();
 $('formulaInfoBtn').onclick=()=>{const p=(window.FRACTAL_ART_PRESETS||[]).find(x=>x.id===activeArtId);if(!p)return;$('modalContent').innerHTML=`<div class="modal-kicker">${p.subtitle}</div><h2>${p.title}</h2><p>Una piccola finestra su un mondo infinito. Lasciati guidare dalle forme, cambia colore e segui i dettagli: ogni viaggio è unico.</p>`;openModal();};
 $('helpBtn').onclick=()=>{$('modalContent').innerHTML='<h2>Esplora i colori</h2><p>Scegli un’opera dalla collezione, esplora le <b>32 palette artistiche</b> o premi ✦ COLORI per una combinazione a sorpresa. Il pulsante ↻ CICLA anima le tinte; scegli ½×–4× per la velocità e ripremilo per fermarle.</p><p>Trascina con un dito; usa due dita per ingrandire, spostare e ruotare. Il tasto ⛶ mostra soltanto il frattale, senza i pannelli dell’app. Per uscire usa Indietro, Esc o una pressione prolungata nell’angolo in alto a destra.</p>';openModal();};
}

function start(){
 canvas3d.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelRefinement();showToast('Grafica 3D in ripristino');});
 canvas3d.addEventListener('webglcontextrestored',()=>{renderer3d=null;if(is3d)scheduleDraw();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelRefinement();});
 stageGeometryRef=screenGeometry();uiThemeBase=INTERFACE_THEMES[Math.floor(Math.random()*INTERFACE_THEMES.length)];refreshInterfaceTheme();if(typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleGeometrySync).observe(stage);setupPaletteChooser();initColorCycle();initWorker();/* La GPU 3D si inizializza soltanto quando serve, dopo lo splash. */setupInteractions();renderLibrary();$('favoriteBtn').innerHTML=(favorites.has(active.id)?'★':'☆')+' <span>Preferiti</span>';selectFormula('mandelbrot');initArtExplorer();applyArtPreset('violet-reverie');if(window.Telegram?.WebApp){let tg=window.Telegram.WebApp;tg.ready();tg.expand();tg.setHeaderColor?.('#0b1020');tg.setBackgroundColor?.('#080b16');if(tg.isVersionAtLeast?.('8.0')){tg.onEvent?.('fullscreenChanged',()=>{document.body.classList.toggle('telegram-fullscreen',!!tg.isFullscreen);if(!tg.isFullscreen&&artOnly)toggleArtOnly(false);});tg.onEvent?.('fullscreenFailed',()=>{document.body.classList.toggle('art-only',artOnly);});tg.onEvent?.('viewportChanged',e=>{scheduleGeometrySync();});} }if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('service-worker.js?v=4710',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});}
try{start();}catch(e){console.error('Avvio Fractal Art Explorer:',e);const g=document.getElementById('artCards');if(g&&!g.children.length&&window.FRACTAL_ART_PRESETS){g.innerHTML=window.FRACTAL_ART_PRESETS.map(p=>`<button class="art-card" onclick="location.reload()"><span class="art-card-copy"><strong>${p.title}</strong><small>${p.subtitle}</small></span></button>`).join('');}const status=document.getElementById('engineStatus');if(status)status.textContent='AVVIO INCOMPLETO — RIAPRI LA MINI APP';}
})();
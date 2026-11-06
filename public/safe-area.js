// Insets are CSS pixels, not screenshot/device pixels. System and Telegram areas are distinct.
export function safeInsets(tg){const mobile=['android','ios'].includes(tg?.platform),full=!!tg?.isFullscreen;const pick=(o,k,f=0)=>Number.isFinite(o?.[k])?Math.max(0,Math.min(180,o[k])):f;return Object.fromEntries(['top','bottom','left','right'].map(side=>[side,{system:pick(tg?.safeAreaInset,side),content:pick(tg?.contentSafeAreaInset,side,side==='top'&&full&&mobile?56:0)}]))}
export function applyInsets(root,insets){for(const side of ['top','bottom','left','right']){const s=insets?.[side];if(!s)continue;for(const type of ['system','content']){const v=s[type];if(Number.isFinite(v)&&v>=0&&v<=180)root.style.setProperty('--'+type+'-safe-'+side,v+'px')}}}

// Desktop Telegram can report a stable height left over from its previous window.
// Layout uses CSS pixels; devicePixelRatio only belongs to the renderer's backing buffer.
export function viewportHeight(tg,view){
 const valid=n=>Number.isFinite(n)&&n>0;
 const mobile=['android','ios'].includes(tg?.platform);
 const candidates=mobile&&!view.fullscreen?[tg?.viewportStableHeight,view.visualHeight,view.innerHeight]:[view.visualHeight,view.innerHeight,tg?.viewportStableHeight];
 return candidates.find(valid)||1;
}

import {applyInsets} from '../safe-area.js';

if(window.parent!==window){
  window.addEventListener('message',event=>{
    if(event.origin===location.origin&&event.source===parent&&event.data?.type==='arcade:insets'){
      applyInsets(document.documentElement,event.data.insets);
    }
  });
  document.querySelector('[data-arcade-back]').addEventListener('click',event=>{
    event.preventDefault();
    parent.postMessage({type:'arcade:exit'},location.origin);
  });
  parent.postMessage({type:'arcade:ready'},location.origin);
}

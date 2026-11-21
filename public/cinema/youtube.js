let pending;
function api(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(!pending)pending=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const previous=window.onYouTubeIframeAPIReady;
    const timeout=setTimeout(()=>fail(),12000);
    function fail(){
      clearTimeout(timeout);script.remove();pending=null;
      window.onYouTubeIframeAPIReady=previous;
      reject(Error('Player YouTube non disponibile.'));
    }
    window.onYouTubeIframeAPIReady=()=>{
      clearTimeout(timeout);
      window.onYouTubeIframeAPIReady=previous;
      resolve(window.YT);previous?.();
    };
    script.onerror=fail;
    script.src='https://www.youtube.com/iframe_api';
    document.head.append(script);
  });
  return pending;
}

export function embedYouTube(container,id,events){
  let player,closed=false;
  api().then(YT=>{
    if(closed)return;
    const frame=document.createElement('iframe');
    const query=new URLSearchParams({enablejsapi:'1',origin:location.origin,controls:'1',playsinline:'1',rel:'0',autoplay:'0'});
    frame.src='https://www.youtube.com/embed/'+id+'?'+query;
    frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.allow='autoplay; encrypted-media; fullscreen';
    frame.allowFullscreen=true;
    frame.title='Video YouTube condiviso';
    container.replaceChildren(frame);
    player=new YT.Player(frame,{events:{
      onReady:event=>{if(!closed)events.ready(event.target);},
      onStateChange:event=>{if(!closed)events.state(event.data);},
      onAutoplayBlocked:()=>{if(!closed)events.blocked();},
      onError:event=>{if(!closed)events.error(event.data);}
    }});
  }).catch(()=>{if(!closed)events.error();});
  return ()=>{
    closed=true;
    player?.destroy();
    container.replaceChildren();
  };
}

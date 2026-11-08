export function youtubeId(value){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password)return null;
    const parts=url.pathname.split('/').filter(Boolean);
    const id=url.hostname==='youtu.be'?parts[0]:
      ['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(url.hostname)?
        (parts[0]==='watch'?url.searchParams.get('v'):['live','shorts','embed'].includes(parts[0])?parts[1]:null):null;
    return /^[\w-]{11}$/.test(id??'')?id:null;
  }catch{return null;}
}

export function positionAt(playback,now){
  if(!playback)return 0;
  return playback.position+(playback.playing?Math.max(0,now-playback.updated)/1000:0);
}

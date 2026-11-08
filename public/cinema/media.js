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

export const validYouTubeChannelId=value=>/^UC[\w-]{22}$/.test(value??'');
export function youtubeChannelId(value){
  if(validYouTubeChannelId(value))return value;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||!['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname))return null;
    const match=url.pathname.match(/^\/channel\/(UC[\w-]{22})(?:\/|$)/);
    return match?.[1]??null;
  }catch{return null;}
}

export function telegramCallLink(value){
  if(typeof value!=='string'||value.length>300)return null;
  try{
    const url=new URL(value.trim());
    if(url.protocol!=='https:'||url.hostname!=='t.me'||url.port||url.username||url.password)return null;
    if(/^\/call\/[A-Za-z0-9_-]+\/?$/.test(url.pathname))return 'https://t.me'+url.pathname.replace(/\/$/,'');
    if(!/^\/[A-Za-z0-9_]+\/?$/.test(url.pathname))return null;
    const type=['videochat','livestream'].find(name=>url.searchParams.has(name));
    const token=type&&url.searchParams.get(type);
    if(!type||!/^[A-Za-z0-9_-]*$/.test(token))return null;
    return 'https://t.me'+url.pathname.replace(/\/$/,'')+'?'+type+(token?'='+token:'');
  }catch{return null;}
}

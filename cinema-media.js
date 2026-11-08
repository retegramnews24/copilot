const META='cinema-upload';
const CHUNK=64*1024;
export const MEDIA_LIMIT=16*1024*1024;
export const MEDIA_TTL=2*60*60*1000;
export const MEDIA_TYPES=new Set(['video/mp4','video/webm']);

const TELEGRAM_TYPES=new Set(['image/gif','image/jpeg','image/png','image/webp','audio/mpeg','audio/ogg','audio/mp4']);

function validHeader(bytes,type){
  const signature=(start,end)=>String.fromCharCode(...bytes.subarray(start,end));
  if(type==='image/png')return bytes[0]===137&&signature(1,4)==='PNG';
  if(type==='image/webp')return signature(0,4)==='RIFF'&&signature(8,12)==='WEBP';
  if(type==='audio/ogg')return signature(0,4)==='OggS';
  if(type==='audio/mpeg')return signature(0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224);
  if(type==='image/gif')return bytes.length>=13&&/^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0,6)));
  if(type==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==='video/mp4'||type==='audio/mp4')return bytes.length>=12&&String.fromCharCode(...bytes.subarray(4,8))==='ftyp';
  return bytes.length>=4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
}
export async function storeCinemaMedia(req,storage){
  const type=req.headers.get('Content-Type'),expected=Number(req.headers.get('Content-Length'));
  if((!MEDIA_TYPES.has(type)&&!TELEGRAM_TYPES.has(type))||!req.body)return new Response(null,{status:415});
  if(expected>MEDIA_LIMIT)return new Response(null,{status:413});
  const expires=Number(req.headers.get('X-Media-Expires'));
  await storage.put(META,{type,size:0,expires});
  await storage.setAlarm(expires);
  const reader=req.body.getReader();
  let chunk=new Uint8Array(CHUNK),used=0,size=0,index=0;
  async function saveChunk(){
    if(index===0&&!validHeader(chunk.subarray(0,used),type))return false;
    await storage.put('part:'+index++,chunk.slice(0,used));
    chunk=new Uint8Array(CHUNK);used=0;
    return true;
  }
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MEDIA_LIMIT)return new Response(null,{status:413});
      for(let offset=0;offset<value.byteLength;){
        const count=Math.min(CHUNK-used,value.byteLength-offset);
        chunk.set(value.subarray(offset,offset+count),used);
        used+=count;offset+=count;
        if(used===CHUNK&&!await saveChunk())return new Response(null,{status:415});
      }
    }
    if(!size||(used&&!await saveChunk()))return new Response(null,{status:415});
    await storage.put(META,{type,size,expires});
    return new Response(null,{status:201});
  }finally{
    reader.cancel().catch(()=>{});
    if(!(await storage.get(META))?.size)await storage.deleteAll();
  }
}

export async function readCinemaMedia(req,storage){
  const meta=await storage.get(META);
  if(!meta?.size||meta.expires<=Date.now())return new Response(null,{status:404});
  const {type,size}=meta;
  const headers=new Headers({'Content-Type':type,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  const range=req.headers.get('Range');
  let first=0,last=size-1;
  if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(match?.[1]){
      first=Number(match[1]);
      if(match[2])last=Math.min(last,Number(match[2]));
    }else if(match?.[2]&&Number(match[2])>0)first=Math.max(0,size-Number(match[2]));
    else first=size;
    if(first>last){
      headers.set('Content-Range','bytes */'+size);
      return new Response(null,{status:416,headers});
    }
    headers.set('Content-Range',`bytes ${first}-${last}/${size}`);
  }
  headers.set('Content-Length',String(last-first+1));
  const body=req.method==='HEAD'?null:new ReadableStream({
    async pull(controller){
      const part=await storage.get('part:'+Math.floor(first/CHUNK));
      if(!part){controller.error(Error('File non disponibile.'));return;}
      const offset=first%CHUNK;
      const end=Math.min(part.length,offset+last-first+1);
      controller.enqueue(part.subarray(offset,end));
      first+=end-offset;
      if(first>last)controller.close();
    }
  });
  return new Response(body,{status:range?206:200,headers});
}

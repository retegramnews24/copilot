import {MEDIA_LIMIT,MEDIA_TTL,storeCinemaMedia} from './cinema-media.js';
import {isTelegramMember,telegramBotResult} from './telegram-access.js';

const GROUPS='cinema-groups', ID=/^[a-f0-9-]{36}$/;
const HOME='binotto corsa competizione';
const homeTitle=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()===HOME;
const assetKey=(group,id)=>'asset:'+group+':'+id;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const denied=()=>reply({error:'Questo media è riservato ai membri del gruppo Telegram.'},403);
const playableTypes=new Map([
  ['video/mp4','video'],['video/webm','video'],['image/jpeg','image'],
  ['image/png','image'],['image/gif','image'],['image/webp','image'],
  ['audio/mpeg','audio'],['audio/ogg','audio'],['audio/mp4','audio']
]);
export function cinemaSubmission(message){
  if(message?.chat?.type!=='private'||!Number.isSafeInteger(message.from?.id)||message.from.id<=0||
    message.from.id!==message.chat.id||message.from.is_bot||!Number.isSafeInteger(message.message_id))return null;
  if(!message.forward_origin&&/^\/(?:start|gioca)(?:@\w+)?(?:\s|$)/i.test(message.text??''))return null;
  const photo=message.photo?.at(-1),source=message.animation??message.video??message.video_note??
    message.audio??message.voice??photo??message.sticker??message.document;
  const fallbackType=photo?'image/jpeg':message.sticker&&!message.sticker.is_animated&&!message.sticker.is_video?'image/webp':
    message.voice?'audio/ogg':message.video||message.video_note||message.animation?'video/mp4':'';
  const type=(source?.mime_type||fallbackType).toLowerCase();
  const kind=playableTypes.get(type);
  const text=(message.text??message.caption??'').trim().slice(0,700);
  const file=typeof source?.file_id==='string'&&source.file_id.length<=512?source.file_id:'';
  const name=String(source?.file_name??source?.title??'').trim().slice(0,96);
  const info={user:String(message.from.id),message:message.message_id};
  if(message.has_protected_content||message.has_media_spoiler)return {...info,error:'Telegram protegge questo contenuto.'};
  if(kind&&file&&!(Number(source.file_size)>MEDIA_LIMIT)){
    const duration=kind==='image'||message.animation?12:Math.min(86400,Math.max(1,Number(source.duration)||120));
    return {...info,item:{kind,type,file,name:name||{video:'Video Telegram',image:'Immagine Telegram',audio:'Audio Telegram'}[kind],text,duration}};
  }
  const details=kind&&file?'File oltre 16 MB':name||message.poll?.question||message.contact?.first_name||
    (message.location?'Posizione condivisa':message.sticker?'Sticker Telegram':'Contenuto Telegram');
  return {...info,item:{kind:'text',name:message.text?'Messaggio Telegram':'Allegato Telegram',text:text||String(details).slice(0,700),duration:12}};
}

export class TelegramCinema {
  constructor(ctx,token){this.ctx=ctx;this.token=token;this.members=new Map();this.pending=new Map();}
  async member(chat,user,fresh=false){
    const key=chat+':'+user,now=Date.now(),saved=this.members.get(key);
    if(!fresh&&saved?.expires>now)return saved.value;
    if(this.pending.has(key))return this.pending.get(key);
    const lookup=telegramBotResult(this.token,'getChatMember',{chat_id:Number(chat),user_id:Number(user)}).then(value=>{
      if(this.members.size>=400)this.members.delete(this.members.keys().next().value);
      this.members.set(key,{value,expires:Date.now()+(value?30000:3000)});
      return value;
    }).finally(()=>this.pending.delete(key));
    this.pending.set(key,lookup);
    return lookup;
  }
  async fetch(req){
    const url=new URL(req.url),op=url.searchParams.get('op');
    const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
    if(!user?.id)return denied();
    const groups=await this.ctx.storage.get(GROUPS)??[];
    const group=groups.find(entry=>entry.id===url.searchParams.get('group'));
    if(!group||!homeTitle(group.title))return reply({error:'Gruppo non trovato.'},404);
    if(!isTelegramMember(await this.member(group.chatId,user.id)))return denied();
    if(op!=='asset')return reply({error:'Operazione non disponibile.'},404);
    const id=url.searchParams.get('item');
    if(!ID.test(id??''))return reply({error:'Media non disponibile.'},404);
    const imported=(await this.ctx.storage.get('forwards:'+group.id)??[]).find(item=>item.id===id);
    if(imported)return reply(imported);
    if(!group.linked)return denied();
    const key=await this.ctx.storage.get(assetKey(group.id,id));
    const item=key?await this.ctx.storage.get(key):(await this.ctx.storage.get('group:'+group.id)??[]).find(entry=>entry.id===id);
    if(item&&!item.loop&&['video/mp4','video/webm'].includes(item.type))return reply({file:item.file,type:item.type});
    return reply({error:'Media non disponibile.'},404);
  }
}

export async function cacheTelegramMedia(req,ctx,token){
  const already=await ctx.storage.get('cinema-upload');
  if(already?.size&&already.expires>Date.now())return new Response(null,{status:204});
  const {file,type}=await req.json();
  const info=await telegramBotResult(token,'getFile',{file_id:file});
  if(!info?.file_path||!/^[\w.-]+(?:\/[\w.-]+)+$/.test(info.file_path)||info.file_path.split('/').some(s=>s==='..'||s==='.'))return reply({error:'File Telegram non disponibile.'},404);
  if(Number(info.file_size)>MEDIA_LIMIT)return reply({error:'Il file supera 16 MB.'},413);
  try{
    const source=await fetch('https://api.telegram.org/file/bot'+token+'/'+info.file_path,{redirect:'manual',signal:AbortSignal.timeout(17000)});
    if(!source.ok||!source.body)return reply({error:'Download Telegram non disponibile.'},502);
    const headers=new Headers({'Content-Type':type,'X-Media-Expires':String(Date.now()+MEDIA_TTL)});
    const length=Number(source.headers.get('Content-Length'));
    if(length>MEDIA_LIMIT)return reply({error:'Il file supera 16 MB.'},413);
    if(already)await ctx.storage.deleteAll();
    return await storeCinemaMedia(new Request(req.url,{method:'POST',headers,body:source.body}),ctx.storage);
  }catch{return reply({error:'Download Telegram interrotto.'},502);}
}

export {ID as telegramCinemaId};

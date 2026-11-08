import {MEDIA_LIMIT,MEDIA_TTL,storeCinemaMedia} from './cinema-media.js';

const GROUPS='cinema-groups', ID=/^[a-f0-9-]{36}$/;
const HOME='binotto corsa competizione';
const homeTitle=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()===HOME;
const assetKey=(group,id)=>'asset:'+group+':'+id;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const denied=()=>reply({error:'Questo media è riservato ai membri del gruppo Telegram.'},403);
const isAdmin=member=>['creator','administrator'].includes(member?.status);
const isMember=member=>isAdmin(member)||member?.status==='member'||(member?.status==='restricted'&&member.is_member===true);

export async function telegramBotResult(token,method,payload){
  try{
    const result=await fetch('https://api.telegram.org/bot'+token+'/'+method,{
      method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(5500)
    });
    if(!result.ok)return null;
    const data=await result.json();
    return data.ok===true?data.result:null;
  }catch{return null;}
}

export function groupUpdate(message){
  const chat=message?.chat;
  if(!chat||!homeTitle(chat.title)||!['group','supergroup'].includes(chat.type)||!Number.isSafeInteger(chat.id)||chat.id>=0)return null;
  if(chat.is_forum&&message.is_topic_message&&message.message_thread_id!==1)return null;
  const chatId=String(chat.id),post=message.message_id;
  const name=/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(chat.username??'')?chat.username:null;
  const slug=name??(chatId.startsWith('-100')?'c/'+chatId.slice(4):null);
  const link=slug&&Number.isSafeInteger(post)&&post>0?'https://t.me/'+slug+'/'+post:null;
  return {chatId,title:chat.title,link,protected:!!(chat.has_protected_content||message.has_protected_content)};
}
export function forwardedVideo(message){
  if(message?.chat?.type!=='private'||!Number.isSafeInteger(message.from?.id)||message.from.id<=0||message.from.id!==message.chat.id||message.from.is_bot||!message.forward_origin)return null;
  const origin=message.forward_origin;
  const source=message.video??message.document;
  const mime=String(source?.mime_type??'').toLowerCase();
  const type=mime==='video/webm'?'video/webm':mime==='video/mp4'||(message.video&&!mime)?'video/mp4':null;
  let error;
  if(message.has_protected_content||message.has_media_spoiler)error='Questo video Telegram è protetto.';
  else if(message.animation||!source||!type||typeof source.file_id!=='string'||!source.file_id||source.file_id.length>512)error='Inoltra un video MP4 o WebM dalla Home del gruppo.';
  else if(Number(source.file_size)>MEDIA_LIMIT)error='Il video supera il limite di 16 MB.';
  return {user:String(message.from.id),origin:origin.chat?.id??origin.sender_chat?.id??null,
    ...(error?{error}:{file:source.file_id,type})};
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
  ingest(req){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const input=await req.json(),groups=await this.ctx.storage.get(GROUPS)??[];
      let group=groups.find(entry=>entry.chatId===input.chatId);
      if(!group){group={id:crypto.randomUUID(),linked:false};groups.push(group);}
      Object.assign(group,input,{link:input.link??group.link??null});
      await this.ctx.storage.put(GROUPS,groups);
      return reply({ok:true});
    });
  }
  async home(groups,user){
    const matches=await Promise.all(groups.filter(group=>homeTitle(group.title)).map(async group=>
      isMember(await this.member(group.chatId,user.id))?group:null));
    const available=matches.filter(Boolean),linked=available.filter(group=>group.linked);
    const candidates=linked.length?linked:available;
    if(!candidates.length)return reply({error:'Home di Binotto Corsa Competizione da rilevare. Manda un normale messaggio nella Home e riprova da Cinema.'},404);
    if(candidates.length>1)return reply({error:'Cinema ha rilevato più gruppi omonimi. Serve identificare la Home corretta.'},409);
    const group=candidates[0];
    if(group.protected)return reply({error:'Il gruppo protegge i suoi contenuti. Telegram blocca l’inoltro.'},409);
    if(!group.linked){
      const bot=await telegramBotResult(this.token,'getMe',{});
      if(!bot?.id||!isAdmin(await this.member(group.chatId,bot.id,true)))return reply({error:'Il bot Binottoland deve essere amministratore del gruppo.'},409);
    }
    return reply({id:group.id,chatId:group.chatId,link:group.link??null});
  }
  async fetch(req){
    const url=new URL(req.url),op=url.searchParams.get('op');
    if(op==='ingest')return this.ingest(req);
    const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
    if(!user?.id)return denied();
    const groups=await this.ctx.storage.get(GROUPS)??[];
    if(op==='home')return this.home(groups,user);
    const group=groups.find(entry=>entry.id===url.searchParams.get('group'));
    if(!group||!homeTitle(group.title))return reply({error:'Gruppo non trovato.'},404);
    if(!isMember(await this.member(group.chatId,user.id)))return denied();
    if(op==='import'){
      if(!homeTitle(group.title)||group.protected)return denied();
      const {file,type}=await req.json();
      if(!['video/mp4','video/webm'].includes(type)||typeof file!=='string'||!file||file.length>512)return reply({error:'Video non valido.'},400);
      return this.ctx.blockConcurrencyWhile(async()=>{
        const key='forwards:'+group.id,items=await this.ctx.storage.get(key)??[];
        const media={id:crypto.randomUUID(),file,type};
        await this.ctx.storage.put(key,[media,...items].slice(0,80));
        return reply({id:media.id});
      });
    }
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

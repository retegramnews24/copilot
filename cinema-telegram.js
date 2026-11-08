import {MEDIA_LIMIT,MEDIA_TTL,storeCinemaMedia} from './cinema-media.js';

const GROUPS='cinema-groups', ID=/^[a-f0-9-]{36}$/;
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
  if(!chat||!['group','supergroup'].includes(chat.type)||!Number.isSafeInteger(chat.id)||chat.id>=0)return null;
  const group={chatId:String(chat.id),title:String(chat.title||'Gruppo Telegram').slice(0,90)};
  if(chat.has_protected_content||message.has_protected_content||message.has_media_spoiler||message.from?.is_bot)return group;
  const source=message.animation||message.video||message.document;
  if(!source||!Number.isSafeInteger(message.message_id)||typeof source.file_id!=='string'||source.file_id.length>512)return group;
  const mime=String(source.mime_type||'').toLowerCase();
  const gif=mime==='image/gif'||/\.gif$/i.test(source.file_name??'');
  const type=gif?'image/gif':mime==='video/webm'?'video/webm':!mime||mime==='video/mp4'?'video/mp4':null;
  if(!type||(!message.animation&&!message.video&&!['image/gif','video/mp4','video/webm'].includes(mime)))return group;
  if(Number(source.file_size)>MEDIA_LIMIT)return group;
  const thumbnail=source.thumbnail?.file_id;
  group.media={message:message.message_id,date:message.date||0,title:String(message.caption||source.file_name||(message.animation||gif?'GIF':'Video')).trim().slice(0,90)||'Video',
    file:source.file_id,type,loop:!!message.animation||gif,thumb:typeof thumbnail==='string'&&thumbnail.length<=512?thumbnail:null};
  return group;
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
      if(!group){
        if(groups.length>=24){
          const oldest=groups.findIndex(entry=>!entry.linked);
          if(oldest<0)return reply({ok:true});
          groups.splice(oldest,1);
        }
        group={id:crypto.randomUUID(),chatId:input.chatId,title:input.title,linked:false};
        groups.push(group);
        await this.ctx.storage.put(GROUPS,groups);
      }else if(group.title!==input.title){
        group.title=input.title;await this.ctx.storage.put(GROUPS,groups);
      }
      if(!group.linked||!input.media)return reply({ok:true});
      const key='group:'+group.id,items=await this.ctx.storage.get(key)??[];
      if(items.some(item=>item.message===input.media.message))return reply({ok:true});
      const media={id:crypto.randomUUID(),...input.media};
      items.unshift(media);
      items.sort((a,b)=>b.date-a.date||b.message-a.message);
      await this.ctx.storage.put(key,items.slice(0,80));
      return reply({ok:true});
    });
  }
  async fetch(req){
    const url=new URL(req.url),op=url.searchParams.get('op');
    if(op==='ingest')return this.ingest(req);
    const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
    if(!user?.id)return denied();
    const groups=await this.ctx.storage.get(GROUPS)??[];
    if(op==='groups'){
      const allowed=await Promise.all(groups.map(async group=>{
        const member=await this.member(group.chatId,user.id);
        return (group.linked?isMember(member):isAdmin(member))?{id:group.id,title:group.title,linked:group.linked}:null;
      }));
      return reply({groups:allowed.filter(Boolean)});
    }
    const group=groups.find(entry=>entry.id===url.searchParams.get('group'));
    if(!group)return reply({error:'Gruppo non trovato.'},404);
    const member=await this.member(group.chatId,user.id,op==='link');
    if(op==='link'){
      if(!isAdmin(member))return denied();
      const bot=await telegramBotResult(this.token,'getMe',{});
      const permission=bot?.id&&await this.member(group.chatId,bot.id,true);
      if(!isAdmin(permission))return reply({error:'Binottoland deve essere amministratore del gruppo.'},409);
      return this.ctx.blockConcurrencyWhile(async()=>{
        const latest=await this.ctx.storage.get(GROUPS)??[];
        const selected=latest.find(entry=>entry.id===group.id);
        if(!selected)return reply({error:'Gruppo non trovato.'},404);
        selected.linked=true;
        await this.ctx.storage.put(GROUPS,latest);
        return reply({ok:true});
      });
    }
    if(!group.linked||!isMember(member))return denied();
    const items=await this.ctx.storage.get('group:'+group.id)??[];
    if(op==='items')return reply({items:items.map(({id,title,date,type,loop,thumb})=>({id,title,date,type,loop,thumb:!!thumb}))});
    const item=items.find(entry=>entry.id===url.searchParams.get('item'));
    if(op==='asset'&&item)return reply({file:item.file,thumb:item.thumb,type:item.type,loop:item.loop});
    return reply({error:'Media non disponibile.'},404);
  }
}

function loopGif(bytes){
  const palette=bytes[10]&128?3*2**((bytes[10]&7)+1):0;
  const start=13+palette;
  const extension=Uint8Array.of(33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0);
  for(let p=start;bytes[p]===33;){
    const end=p+extension.length;
    if(end<=bytes.length&&extension.subarray(0,16).every((byte,i)=>bytes[p+i]===byte)){
      bytes[p+16]=0;bytes[p+17]=0;return bytes;
    }
    p+=2;
    while(bytes[p]&&p<bytes.length)p+=bytes[p]+1;
    p++;
  }
  const out=new Uint8Array(bytes.length+extension.length);
  out.set(bytes.subarray(0,start));out.set(extension,start);out.set(bytes.subarray(start),start+extension.length);
  out.set([71,73,70,56,57,97]);return out;
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
    let body=source.body;
    if(type==='image/gif'){
      if(!(length>0||Number(info.file_size)>0))return reply({error:'GIF Telegram non disponibile.'},502);
      const bytes=new Uint8Array(await source.arrayBuffer());
      if(bytes.length<13||bytes.length+19>MEDIA_LIMIT)return reply({error:'GIF Telegram non disponibile.'},415);
      if(!/^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0,6))))return reply({error:'GIF Telegram non valida.'},415);
      const tableEnd=13+(bytes[10]&128?3*2**((bytes[10]&7)+1):0);
      if(tableEnd>=bytes.length)return reply({error:'GIF Telegram non valida.'},415);
      body=loopGif(bytes);
    }
    if(already)await ctx.storage.deleteAll();
    return await storeCinemaMedia(new Request(req.url,{method:'POST',headers,body}),ctx.storage);
  }catch{return reply({error:'Download Telegram interrotto.'},502);}
}

export {ID as telegramCinemaId};

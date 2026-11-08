import assert from 'node:assert/strict';
import {YouTubeCatalog} from '../cinema-youtube.js';
import {indexChannels,parseM3U,searchChannels} from '../public/cinema/catalog.js';
import {youtubeChannelId} from '../public/cinema/media.js';

const id='UC_x5XG1OV2P6uZZ5FSM9Ttw',first='dQw4w9WgXcQ',second='M7lc1UVf-VE';
assert.equal(youtubeChannelId('https://www.youtube.com/channel/'+id+'/videos'),id);
assert.equal(youtubeChannelId('https://www.youtube.com.example/channel/'+id),null);
const channels=parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="Rai1.it@HD" tvg-name="Rai Uno" tvg-language="ita" group-title="Notizie",Rai 1
/rai.m3u8#fragment
#EXTINF:-1 tvg-id='Sport.mt' group-title='Sports',Sport Malta
https://tv.example/malta.m3u8
#EXTINF:-1,HTTP only
http://tv.example/unavailable.m3u8`,'https://tv.example/feed.m3u');
assert.equal(channels.length,2);
assert.equal(channels[0].url,'https://tv.example/rai.m3u8');
const indexed=indexChannels([
  ...channels.map(row=>({...row,source:'IPTV-org'})),
  {name:'Rai Uno Alternativo',url:channels[0].url,source:'Catalogo italiano',country:'IT'}
]);
assert.equal(indexed.length,2);
assert.equal(searchChannels(indexed,'rai1')[0].name,'Rai 1');
assert.equal(searchChannels(indexed,'rai uno italiano').length,1);
assert.equal(searchChannels(indexed,'alternativo',{country:'IT',category:'news',source:'Catalogo italiano'}).length,1);
assert.equal(searchChannels(indexed,'',{country:'MT',category:'sports'}).length,1);
assert.equal(searchChannels(indexed,'',{country:'MT',category:'news'}).length,0);
const request=params=>new Request('https://unit.test/api/cinema/youtube?'+new URLSearchParams(params));
const initialFetch=globalThis.fetch,calls=[];
globalThis.fetch=async raw=>{
  const url=new URL(raw),args=url.searchParams;
  calls.push(url);
  switch(url.pathname.split('/').at(-1)){
    case 'videos.xml':
      return new Response(`<feed><title>Canale &amp; Video</title><entry><yt:videoId>${first}</yt:videoId><title>Video &quot;uno&quot;</title></entry></feed>`);
    case 'search':
      if(args.get('q')==='quota')return Response.json({error:{errors:[{reason:'quotaExceeded'}]}},{status:403});
      if(args.get('type')==='channel')return Response.json({items:[{id:{channelId:id},snippet:{title:'Canale'}}]});
      return Response.json({items:[{id:{videoId:first},snippet:{title:'Titolo &amp; video',channelTitle:'Autore',liveBroadcastContent:args.get('eventType')}}]});
    case 'channels':
      return Response.json({items:[{id,snippet:{title:'Canale'},contentDetails:{relatedPlaylists:{uploads:'UU-fixture'}}}]});
    case 'playlistItems':
      return Response.json({items:[{contentDetails:{videoId:first}},{contentDetails:{videoId:second}}]});
    case 'videos':
      return Response.json({items:[{id:first,snippet:{title:'Pubblico'},status:{embeddable:true}},{id:second,snippet:{title:'Limitato'},status:{embeddable:false}}]});
    default:
      throw Error('Unexpected upstream request');
  }
};
try{
  const basic=new YouTubeCatalog();
  const q=request({mode:'search',type:'video',q:'Titolo'});
  assert.equal((await basic.fetch(q,'tg:1')).status,503);
  assert.equal((await basic.fetch(q,null)).status,401);
  assert.equal(calls.length,0);
  const feed=await (await basic.fetch(request({mode:'channel',id}),'tg:1')).json();
  assert.equal(calls[0].hostname,'www.youtube.com');
  assert.equal(calls[0].searchParams.get('channel_id'),id);
  assert.equal(feed.channel.name,'Canale & Video');
  assert.equal(feed.items[0].name,'Video "uno"');
  const full=new YouTubeCatalog('synthetic-yt-key');
  const [result]=await Promise.all([full.fetch(q,'tg:1'),full.fetch(q,'tg:2')]);
  assert.equal((await result.json()).items[0].name,'Titolo & video');
  assert.equal(calls.length,2);
  await full.fetch(request({mode:'search',type:'video',q:' titolo '}),'tg:3');
  assert.equal(calls.length,2);
  assert.equal(calls[1].searchParams.get('videoEmbeddable'),'true');
  const live=await (await full.fetch(request({mode:'search',type:'live',q:'titolo'}),'tg:1')).json();
  assert.equal(live.items[0].live,true);
  assert.equal(calls.at(-1).searchParams.get('eventType'),'live');
  const found=await (await full.fetch(request({mode:'search',type:'channel',q:'nome'}),'tg:1')).json();
  assert.equal(found.items[0].id,id);
  assert.equal(calls.at(-1).searchParams.has('videoEmbeddable'),false);
  const opened=await (await full.fetch(request({mode:'channel',handle:'@canale'}),'tg:1')).json();
  assert.deepEqual(opened.items.map(item=>item.id),[first]);
  assert.ok(calls.some(url=>url.searchParams.get('forHandle')==='@canale'));
  const limited=await full.fetch(request({mode:'search',type:'video',q:'quota'}),'tg:1');
  assert.equal(limited.status,429);
  assert.doesNotMatch(await limited.text(),/synthetic-yt-key/);
}finally{globalThis.fetch=initialFetch;}
console.log('PASS Cinema search: country and category filters, source deduplication, YouTube RSS, quota, caching, public channels and embeddable videos.');

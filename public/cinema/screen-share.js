const RTC_CONFIG={iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]};
const CONNECTION_TIMEOUT=15000;

export class WindowShare {
  constructor(video,send,report,audio=()=>{}){
    this.video=video;this.send=send;this.report=report;this.audio=audio;this.audioBlocked=false;
    this.room=null;this.share=null;this.capture=null;this.picking=false;this.monitor=true;
    this.peers=new Map();this.watching=false;this.timer=0;
  }
  get supported(){
    return typeof navigator.mediaDevices?.getDisplayMedia==='function'&&typeof RTCPeerConnection==='function';
  }
  async start(){
    if(!this.supported){
      this.report('La condivisione non è disponibile in questo client. Prova da un browser desktop.');
      return;
    }
    if(!this.room||this.share||this.capture||this.picking)return;
    const room=this.room;
    this.picking=true;
    let stream;
    try{
      stream=await navigator.mediaDevices.getDisplayMedia({
        video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}},audio:true,systemAudio:'include',windowAudio:'window'
      });
    }catch(error){
      if(this.room===room)this.report(error.name==='NotAllowedError'?'Condivisione annullata o bloccata dal browser.':'Impossibile aprire la condivisione dello schermo.');
      return;
    }finally{this.picking=false;}
    const track=stream.getVideoTracks()[0];
    if(this.room!==room||this.share||track?.readyState!=='live'){
      stream.getTracks().forEach(item=>item.stop());return;
    }
    const id=crypto.randomUUID();
    this.capture={id,stream,confirmed:false,timer:setTimeout(()=>{
      this.stop();this.report('La condivisione non è partita. Riprova.');
    },CONNECTION_TIMEOUT)};
    track.addEventListener('ended',()=>{if(this.capture?.id===id)this.stop();},{once:true});
    this.send('screen-start',{share:id});
  }
  stop(notify=true){
    const capture=this.capture;
    if(!capture)return;
    this.capture=null;
    clearTimeout(capture.timer);
    capture.stream.getTracks().forEach(track=>track.stop());
    this.clearPeers();
    if(notify)this.send('screen-stop',{share:capture.id});
  }
  clearPeers(){
    clearTimeout(this.timer);
    for(const id of this.peers.keys())this.closePeer(id);
    this.video.pause();this.video.srcObject=null;this.audioBlocked=false;this.reportAudio();
  }
  closePeer(id){
    const peer=this.peers.get(id);
    if(!peer)return;
    this.peers.delete(id);
    peer.pc.close();
  }
  disconnect(notify=false){
    if(notify&&this.watching&&this.share)this.send('screen-unwatch',{share:this.share.id});
    this.stop(false);this.clearPeers();
    this.room=null;this.share=null;this.watching=false;
  }
  update(active,monitor,volume){
    const room=active?.id??null,share=active?.screen??null;
    const roomChanged=this.room!==room;
    const changed=roomChanged||this.share?.id!==share?.id;
    const monitorChanged=this.monitor!==monitor;
    if(changed){
      this.clearPeers();this.watching=false;
      const lostCapture=this.capture?.confirmed&&!share;
      const otherShare=share&&this.capture?.id!==share.id;
      if(roomChanged||lostCapture||otherShare)this.stop(false);
    }
    this.room=room;this.share=share;this.monitor=monitor;
    this.volume(volume);
    if(!share)return;
    if(share.local){
      if(!this.capture){this.send('screen-stop',{share:share.id});return;}
      clearTimeout(this.capture.timer);this.capture.confirmed=true;
      if(monitor&&(changed||monitorChanged))this.show(this.capture.stream);
      else if(!monitor&&monitorChanged){this.video.pause();this.video.srcObject=null;}
    }else if(!monitor){
      if(this.watching)this.send('screen-unwatch',{share:share.id});
      this.watching=false;this.clearPeers();
    }else if(changed||monitorChanged)this.watch();
  }
  volume(value){
    this.video.volume=value/100;
    this.video.muted=!!this.share?.local||value===0||this.audioBlocked;
  }
  watch(){
    if(!this.share||this.share.local||!this.monitor||this.watching)return;
    if(typeof RTCPeerConnection!=='function'){
      this.report('La riproduzione della condivisione non è disponibile in questo client.');return;
    }
    this.watching=true;
    this.report('Collegamento alla finestra condivisa…');
    this.send('screen-watch',{share:this.share.id});
    this.timer=setTimeout(()=>this.watchFailed(),CONNECTION_TIMEOUT);
  }
  watchFailed(message='Collegamento diretto non riuscito.'){
    if(!this.share||this.share.local||!this.monitor)return;
    if(this.watching)this.send('screen-unwatch',{share:this.share.id});
    this.watching=false;this.clearPeers();
    this.report(message,'retry');
  }
  reportAudio(){
    const stream=this.video.srcObject;
    const audio=!!stream?.getAudioTracks?.().some(track=>track.readyState!=='ended');
    this.audio({ready:!!stream,audio,blocked:this.audioBlocked,local:!!this.share?.local});
  }
  async show(stream){
    const id=this.share?.id;
    const current=()=>this.share?.id===id&&this.video.srcObject===stream;
    this.video.srcObject=stream;
    this.reportAudio();
    try{
      await this.video.play();
      if(current()){clearTimeout(this.timer);this.report('');}
    }catch{
      if(!current())return;
      if(!this.video.muted&&!this.share.local&&stream.getAudioTracks?.().length){
        this.audioBlocked=true;this.video.muted=true;this.reportAudio();
        try{
          await this.video.play();
          if(current()){clearTimeout(this.timer);this.report('');}
          return;
        }catch{}
      }
      if(current())this.report('Tocca per riprodurre la condivisione.','play');
    }
  }
  enableAudio(){
    if(!this.video.srcObject||this.share?.local)return;
    this.audioBlocked=false;
    if(this.video.volume===0)this.video.volume=.65;
    this.video.muted=false;
    this.show(this.video.srcObject);
  }
  retry(){
    if(this.video.srcObject)this.show(this.video.srcObject);
    else if(this.share?.local&&this.capture)this.show(this.capture.stream);
    else this.watch();
  }
  createPeer(id){
    const pc=new RTCPeerConnection(RTC_CONFIG),share=this.share;
    const entry={pc,ice:[],queue:Promise.resolve()};
    this.peers.set(id,entry);
    const current=()=>this.share?.id===share.id&&this.peers.get(id)===entry;
    pc.onicecandidate=({candidate})=>{
      if(current()&&candidate)this.send('screen-signal',{share:share.id,peer:id,signal:{
        type:'ice',candidate:candidate.candidate,mid:candidate.sdpMid,index:candidate.sdpMLineIndex
      }});
    };
    pc.onconnectionstatechange=()=>{
      if(!current())return;
      if(!share.local&&pc.connectionState==='connected')clearTimeout(this.timer);
      if(pc.connectionState!=='failed')return;
      if(share.local)this.closePeer(id);
      else this.watchFailed();
    };
    if(share.local){
      for(const track of this.capture.stream.getTracks())pc.addTrack(track,this.capture.stream);
    }else{
      pc.ontrack=({streams})=>{
        if(!current()||!streams[0])return;
        if(this.video.srcObject===streams[0])this.reportAudio();
        else this.show(streams[0]);
      };
    }
    return entry;
  }
  async receive(packet){
    if(packet.type==='screen-error'){
      if(packet.share===this.capture?.id&&!this.capture.confirmed){this.stop(false);this.report(packet.message);}
      else if(packet.share===this.share?.id&&!this.share.local)this.watchFailed(packet.message);
      return;
    }
    const share=this.share;
    if(!share||packet.share!==share.id)return;
    const id=packet.peer;
    if(packet.type==='screen-peer-left'){this.closePeer(id);return;}
    if(share.local?!this.capture:!this.watching||id!==share.peer)return;
    let entry;
    try{
      if(packet.type==='screen-peer'){
        if(!share.local)return;
        this.closePeer(id);
        entry=this.createPeer(id);
        const pc=entry.pc;
        await pc.setLocalDescription(await pc.createOffer());
        if(this.peers.get(id)===entry)this.send('screen-signal',{share:share.id,peer:id,signal:{type:'offer',sdp:pc.localDescription.sdp}});
      }else if(packet.type==='screen-signal'){
        entry=this.peers.get(id)??(!share.local?this.createPeer(id):null);
        if(!entry)return;
        entry.queue=entry.queue.then(()=>this.applySignal(entry,packet));
        await entry.queue;
      }
    }catch{
      if(this.share?.id!==share.id||(entry&&this.peers.get(id)!==entry))return;
      if(share.local)this.closePeer(id);
      else if(this.watching)this.watchFailed();
    }
  }
  async applySignal(entry,{peer,share,signal}){
    if(this.peers.get(peer)!==entry)return;
    const {pc,ice}=entry;
    if(signal.type==='ice'){
      const candidate={candidate:signal.candidate,sdpMid:signal.mid,sdpMLineIndex:signal.index};
      if(pc.remoteDescription)await pc.addIceCandidate(candidate);
      else if(ice.length<64)ice.push(candidate);
      return;
    }
    await pc.setRemoteDescription({type:signal.type,sdp:signal.sdp});
    for(const candidate of ice.splice(0))await pc.addIceCandidate(candidate);
    if(signal.type==='offer'){
      await pc.setLocalDescription(await pc.createAnswer());
      if(this.peers.get(peer)===entry)this.send('screen-signal',{share,peer,signal:{type:'answer',sdp:pc.localDescription.sdp}});
    }
  }
}

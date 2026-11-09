export function blackboardLink(frame, sessionToken, appearance, onRooms) {
  let socket = null, retry, lastSequence = 0;
  let room = null, frameReady = false, joined = false, rooms = [];

  function post(packet) {
    if (frameReady) frame.contentWindow?.postMessage({type:'blackboard:packet', packet}, location.origin);
  }

  function send(packet) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(packet));
  }

  function enter() {
    if (room && frameReady) send({type:'enter', room, since:lastSequence});
  }

  function connect() {
    if (socket || !sessionToken()) return;
    clearTimeout(retry);
    const {shirt, shorts} = appearance();
    const params = new URLSearchParams({shirt, shorts, directory:'1'});
    const url = new URL('/api/blackboard/ws?' + params, location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const connection = socket = new WebSocket(url.href, ['checkmate', sessionToken()]);
    connection.onopen = enter;
    connection.onmessage = event => {
      if (socket !== connection) return;
      const packet = JSON.parse(event.data);
      if (packet.type === 'rooms') {
        rooms = packet.rooms;
        onRooms(rooms, 'online');
        return;
      }
      if (packet.type === 'sync') joined = packet.room === room;
      if (packet.type === 'room-error') return post(packet);
      if (!joined) return;
      if (packet.type === 'history') lastSequence = packet.strokes.at(-1).seq;
      if (packet.type === 'stroke') lastSequence = packet.seq;
      if (packet.type === 'sync' || packet.type === 'clear') lastSequence = Math.max(lastSequence, packet.epoch);
      post(packet);
    };
    connection.onclose = event => {
      if (socket !== connection) return;
      socket = null;
      joined = false;
      const expired = event.code === 4001;
      onRooms(rooms, expired ? 'expired' : 'offline');
      post({type:'offline', expired});
      if (!expired) retry = setTimeout(connect, 1500);
    };
  }

  return {
    connect,
    open(id) { room = id; },
    receive(data) {
      if (data?.type === 'blackboard:ready') {
        frameReady = true;
        enter();
      }
      if (joined && (data?.type === 'blackboard:stroke' || data?.type === 'blackboard:clear')) send(data.command);
    },
    stop() {
      if (room) send({type:'leave'});
      room = null;
      frameReady = false;
      joined = false;
      lastSequence = 0;
    }
  };
}

export function blackboardLink(frame, sessionToken, appearance) {
  let socket = null, retry, lastSequence = 0;

  function post(packet) {
    frame.contentWindow?.postMessage({type:'blackboard:packet', packet}, location.origin);
  }

  function connect() {
    if (socket) return;
    const {shirt, shorts} = appearance();
    const params = new URLSearchParams({shirt, shorts, since:lastSequence});
    const url = new URL('/api/blackboard/ws?' + params, location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const connection = socket = new WebSocket(url, ['checkmate', sessionToken()]);
    connection.onmessage = event => {
      if (socket !== connection) return;
      const packet = JSON.parse(event.data);
      if (packet.type === 'history') lastSequence = packet.strokes.at(-1).seq;
      if (packet.type === 'stroke') lastSequence = packet.seq;
      post(packet);
    };
    connection.onclose = event => {
      if (socket !== connection) return;
      socket = null;
      const expired = event.code === 4001;
      post({type:'offline', expired});
      if (!expired) retry = setTimeout(connect, 1100);
    };
  }

  return {
    receive(data) {
      if (data?.type === 'blackboard:ready') connect();
      if (data?.type === 'blackboard:stroke' && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data.stroke));
      }
    },
    stop() {
      clearTimeout(retry);
      const old = socket;
      socket = null;
      lastSequence = 0;
      old?.close();
    }
  };
}

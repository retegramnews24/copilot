import {materialSet} from './materials.js';
self.onmessage=({data})=>{if(!Number.isInteger(data?.level)||data.level<1||data.level>6)return;const maps=materialSet(data.level);self.postMessage({level:data.level,maps},Object.values(maps).map(m=>m.data.buffer))};

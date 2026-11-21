import assert from 'node:assert/strict';
import {publicAddress,publicDNS} from '../radio-dns.js';
for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
for(const ip of ['8.8.8.8','1.1.1.1','2606:4700::1111'])assert.equal(publicAddress(ip),true,ip);
const native=fetch;try{globalThis.fetch=async()=>Response.json({Status:0,Answer:[{type:1,data:'127.0.0.1'}]});assert.equal(await publicDNS('radio.test'),false);globalThis.fetch=async()=>{throw Error('offline')};assert.equal(await publicDNS('radio.test'),false);}finally{globalThis.fetch=native}
console.log('PASS DNS: private, loopback, link-local, mapped IP and lookup failure blocked.');

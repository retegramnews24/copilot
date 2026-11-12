// Defense in depth: URL validation is still required on every redirect.
// A DNS preflight is not IP pinning; fetch resolves the hostname independently.
export function publicAddress(ip){
 if(/^\d+\.\d+\.\d+\.\d+$/.test(ip)){
  const p=ip.split('.').map(Number);if(p.some(n=>n>255))return false;const [a,b]=p;
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||b===51))||(a===203&&b===0&&p[2]===113));
 }
 const v=ip.toLowerCase();return /^[23][0-9a-f]{3}:[0-9a-f:]+$/.test(v)&&!/^2001:(?:0:|db8:|2:|10:|20:)/.test(v)&&!v.startsWith('2002:');
}
export async function publicDNS(host,signal){
 try{
  const records=await Promise.all(['A','AAAA'].map(async type=>{const r=await fetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type='+type,{signal,redirect:'error',headers:{Accept:'application/dns-json'}});if(!r.ok)throw Error('DNS unavailable');const data=await r.json();if(data.Status!==0)throw Error('DNS failure');return (data.Answer||[]).filter(x=>x.type===1||x.type===28).map(x=>x.data)}));
  const addresses=records.flat();return addresses.length>0&&addresses.every(publicAddress);
 }catch{return false}
}

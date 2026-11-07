export const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export function shuffled(values,rng=random){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

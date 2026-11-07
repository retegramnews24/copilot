export const SIZE=17;
export const VALUES={A:1,B:4,C:1,D:4,E:1,F:4,G:4,H:8,I:1,L:2,M:2,N:2,O:1,P:3,Q:10,R:1,S:1,T:1,U:4,V:4,Z:8,'?':30};
export function premium(r,c){if([0,8,16].includes(r)&&[0,8,16].includes(c)&&!(r===8&&c===8))return '3P';if((r===c||r+c===16)&&r>0&&r<16&&r!==8)return '2P';if([2,6,10,14].includes(r)&&[2,6,10,14].includes(c))return '3L';if([3,7,9,13].includes(r)&&[3,7,9,13].includes(c))return '2L';return ''}

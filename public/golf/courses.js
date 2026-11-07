const wall = (x, z, toX, toZ) => ({x, z, toX, toZ});
const water = (x, z, w, h) => ({x, z, w, h});
export const COURSES = [
  {name:'Pride Park', par:2, tee:[3,8], cup:[23,8], colors:['#3bdab6','#238f83','#183949'], walls:[], tip:'Tira dritto e dosa la forza.'},
  {name:'Sponde di Corallo', par:3, tee:[3,4], cup:[23,12], colors:['#66d1be','#397d8c','#413d6a'],
    walls:[wall(10,0,10,10),wall(17,7,17,16)], tip:'Alterna i lati. Puoi rimbalzare sulle sponde.'},
  {name:'Laguna di Vetro', par:3, tee:[3,8], cup:[23,8], colors:['#52d1b3','#268a7d','#193c5b'], walls:[],
    water:[water(10,0,5,6.2),water(10,9.8,5,6.2)], tip:'Attraversa il ponticello centrale.'},
  {name:'Palline da Discoteca', par:3, tee:[3,8], cup:[23,9], colors:['#77c4d4','#43669a','#31214e'], walls:[],
    bumpers:[[10,5,1.45],[13,10.5,1.65],[18,6.2,1.3]], tip:'I respingenti rosa rimandano la palla in pista.'},
  {name:'Mulino al Tramonto', par:4, tee:[3,8], cup:[23,8], colors:['#ecc088','#bc726b','#563957'],
    walls:[wall(13,0,13,4.5),wall(13,11.5,13,16)], rotor:[13,8,3.4,1.5], tip:'Aspetta un varco tra le pale del mulino.'},
  {name:'Spiaggia Pesca', par:4, tee:[3,12], cup:[23,4], colors:['#f0bd84','#b67678','#61476c'],
    walls:[wall(10,5,10,16)], rough:[water(12,3,5,10)], bumpers:[[19,10,1.4]], tip:'La sabbia rallenta molto il tiro.'},
  {name:'Il Ponte di Seta', par:4, tee:[3,12], cup:[23,4], colors:['#66cec6','#307790','#242f61'],
    walls:[wall(10,8,10,16),wall(17,0,17,7)], water:[water(12,0,3.8,3),water(12,7,3.8,9)],
    tip:'Usa la curva e attraversa il ponte lungo il bordo.'},
  {name:'Carosello al Neon', par:4, tee:[3,8], cup:[23,8], colors:['#89d3b7','#3d8590','#42285e'],
    walls:[wall(12,0,12,4),wall(12,12,12,16)], rotor:[12,8,3.7,-1.7],
    bumpers:[[18,5,1.45],[18,11,1.45]], tip:'Centra il varco e tieni conto del rimbalzo.'},
  {name:'La Grande Parata', par:5, tee:[3,4], cup:[23,12], colors:['#70d4b9','#457aa4','#392a60'],
    walls:[wall(9,0,9,10),wall(18,7.5,18,16)], water:[water(12,0,2.7,4),water(12,8.5,2.7,7.5)],
    bumpers:[[21,8,1.2]], tip:'Tre cambi di direzione, un ponte e una buca dietro l’ultima sponda.'}
];
export const WIDTH = 26, DEPTH = 16, RADIUS = .24, CUP = .61;
export const COLORS = ['#ffd972','#ff82b6','#70eaff','#b39bff','#aaf58c','#ff9a70','#f9f3ed','#74a3ff'];
export function rotorWall(course, seconds) {
  if (!course.rotor) return null;
  const [x,z,length,rate] = course.rotor, dx = Math.cos(seconds*rate)*length, dz = Math.sin(seconds*rate)*length;
  return wall(x-dx,z-dz,x+dx,z+dz);
}

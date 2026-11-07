// Gates are ordered from tee to cup. Each lists x, the centre of the safe
// lane, its width and the obstacle that borders it.
export const CAMPAIGNS=[
  {id:'park',name:'Parco dei Colori',difficulty:'Facile',description:'Green aperti, ponti larghi e sponde per imparare i rimbalzi.',scale:1.76,holes:[
    ['Viale del Sole',2,34,20,10,10,0,[]],
    ['Giardino di Menta',2,35,20,6,14,0,[[17,10,10,'rail']]],
    ['Baia delle Vele',3,36,22,11,11,5,[[18,11,8,'water']]],
    ['Terrazza dei Fiori',3,36,22,15,8,0,[[16,14,8,'bumper']]],
    ['Dune di Pesca',3,37,22,7,15,5,[[15,8,9,'sand'],[25,15,8,'rail']]],
    ['Torre d’Ambra',3,38,22,14,9,4,[[18,13,8,'rail'],[27,9,8,'bumper']]],
    ['Il Boschetto',3,37,22,10,13,4,[[13,8,8,'bumper'],[24,13,8,'sand']]],
    ['Laghetto delle Ninfee',3,38,22,7,15,2,[[13,8,7,'rail'],[24,14,7,'water']]],
    ['Le Vele di Carta',4,39,22,14,7,5,[[13,14,8,'water'],[26,8,7,'rail']]],
    ['Parata dei Giardini',4,40,23,7,15,8,[[12,8,8,'rail'],[23,15,7,'water'],[31,14,7,'bumper']]]
  ]},
  {id:'coast',name:'Coste di Vetro',difficulty:'Media',description:'Canali, slalom e bunker chiedono di scegliere la linea giusta.',scale:1.83,holes:[
    ['Porto di Corallo',3,36,22,6,15,1,[[12,7,7,'rail'],[24,15,7,'rail']]],
    ['La Scogliera',3,37,22,14,8,1,[[16,14,5.8,'water'],[28,9,6,'bumper']]],
    ['Dune Incrociate',4,38,22,6,15,5,[[12,7,6,'sand'],[21,15,6,'rail'],[30,12,6,'sand']]],
    ['I Cristalli Azzurri',4,38,23,15,8,2,[[13,16,6,'bumper'],[23,9,5.5,'water']]],
    ['Capo del Mulino',4,39,23,7,16,4,[[12,8,6,'rail'],[23,14,6,'rotor'],[31,15,6,'sand']]],
    ['Due Ponti',5,40,23,16,8,6,[[13,16,5.4,'water'],[26,8,5.2,'water']]],
    ['La Conchiglia',4,39,22,6,16,1,[[12,7,6,'rail'],[21,15,5.5,'bumper'],[31,10,6,'rail']]],
    ['Marina al Tramonto',4,40,23,15,7,4,[[13,14,5.4,'sand'],[23,8,5.4,'water'],[31,12,5.5,'bumper']]],
    ['Secca d’Argento',5,41,24,8,17,6,[[12,9,5.6,'water'],[24,17,5.4,'rail'],[33,11,5.4,'bumper']]],
    ['Faro di Vetro',5,42,24,16,16,2,[[13,16,5.2,'rail'],[23,8,5.1,'water'],[32,15,5.1,'rotor']]]
  ]},
  {id:'neon',name:'Circuito al Neon',difficulty:'Difficile',description:'Passaggi stretti, rotori e doppi canali. Qui serve dosare ogni tiro.',scale:1.9,holes:[
    ['Portale Viola',4,38,23,7,16,3,[[12,8,4.8,'rail'],[22,15,4.6,'bumper'],[30,11,4.8,'rail']]],
    ['Ponte al Laser',4,39,23,16,7,7,[[13,15,4.3,'water'],[25,8,4.6,'rail'],[32,12,4.7,'sand']]],
    ['Camera dei Rotori',5,40,24,8,16,7,[[12,8,4.6,'rotor'],[22,16,4.7,'rail'],[32,10,4.4,'rotor']]],
    ['Svolta a Specchio',5,40,24,17,7,3,[[12,16,4.6,'rail'],[20,8,4.6,'rail'],[28,16,4.4,'bumper'],[34,10,4.6,'rail']]],
    ['Le Acque Viola',5,42,24,7,17,7,[[13,8,4.1,'water'],[25,16,4,'water'],[34,12,4.4,'bumper']]],
    ['Sabbie Elettriche',5,41,24,17,8,3,[[12,16,4.2,'sand'],[20,8,4.4,'rotor'],[28,15,4.3,'sand'],[34,10,4.2,'rail']]],
    ['Balcone di Cristallo',5,42,24,8,17,6,[[12,8,3.9,'water'],[23,16,4.3,'rail'],[33,10,4.2,'rotor']]],
    ['Labirinto di Luce',6,43,24,17,8,7,[[12,17,4.2,'rail'],[20,8,4.1,'bumper'],[28,16,4.2,'rotor'],[35,9,4.2,'rail']]],
    ['Il Doppio Varco',6,44,25,8,17,3,[[12,8,3.8,'water'],[23,17,4.1,'rotor'],[33,11,3.8,'water']]],
    ['Gran Finale',6,45,25,17,8,8,[[12,17,4,'rail'],[22,8,3.8,'water'],[32,17,4,'rotor'],[38,10,4,'bumper']]]
  ]}
];

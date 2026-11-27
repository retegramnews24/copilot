// Poligono di tiro della Zona Operativa: le scatole per gli urti e per i colpi, in coordinate di three.js.
// Il modello è blender/zona_poligono.blend → models/poligono.glb. In Blender (x, y, z) diventa in three (x, z, -y):
// il poligono, che in Blender va verso -y, qui va verso +z. Le misure vengono da quel file: se cambia, cambiano qui.

// b(x0, x1, y0, y1, z0, z1) con le coordinate di Blender.
const b = (x0, x1, y0, y1, z0, z1, extra = {}) => ({ min: [x0, z0, -y1], max: [x1, z1, -y0], ...extra });

export const POLIGONO = {
  // dove si parte (fondo del corridoio d'ingresso) e verso dove si guarda (+z: la sala e le corsie)
  start: { x: 0, y: 0, z: -15, yaw: Math.PI },
  boxes: [
    b(-8, 8, -53, 17, -1, 0), // pavimento
    b(-8, 8, -53, 17, 4.0, 5), // soffitto
    b(-7.3, -7, -52.3, 8.3, 0, 4),
    b(7, 7.3, -52.3, 8.3, 0, 4),
    b(-7, 7, -52.3, -52, 0, 4), // fondo
    b(-7, 7, -52, -46, 0, 0.6, { noWalk: false }), // terrapieno (primo gradino)
    b(-7, 7, -52, -50.8, 0, 3.0),
    b(-7, -0.8, 8, 8.3, 0, 4), // parete dell'ingresso
    b(0.8, 7, 8, 8.3, 0, 4),
    b(-0.8, 0.8, 8, 8.3, 2.3, 4),
    b(-1.1, -0.8, 8.3, 16, 0, 2.6), // corridoio
    b(0.8, 1.1, 8.3, 16, 0, 2.6),
    b(-1.1, 1.1, 8.3, 16.3, 2.6, 3),
    b(-1.1, 1.1, 16, 16.3, 0, 2.6), // fondo del corridoio (chiuso)
    b(-7, 7, -0.55, 0.05, 0, 1.06), // mensola sulla linea di tiro
    b(-7, 7, -0.6, -0.5, 1.06, 4, { noShot: true }), // oltre la linea di tiro non si passa (ma si spara)
    ...[-4.2, -1.4, 1.4, 4.2].map(x => b(x - 0.06, x + 0.06, 0.05, 2.0, 0, 1.96)), // separatori
    b(-3.2, 3.2, 4.6, 5.4, 0, 0.95), // bancone delle armi
    b(-7, -6.5, 2.6, 7.4, 0, 1.9), // armadietti
    b(-6.0, -5.4, 3, 7, 0, 0.5), // panca
    b(5.8, 6.6, 2.2, 3.5, 0, 0.9), // casse di munizioni
    b(6.55, 7, 4.5, 6.0, 0, 1.14), // mobiletto
    ...[-6, -14, -22, -30, -38].map(y => b(-7, 7, y - 0.25, y + 0.25, 3.3, 4)) // travi
  ]
};

// Vicino a un'arma sul bancone (raggio in metri) la si prende con E.
export const TAKE_RADIUS = 1.6;

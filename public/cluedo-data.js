export const SUSPECTS=['Miss Scarlett','Colonnello Mustard','Signora White','Reverendo Green','Signora Peacock','Professor Plum'];
export const WEAPONS=['Candelabro','Pugnale','Tubo di piombo','Revolver','Corda','Chiave inglese'];
export const ROOMS=['Cucina','Sala da ballo','Serra','Sala da pranzo','Sala del biliardo','Biblioteca','Salotto','Ingresso','Studio'];
export const clueName=id=>id<6?SUSPECTS[id]:id<12?WEAPONS[id-6]:ROOMS[id-12];

# Librerie esterne copiate nel progetto

- `hls.min.js`: hls.js 1.6.13 (licenza Apache-2.0, https://github.com/video-dev/hls.js), file `dist/hls.min.js` del pacchetto npm.
  Una sola copia per tutta l'app: la usano il Cinema (canali TV e mosaico Multisala) e la radio (stazioni HLS .m3u8, così l'equalizzatore riceve il suono vero).
  SHA-256: `7C47CD97D7A6E7B98D9623DD8ED9A6D45AF4BE4085E0C2001CD7175C2B4CFB07`
- `three/three.module.min.js`: three.js 0.170.0 (licenza MIT, https://github.com/mrdoob/three.js, file `LICENSE` accanto), file `build/three.module.min.js` del pacchetto npm.
  Usato solo dalla pagina di prova Giuliosim 3D (`public/arcade/giuliosim-3d.html`, `public/giulio3d/`).
  SHA-256: `08FD7545D13D2C7FB65AB691530A802DAFEFD638596501854F267D0FB13C39E7`

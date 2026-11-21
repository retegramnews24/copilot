import {cardName,rankName} from './briscola-data.js';
// Original vector illustrations: Italian suits and full-length court figures, no external images.
const pip=s=>[
 '<path d="M-11-11h22l-3 12-6 5v8h8v4h-20v-4h8v-8l-6-5z" fill="#bf4d38" stroke="#8c682e" stroke-width="1.4"/><path d="M-14-9h4v8h-4q-5-4 0-8m28 0h-4v8h4q5-4 0-8" fill="none" stroke="#b99545" stroke-width="2"/><path d="M-7-8H7M-5-1H5" stroke="#edc65f" stroke-width="2"/>',
 '<circle r="13" fill="#d7b347" stroke="#976326" stroke-width="2"/><circle r="9" fill="none" stroke="#f5dc7b"/><path d="M0-8 2-3 7-5 4 0 8 3 2 3 0 9-2 3-8 3-4 0-7-5-2-3z" fill="#b7772b"/><circle r="2" fill="#f2d77c"/>',
 '<path d="M-3 12-1-18Q6-10 3 7L1 12z" fill="#6793a2" stroke="#375d6c" stroke-width="1.3"/><path d="M-8 10H8M0 10v9" stroke="#c79d3f" stroke-width="3"/><circle cy="20" r="2.5" fill="#b44a36"/>',
 '<path d="M-2 17-6-15Q-4-21 0-17L5-20Q10-17 5-12L4 1 2 18z" fill="#62904a" stroke="#3f5f35" stroke-width="1.5"/><path d="M-3-10 4-7M-3-1 3 2M-1 9 2 12" stroke="#c25237" stroke-width="3"/>'
][s];
function figure(rank,suit){const cloth=['#b94738','#467b9a','#719247','#a3453a'][suit],court=rank===10,knight=rank===9;return `<g stroke="#695432" stroke-width="1.1"><path d="M34 124 35 144H25v-6l3-18m22 4 2 20h12v-5l-7-17" fill="#44678b"/><path d="M28 67 22 110l6 16 29 1 8-17-8-43z" fill="${cloth}"/><path d="M34 71h16l7 49-30 1z" fill="#e7bd50"/><path d="M38 74v45M47 74v45M31 91h26M27 108h31" stroke="${cloth}" stroke-width="3"/><path d="M25 68 12 98l7 5 14-22m21-13 15 28-8 4-14-20" fill="${cloth}"/><circle cx="43" cy="51" r="12" fill="#e6b78c"/><path d="M31 49q0-19 21-9l4 12-6-4-5-7-12 8" fill="#544733"/><path d="M46 51h4m-4 9 4-2" fill="none"/><path d="M34 66h19l-4 8-11-2z" fill="#f5edd3"/>${court?'<path d="M31 37 28 24l10 7 5-13 6 13 9-7-4 14z" fill="#d3a337"/><circle cx="43" cy="22" r="2" fill="#aa3f32"/><path d="M65 48v74" stroke="#b08b37" stroke-width="3"/><circle cx="65" cy="45" r="5" fill="#d6ac42"/>':knight?'<path d="M20 108q0-18 25-10l16 7 5-11 4-17 6 4 1 28-8 12-7 20h-5l2-19-29-3-7 21h-6l3-24z" fill="#d5cfb6"/><path d="M71 83 77 91M29 102l29 9" fill="none"/><circle cx="74" cy="88" r="1.5" fill="#39392a"/>':'<path d="M29 39q10-13 25-1l3 4H28z" fill="#405f82"/><path d="m32 35 3-12 4 12" fill="#bd4433"/>'}<path d="M25 67q18 12 31 0" fill="none" stroke="#d9c77e" stroke-width="2"/></g>`}
export function sicilianSVG(card){const {rank,suit}=card,marks=[];if(rank<=7){const positions=rank===1?[[50,80]]:rank===2?[[50,46],[50,110]]:rank===3?[[50,39],[50,78],[50,117]]:rank===4?[[30,44],[70,44],[30,112],[70,112]]:rank===5?[[30,40],[70,40],[50,79],[30,118],[70,118]]:rank===6?[[30,39],[70,39],[30,79],[70,79],[30,119],[70,119]]:[[30,34],[70,34],[30,72],[70,72],[50,93],[30,124],[70,124]];for(const [x,y]of positions)marks.push(`<g transform="translate(${x} ${y}) scale(${rank===1?1.7:rank<=3?1.15:.82})">${pip(suit)}</g>`)}else marks.push(`<g transform="translate(7 0)">${figure(rank,suit)}</g>`);const number=rank===1?'A':String(rank);
 return `<svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
 <rect x="1" y="1" width="98" height="158" rx="9" fill="#fff7e0" stroke="#9c7c4d" stroke-width="2"/>
 <rect x="6" y="6" width="88" height="148" rx="6" fill="none" stroke="#dbc999"/>
 <path d="M11 41V13h22m56 106v28H67" fill="none" stroke="#b79964"/>
 <g fill="#352618" font-family="system-ui,sans-serif" font-weight="750" font-size="17" font-variant-numeric="tabular-nums">
 <text x="12" y="28">${number}</text><text x="88" y="144" text-anchor="end">${number}</text>
 </g>
 ${marks.join('')}<g transform="translate(19 38) scale(.28)">${pip(suit)}</g><g transform="translate(81 121) scale(.28)">${pip(suit)}</g>
 </svg>`;}

export function sicilianCard(card,button=false){const e=document.createElement(button?'button':'div');e.className='sicilian-card';e.innerHTML=sicilianSVG(card);e.setAttribute('aria-label',cardName(card));e.title=rankName(card.rank);return e}

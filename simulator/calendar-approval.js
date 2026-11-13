// Three distinct, persisted confirmations. A vote never starts a championship.
export function resetApproval(s){s.calendarReady={};s.calendarStart={};}
export function approvalState(s,id){
 const members=Object.values(s.teams).filter(t=>t.enrolled).map(t=>t.id);
 const proposal=members.length>=2?s.votes[members[0]]:null;
 const unanimous=!!proposal&&s.proposals.some(p=>p.id===proposal)&&members.every(id=>s.votes[id]===proposal);
 const allReady=unanimous&&members.every(id=>s.calendarReady?.[id]===proposal);
 return {members,proposal:unanimous?proposal:null,allReady,ready:!!s.votes[id]&&s.calendarReady?.[id]===s.votes[id],started:allReady&&s.calendarStart?.[id]===proposal,readyCount:members.filter(id=>s.votes[id]&&s.calendarReady?.[id]===s.votes[id]).length,startCount:allReady?members.filter(id=>s.calendarStart?.[id]===proposal).length:0};
}
export function calendarAction(s,t,b,now,calendar,laps,event){
 if(s.schedule||!t.enrolled)throw Error('Conferma non disponibile.');
 s.calendarReady??={};s.calendarStart??={};
 if(b.action!=='calendar-start'&&approvalState(s,t.id).allReady)throw Error('Tutti pronti: conferma Si parte!!');
 if(b.action==='vote'){
  const p=s.proposals.find(p=>p.id===b.proposal);if(!p)throw Error('Proposta non disponibile.');calendar(p,now);
  if(s.votes[t.id]!==p.id){s.votes[t.id]=p.id;delete s.calendarReady[t.id];s.calendarStart={};}return;
 }
 if(b.action==='calendar-ready'){
  const p=s.proposals.find(p=>p.id===s.votes[t.id]);if(!p)throw Error('Accetta prima una proposta di orario.');
  if(b.ready){calendar(p,now);s.calendarReady[t.id]=p.id;}else delete s.calendarReady[t.id];
  s.calendarStart={};return;
 }
 const state=approvalState(s,t.id);if(!state.allReady)throw Error('Tutti devono accettare la stessa proposta e mettere Pronto!');
 const p=s.proposals.find(p=>p.id===state.proposal);const checked=calendar(p,now);
 s.calendarStart[t.id]=p.id;
 if(state.members.every(id=>s.calendarStart[id]===p.id)){
  s.schedule={...p,...checked,participants:state.members,acceptedAt:now,laps:laps()};
  event(s,'Si parte!! Tutti hanno confermato: iscrizioni chiuse e calendario ufficiale pubblicato.',now);
 }
}

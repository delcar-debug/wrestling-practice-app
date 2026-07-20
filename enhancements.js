/* Desktop coaching enhancements: analytics, drag-to-plan, drill stats, whiteboard */
(() => {
  const q = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getArchives = () => Array.isArray(state?.archives) ? state.archives : [];
  const blockMinutes = b => Math.max(0, Number(b?.minutes) || 0);
  const allCats = () => (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []);
  const totalsFor = archives => {
    const out = Object.fromEntries(allCats().map(c => [c.id, 0]));
    archives.forEach(a => (a.blocks || []).forEach(b => {
      const id = categoryInfo(b.category).id;
      out[id] = (out[id] || 0) + blockMinutes(b);
    }));
    return out;
  };
  const archiveDate = a => new Date((a.date || a.plannedDate || a.archivedAt || '') + ((a.date || a.plannedDate) ? 'T12:00:00' : ''));
  const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const pct = (n,d) => d ? Math.round(n/d*100) : 0;

  function installAnalyticsUI(){
    const page=q('practiceDataPage'); if(!page || q('advancedAnalytics')) return;
    const node=document.createElement('section'); node.id='advancedAnalytics'; node.className='advanced-analytics';
    node.innerHTML=`<div class="analytics-title-row"><div><h2>Practice Analytics Dashboard</h2><p>Season, monthly, and recent-practice trends based on planned practice time.</p></div><select id="analyticsWindow"><option value="season">Full season</option><option value="month">This month</option><option value="last10">Last 10 practices</option></select></div><div class="analytics-metrics" id="analyticsMetrics"></div><div class="analytics-grid"><div class="analytics-card"><h3>Category Mix</h3><div id="analyticsCategoryMix"></div></div><div class="analytics-card"><h3>This Month vs Last Month</h3><div id="analyticsMonthCompare"></div></div><div class="analytics-card"><h3>Recent Practice Lengths</h3><div id="analyticsRecent"></div></div><div class="analytics-card"><h3>Coaching Alerts</h3><div id="analyticsAlerts"></div></div></div>`;
    page.insertBefore(node,page.firstChild);
    q('analyticsWindow').addEventListener('change',renderAdvancedAnalytics);
  }
  function bars(totals){
    const total=Object.values(totals).reduce((a,b)=>a+b,0);
    return allCats().filter(c=>(totals[c.id]||0)>0).sort((a,b)=>(totals[b.id]||0)-(totals[a.id]||0)).map(c=>`<div class="analytics-bar-row"><div><span>${safe(c.label)}</span><strong>${totals[c.id]||0} min · ${pct(totals[c.id]||0,total)}%</strong></div><div class="analytics-track"><i style="width:${pct(totals[c.id]||0,total)}%"></i></div></div>`).join('') || '<p class="muted">No archived practice data yet.</p>';
  }
  function renderAdvancedAnalytics(){
    if(!q('advancedAnalytics')) return;
    const archives=getArchives().filter(a=>!Number.isNaN(archiveDate(a).getTime())).sort((a,b)=>archiveDate(b)-archiveDate(a));
    const now=new Date(), thisKey=monthKey(now), prev=new Date(now.getFullYear(),now.getMonth()-1,1), prevKey=monthKey(prev);
    const thisMonth=archives.filter(a=>monthKey(archiveDate(a))===thisKey), lastMonth=archives.filter(a=>monthKey(archiveDate(a))===prevKey);
    const mode=q('analyticsWindow')?.value||'season';
    const selected=mode==='month'?thisMonth:mode==='last10'?archives.slice(0,10):archives;
    const minutes=selected.reduce((s,a)=>s+(a.blocks||[]).reduce((x,b)=>x+blockMinutes(b),0),0);
    const avg=selected.length?Math.round(minutes/selected.length):0;
    const totals=totalsFor(selected);
    q('analyticsMetrics').innerHTML=[['Practices',selected.length],['Total Hours',(minutes/60).toFixed(minutes%60?1:0)],['Avg Length',`${avg} min`],['Last 30 Days',archives.filter(a=>(now-archiveDate(a))/86400000<=30).length]].map(([k,v])=>`<div class="analytics-metric"><span>${k}</span><strong>${v}</strong></div>`).join('');
    q('analyticsCategoryMix').innerHTML=bars(totals);
    const tm=totalsFor(thisMonth), lm=totalsFor(lastMonth);
    q('analyticsMonthCompare').innerHTML=allCats().filter(c=>(tm[c.id]||0)||(lm[c.id]||0)).map(c=>{const change=(tm[c.id]||0)-(lm[c.id]||0);return `<div class="compare-row"><span>${safe(c.label)}</span><strong class="${change>0?'up':change<0?'down':''}">${change>0?'+':''}${change} min</strong></div>`}).join('')||'<p class="muted">Archive practices across two months to compare.</p>';
    q('analyticsRecent').innerHTML=archives.slice(0,10).map(a=>{const m=(a.blocks||[]).reduce((s,b)=>s+blockMinutes(b),0);return `<div class="recent-row"><span>${archiveDate(a).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span><div class="recent-track"><i style="width:${Math.min(100,m/120*100)}%"></i></div><strong>${m}m</strong></div>`}).join('')||'<p class="muted">No recent practices.</p>';
    const alerts=[]; const seasonTotals=totalsFor(archives), seasonMin=Object.values(seasonTotals).reduce((a,b)=>a+b,0);
    allCats().forEach(c=>{const p=pct(seasonTotals[c.id]||0,seasonMin); if(['technique_top','technique_bottom','technique_neutral','live'].includes(c.id)&&p<8)alerts.push(`${c.label} is only ${p}% of season time.`)});
    if(avg>110) alerts.push(`Average planned practice is ${avg} minutes.`);
    q('analyticsAlerts').innerHTML=(alerts.length?alerts:['Category balance looks healthy based on current data.']).map(x=>`<div class="analytics-alert">${safe(x)}</div>`).join('');
  }

  function drillStats(d){
    const uses=[]; getArchives().forEach(a=>(a.blocks||[]).forEach(b=>{if((b.name||'').trim().toLowerCase()===(d.name||'').trim().toLowerCase())uses.push({minutes:blockMinutes(b),date:archiveDate(a)})}));
    return {uses:uses.length,avg:uses.length?Math.round(uses.reduce((s,x)=>s+x.minutes,0)/uses.length):Number(d.minutes)||0,last:uses.length?new Date(Math.max(...uses.map(x=>x.date.getTime()))):null};
  }
  function enhanceDrillCards(){
    document.querySelectorAll('#drillLibraryList .drill-card').forEach(card=>{
      const add=card.querySelector('.drill-add'); if(!add)return;
      const id=add.dataset.id, d=(typeof drillLibrary!=='undefined'?drillLibrary:[]).find(x=>x.id===id); if(!d)return;
      card.draggable=true; card.dataset.drillId=id;
      card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/drill-id',id);e.dataTransfer.effectAllowed='copy'});
      if(!card.querySelector('.drill-stats')){const s=drillStats(d), node=document.createElement('div');node.className='drill-stats';node.innerHTML=`<span>Used <strong>${s.uses}</strong>×</span><span>Avg <strong>${s.avg} min</strong></span><span>Last <strong>${s.last?s.last.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Never'}</strong></span>`;card.querySelector('.drill-details')?.after(node)||card.querySelector('.drill-card-head')?.after(node)}
    });
  }
  function installDropZone(){
    const target=q('blocks'); if(!target || target.dataset.drillDrop==='1')return; target.dataset.drillDrop='1';
    const hint=document.createElement('div');hint.className='drill-drop-hint';hint.textContent='Drag drills here from the Drill Library';target.parentNode.insertBefore(hint,target);
    ['dragenter','dragover'].forEach(type=>target.addEventListener(type,e=>{if(e.dataTransfer.types.includes('text/drill-id')){e.preventDefault();target.classList.add('drill-drop-active')}}));
    ['dragleave','drop'].forEach(type=>target.addEventListener(type,e=>{target.classList.remove('drill-drop-active')}));
    target.addEventListener('drop',e=>{const id=e.dataTransfer.getData('text/drill-id');if(!id)return;e.preventDefault(); if(typeof addDrillToPractice==='function')addDrillToPractice(id); showAppPage('builder');});
  }

  function installWhiteboard(){
    const nav=q('navTeam'); if(!nav||q('navWhiteboard'))return;
    const b=document.createElement('button');b.id='navWhiteboard';b.type='button';b.textContent='Whiteboard';nav.after(b);
    const page=document.createElement('section');page.id='whiteboardPage';page.className='page-view whiteboard-page';
    page.innerHTML=`<div class="whiteboard-toolbar"><div><h1>Wrestling Room Whiteboard</h1><p>Live messages for athletes, staff, or the TV display.</p></div><button class="primary" id="openWhiteboardTv">Open TV View</button></div><div class="whiteboard-editor"><label>Headline<input id="wbHeadline" maxlength="80" placeholder="Today's focus"></label><label>Goals / reminders<textarea id="wbGoals" rows="7" placeholder="Hand fight first&#10;Finish through the edge&#10;Great partners"></textarea></label><label>Athlete spotlight<input id="wbSpotlight" maxlength="100" placeholder="Optional athlete or group focus"></label></div><div class="whiteboard-display" id="whiteboardDisplay"></div>`;
    document.querySelector('.app')?.appendChild(page);
    const load=()=>{try{return JSON.parse(localStorage.getItem('wpp-whiteboard')||'{}')}catch{return {}}};
    const render=()=>{const d={headline:q('wbHeadline').value,goals:q('wbGoals').value,spotlight:q('wbSpotlight').value};localStorage.setItem('wpp-whiteboard',JSON.stringify(d));q('whiteboardDisplay').innerHTML=`<div class="wb-kicker">WRESTLING ROOM</div><h2>${safe(d.headline||'Today’s Focus')}</h2><div class="wb-goals">${safe(d.goals||'Add goals and reminders for the room.').replace(/\n/g,'<br>')}</div>${d.spotlight?`<div class="wb-spotlight"><span>Spotlight</span>${safe(d.spotlight)}</div>`:''}`};
    const d=load();q('wbHeadline').value=d.headline||'';q('wbGoals').value=d.goals||'';q('wbSpotlight').value=d.spotlight||'';['wbHeadline','wbGoals','wbSpotlight'].forEach(id=>q(id).addEventListener('input',render));render();
    b.onclick=()=>showWhiteboard(); q('openWhiteboardTv').onclick=()=>{const u=new URL(location.href);u.searchParams.set('whiteboard','1');window.open(u,'wrestling-whiteboard','popup=yes,width=1400,height=900,resizable=yes')};
    if(new URLSearchParams(location.search).get('whiteboard')==='1'){document.body.classList.add('whiteboard-tv');showWhiteboard()}
  }
  function showWhiteboard(){
    ['builderPage','libraryPage','teamBoardPage','practiceDataPage','practiceQueuePage','drillLibraryPage'].forEach(id=>q(id)?.classList.remove('active'));
    q('builderPage')?.classList.add('hidden-page');q('whiteboardPage')?.classList.add('active');document.querySelectorAll('.page-nav button').forEach(x=>x.classList.toggle('active',x.id==='navWhiteboard'));window.scrollTo(0,0);
  }
  const originalShow=showAppPage; showAppPage=function(page){q('whiteboardPage')?.classList.remove('active'); if(page==='whiteboard')return showWhiteboard(); return originalShow(page)};
  const originalData=renderPracticeData; renderPracticeData=function(){originalData();renderAdvancedAnalytics()};
  const originalDrills=renderDrillLibrary; renderDrillLibrary=function(){originalDrills();enhanceDrillCards()};
  installAnalyticsUI();installDropZone();installWhiteboard();renderAdvancedAnalytics();enhanceDrillCards();
})();

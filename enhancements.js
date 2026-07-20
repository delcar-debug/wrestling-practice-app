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
  const originalShow=showAppPage; showAppPage=function(page){q('whiteboardPage')?.classList.remove('active');q('builderPage')?.classList.remove('hidden-page');document.body.classList.remove('whiteboard-tv');if(page==='whiteboard')return showWhiteboard();return originalShow(page)};
  const originalData=renderPracticeData; renderPracticeData=function(){originalData();renderAdvancedAnalytics()};
  const originalDrills=renderDrillLibrary; renderDrillLibrary=function(){originalDrills();enhanceDrillCards()};
  installAnalyticsUI();installDropZone();installWhiteboard();renderAdvancedAnalytics();enhanceDrillCards();
})();

/* Final whiteboard tab isolation fix. */
(() => {
  const hideWhiteboard = () => {
    const page = document.getElementById('whiteboardPage');
    if (page) page.classList.remove('active');
    if (!new URLSearchParams(location.search).has('whiteboard')) {
      document.body.classList.remove('whiteboard-tv');
    }
  };
  document.addEventListener('click', (event) => {
    const navButton = event.target.closest('.page-nav button');
    if (navButton && navButton.id !== 'navWhiteboard') hideWhiteboard();
  }, true);
  window.addEventListener('hashchange', hideWhiteboard);
})();

/* ===== Home dashboard and visual practice timeline ===== */
(() => {
  const byId = id => document.getElementById(id);
  const safeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const archiveList = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('wpp-practice-library') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  };
  const inboxList = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('wpp-coach-knowledge') || '{}');
      return Array.isArray(saved.practiceQueue) ? saved.practiceQueue : (typeof practiceQueue !== 'undefined' ? practiceQueue : []);
    } catch { return typeof practiceQueue !== 'undefined' ? practiceQueue : []; }
  };
  const archiveMinutes = a => (a.blocks || []).reduce((sum,b) => sum + Math.max(0, Number(b.minutes) || 0), 0);

  function installHome(){
    const nav = document.querySelector('.page-nav');
    if (!nav || byId('navHome')) return;
    const homeButton = document.createElement('button');
    homeButton.id = 'navHome';
    homeButton.type = 'button';
    homeButton.textContent = 'Home';
    nav.prepend(homeButton);

    const page = document.createElement('section');
    page.id = 'homePage';
    page.className = 'home-page page-view';
    page.innerHTML = `
      <div class="home-hero">
        <section class="home-identity">
          <div class="home-eyebrow">Championship Standard</div>
          <h1>Holmen Women's Wrestling</h1>
          <div class="home-slogans"><span>For Her</span><span>Team State Champs</span></div>
        </section>
        <section class="home-today">
          <div><div class="home-today-label">Active Practice</div><div class="home-today-date" id="homePracticeDate">No date selected</div><div class="home-today-goal" id="homePracticeGoal">Set a goal in Practice Builder.</div></div>
          <button class="primary" id="homeContinueBtn" type="button">Continue Practice</button>
        </section>
      </div>
      <div class="home-grid">
        <div class="home-metric"><span>Season Practices</span><strong id="homePracticeCount">0</strong></div>
        <div class="home-metric"><span>Season Hours</span><strong id="homeSeasonHours">0</strong></div>
        <div class="home-metric"><span>Planned Today</span><strong id="homeTodayMinutes">0m</strong></div>
        <div class="home-metric"><span>Practice Inbox</span><strong id="homeInboxCount">0</strong></div>
      </div>
      <div class="home-panels">
        <section class="home-panel"><h2>Quick Actions</h2><div class="home-quick-actions">
          <button class="primary" data-home-action="builder" type="button">Build Practice</button>
          <button class="secondary" data-home-action="coach" type="button">Open Coach Mode</button>
          <button class="secondary" data-home-action="team" type="button">Open Team Board</button>
          <button class="secondary" data-home-action="whiteboard" type="button">Open Whiteboard</button>
          <button class="secondary" data-home-action="queue" type="button">Practice Inbox</button>
          <button class="secondary" data-home-action="data" type="button">Season Data</button>
        </div></section>
        <section class="home-panel"><h2>Recent Practices</h2><div id="homeRecentPractices"></div></section>
      </div>`;
    document.querySelector('.app')?.appendChild(page);
    homeButton.addEventListener('click', () => showAppPage('home'));
    byId('homeContinueBtn').addEventListener('click', () => showAppPage(state.practiceActive ? 'coach' : 'builder'));
    page.querySelectorAll('[data-home-action]').forEach(btn => btn.addEventListener('click', () => showAppPage(btn.dataset.homeAction)));
  }

  function renderHome(){
    const page = byId('homePage'); if (!page) return;
    const archives = archiveList().sort((a,b) => new Date(b.date || b.archivedAt || 0) - new Date(a.date || a.archivedAt || 0));
    const mins = archives.reduce((sum,a) => sum + archiveMinutes(a), 0);
    const inbox = inboxList().filter(item => !item.completedAt && !item.addressedAt);
    const dateValue = byId('practiceDate')?.value;
    byId('homePracticeDate').textContent = dateValue ? new Date(dateValue + 'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}) : 'No date selected';
    byId('homePracticeGoal').textContent = byId('practiceGoal')?.value?.trim() || 'Set a goal in Practice Builder.';
    byId('homePracticeCount').textContent = archives.length;
    byId('homeSeasonHours').textContent = (mins / 60).toFixed(mins >= 600 ? 0 : 1);
    byId('homeTodayMinutes').textContent = `${typeof total === 'function' ? total() : 0}m`;
    byId('homeInboxCount').textContent = inbox.length;
    byId('homeRecentPractices').innerHTML = archives.length ? archives.slice(0,5).map(a => `<div class="home-recent-row"><div><strong>${safeText(a.goal || 'Practice')}</strong><br><span>${safeText(a.date || 'No date')}</span></div><strong>${archiveMinutes(a)}m</strong></div>`).join('') : '<div class="home-empty">Archived practices will appear here.</div>';
  }

  function installTimeline(){
    const builder = byId('builderPage');
    if (!builder || byId('practiceTimelineCard')) return;
    const card = document.createElement('section');
    card.id = 'practiceTimelineCard';
    card.className = 'card practice-timeline-card';
    card.innerHTML = `<div class="timeline-heading"><div><h2>Practice Timeline</h2><p>Drag blocks to reorder. Use − / + to make quick time changes.</p></div><div class="timeline-range" id="timelineRange"></div></div><div class="practice-timeline" id="practiceTimeline"></div><div class="timeline-now-line"></div>`;
    builder.prepend(card);
  }

  function renderTimeline(){
    const timeline = byId('practiceTimeline'); if (!timeline) return;
    const start = typeof startMins === 'function' ? startMins() : 0;
    const planned = typeof total === 'function' ? total() : 0;
    byId('timelineRange').textContent = `${typeof clock === 'function' ? clock(start) : ''} – ${typeof clock === 'function' ? clock(start + planned) : ''}`;
    if (!state.blocks.length){timeline.innerHTML='<div class="timeline-empty">Add practice blocks to build the timeline.</div>';return;}
    let elapsed = 0;
    timeline.innerHTML = state.blocks.map((b,index) => {
      const begin = start + elapsed; elapsed += Number(b.minutes) || 0;
      const width = Math.max(115, Math.min(300, (Number(b.minutes)||1) * 8));
      const category = typeof categoryInfo === 'function' ? categoryInfo(b.category).label : b.category;
      return `<article class="timeline-segment" draggable="true" data-timeline-index="${index}" style="--timeline-width:${width}px;--timeline-grow:${Math.max(1,Number(b.minutes)||1)}"><div><div class="timeline-time">${clock(begin)}–${clock(start+elapsed)}</div><div class="timeline-name">${safeText(b.name)}</div><div class="timeline-category">${safeText(category)}</div></div><div class="timeline-duration-controls"><button class="secondary timeline-minus" data-i="${index}" type="button">−</button><strong>${Number(b.minutes)||0} min</strong><button class="secondary timeline-plus" data-i="${index}" type="button">+</button></div></article>`;
    }).join('');
    timeline.querySelectorAll('.timeline-minus').forEach(btn => btn.addEventListener('click', e => {e.stopPropagation(); const i=Number(btn.dataset.i); state.blocks[i].minutes=Math.max(1,(Number(state.blocks[i].minutes)||1)-1); render();}));
    timeline.querySelectorAll('.timeline-plus').forEach(btn => btn.addEventListener('click', e => {e.stopPropagation(); const i=Number(btn.dataset.i); state.blocks[i].minutes=(Number(state.blocks[i].minutes)||0)+1; render();}));
    timeline.querySelectorAll('.timeline-segment').forEach(seg => {
      seg.addEventListener('click', e => {if (!e.target.closest('button') && typeof openBlockModal === 'function') openBlockModal(Number(seg.dataset.timelineIndex));});
      seg.addEventListener('dragstart', e => {seg.classList.add('dragging'); e.dataTransfer.setData('text/timeline-index', seg.dataset.timelineIndex); e.dataTransfer.effectAllowed='move';});
      seg.addEventListener('dragend', () => timeline.querySelectorAll('.timeline-segment').forEach(x => x.classList.remove('dragging','drop-target')));
      seg.addEventListener('dragover', e => {e.preventDefault(); seg.classList.add('drop-target');});
      seg.addEventListener('dragleave', () => seg.classList.remove('drop-target'));
      seg.addEventListener('drop', e => {e.preventDefault(); const from=Number(e.dataTransfer.getData('text/timeline-index')), to=Number(seg.dataset.timelineIndex); if(Number.isInteger(from)&&Number.isInteger(to)&&from!==to){const [moved]=state.blocks.splice(from,1);state.blocks.splice(to,0,moved);render();}});
    });
  }

  installHome();
  installTimeline();
  const previousShow = showAppPage;
  showAppPage = function(page){
    const home = byId('homePage');
    if (page === 'home'){
      ['builderPage','libraryPage','teamBoardPage','practiceDataPage','practiceQueuePage','drillLibraryPage','whiteboardPage'].forEach(id => {byId(id)?.classList.remove('active'); if(id==='builderPage')byId(id)?.classList.add('hidden-page');});
      document.body.classList.remove('whiteboard-tv');
      home?.classList.add('active');
      document.querySelectorAll('.page-nav button').forEach(btn => btn.classList.toggle('active',btn.id==='navHome'));
      renderHome(); window.scrollTo(0,0); return;
    }
    home?.classList.remove('active');
    byId('navHome')?.classList.remove('active');
    return previousShow(page);
  };
  const previousRender = render;
  render = function(){previousRender();renderTimeline();renderHome();};
  renderTimeline(); renderHome();
  const params = new URLSearchParams(location.search);
  const special = params.has('tv') || params.has('whiteboard') || params.has('code') || location.hash.startsWith('#practice=');
  if (!special) showAppPage('home');
})();

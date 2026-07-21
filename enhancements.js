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
    const render=()=>{const d={headline:q('wbHeadline').value,goals:q('wbGoals').value,spotlight:q('wbSpotlight').value};localStorage.setItem('wpp-whiteboard',JSON.stringify(d));const logoSrc=document.querySelector('.brand img')?.src||'';q('whiteboardDisplay').innerHTML=`${logoSrc?`<img alt="" class="wb-logo" src="${logoSrc}">`:''}<div class="wb-kicker">WRESTLING ROOM</div><h2>${safe(d.headline||'Today’s Focus')}</h2><div class="wb-goals">${safe(d.goals||'Add goals and reminders for the room.').replace(/\n/g,'<br>')}</div>${d.spotlight?`<div class="wb-spotlight"><span>Spotlight</span>${safe(d.spotlight)}</div>`:''}`};
    const d=load();q('wbHeadline').value=d.headline||'';q('wbGoals').value=d.goals||'';q('wbSpotlight').value=d.spotlight||'';['wbHeadline','wbGoals','wbSpotlight'].forEach(id=>q(id).addEventListener('input',render));render();
    b.onclick=()=>showWhiteboard(); q('openWhiteboardTv').onclick=()=>{const u=new URL(location.href);u.searchParams.set('whiteboard','1');window.open(u,'wrestling-whiteboard','popup=yes,width=1400,height=900,resizable=yes')};
    if(new URLSearchParams(location.search).get('whiteboard')==='1'){document.body.classList.add('whiteboard-tv');showWhiteboard()}
  }
  function showWhiteboard(){
    ['builderPage','libraryPage','teamBoardPage','practiceDataPage','practiceQueuePage','drillLibraryPage'].forEach(id=>q(id)?.classList.remove('active'));
    q('builderPage')?.classList.add('hidden-page');q('whiteboardPage')?.classList.add('active');document.querySelectorAll('.page-nav button').forEach(x=>x.classList.toggle('active',x.id==='navWhiteboard'));window.scrollTo(0,0);
  }
  const originalShow=showAppPage; showAppPage=function(page){q('whiteboardPage')?.classList.remove('active');q('builderPage')?.classList.remove('hidden-page');document.body.classList.remove('whiteboard-tv');if(page==='whiteboard')return showWhiteboard();q('navWhiteboard')?.classList.remove('active');return originalShow(page)};
  const originalData=renderPracticeData; renderPracticeData=function(){originalData();renderAdvancedAnalytics()};
  const originalDrills=renderDrillLibrary; renderDrillLibrary=function(){originalDrills();enhanceDrillCards()};
  installAnalyticsUI();installDropZone();installWhiteboard();renderAdvancedAnalytics();enhanceDrillCards();
})();

/* Final whiteboard tab isolation fix. */
(() => {
  const hideWhiteboard = () => {
    const page = document.getElementById('whiteboardPage');
    if (page) page.classList.remove('active');
    document.getElementById('navWhiteboard')?.classList.remove('active');
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
    const shortDate = value => {
      if (!value) return 'No date';
      const d = new Date(value + 'T12:00:00');
      if (Number.isNaN(d.getTime())) return value;
      const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      return `${weekday}, ${month}. ${d.getDate()}, ${d.getFullYear()}`;
    };
    byId('homeRecentPractices').innerHTML = archives.length ? archives.slice(0,5).map(a => `<div class="home-recent-row" data-archive-id="${safeText(a.id)}"><div><strong>${safeText(a.goal || 'Practice')}</strong><br><span>${safeText(shortDate(a.date))}</span></div><strong>${archiveMinutes(a)}m</strong></div>`).join('') : '<div class="home-empty">Archived practices will appear here.</div>';
    byId('homeRecentPractices').querySelectorAll('.home-recent-row[data-archive-id]').forEach(row => {
      row.addEventListener('click', () => openArchiveCard(row.dataset.archiveId));
    });
  }

  function openArchiveCard(id){
    if (!id) return;
    showAppPage('library');
    const card = document.querySelector(`.archive-card[data-archive-id="${CSS?.escape ? CSS.escape(id) : id}"]`);
    if (card) {
      const month = card.closest('.archive-month');
      if (month) month.open = true;
      card.classList.add('open');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  window.openArchiveCard = openArchiveCard;

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
  const special = params.has('tv') || params.has('whiteboard') || params.has('code') || location.hash.startsWith('#practice=') || location.hash.startsWith('#p=');
  if (!special) showAppPage('home');
})();

/* ===== Practice Templates ===== */
(() => {
  const byId = id => document.getElementById(id);
  const safeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const KEY = 'wpp-practice-templates';
  const readTemplates = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const writeTemplates = list => { localStorage.setItem(KEY, JSON.stringify(list)); renderList(); };

  function buildModal(){
    if (byId('templatesBackdrop')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.id = 'templatesBackdrop';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `<section class="block-modal templates-modal" role="dialog" aria-modal="true" aria-labelledby="templatesTitle">
      <h2 id="templatesTitle">Practice Templates</h2>
      <div class="template-save-row">
        <input id="templateNameInput" type="text" placeholder="Template name (e.g. Tuesday Live Wrestling)">
        <button class="primary" id="saveTemplateBtn" type="button">Save Current</button>
      </div>
      <div class="template-list" id="templateList"></div>
      <div class="modal-actions" style="grid-template-columns:1fr">
        <button class="secondary" id="closeTemplatesBtn" type="button">Close</button>
      </div>
    </section>`;
    document.querySelector('.app')?.appendChild(wrap);
    byId('saveTemplateBtn').addEventListener('click', saveCurrentAsTemplate);
    byId('closeTemplatesBtn').addEventListener('click', closeModal);
    wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(); });
    byId('templateNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveCurrentAsTemplate(); });
  }

  function openModal(){ buildModal(); renderList(); byId('templatesBackdrop').classList.add('open'); byId('templatesBackdrop').setAttribute('aria-hidden','false'); }
  function closeModal(){ byId('templatesBackdrop')?.classList.remove('open'); byId('templatesBackdrop')?.setAttribute('aria-hidden','true'); }

  function saveCurrentAsTemplate(){
    if (!Array.isArray(state.blocks) || !state.blocks.length) { alert('Add at least one practice block before saving a template.'); return; }
    const nameInput = byId('templateNameInput');
    const name = (nameInput.value || '').trim() || `Template ${new Date().toLocaleDateString()}`;
    const template = {
      id: crypto.randomUUID?.() || String(Date.now()),
      name,
      goal: byId('practiceGoal')?.value || '',
      length: Number(byId('practiceLength')?.value) || (typeof total === 'function' ? total() : 90),
      blocks: state.blocks.map(b => ({ name: b.name, minutes: Number(b.minutes) || 1, details: b.details || '', category: b.category || 'other' })),
      createdAt: new Date().toISOString()
    };
    const list = readTemplates();
    list.unshift(template);
    writeTemplates(list);
    nameInput.value = '';
  }

  function applyTemplate(id, { replace } = { replace: true }){
    const t = readTemplates().find(x => x.id === id);
    if (!t) return;
    if (replace && state.blocks.length && !confirm('Replace the current practice blocks with this template?')) return;
    const newBlocks = t.blocks.map(b => ({ id: crypto.randomUUID(), name: b.name, minutes: Number(b.minutes) || 1, details: b.details || '', category: b.category || 'other', coachNotes: '', completionStatus: 'not_completed', actualMinutes: Number(b.minutes) || 1 }));
    state.blocks = replace ? newBlocks : [...state.blocks, ...newBlocks];
    if (t.goal && byId('practiceGoal')) byId('practiceGoal').value = t.goal;
    if (t.length && byId('practiceLength')) byId('practiceLength').value = t.length;
    render(); save();
    closeModal();
    showAppPage('builder');
  }

  function deleteTemplate(id){
    const t = readTemplates().find(x => x.id === id);
    if (!t || !confirm(`Delete the "${t.name}" template?`)) return;
    writeTemplates(readTemplates().filter(x => x.id !== id));
  }

  function renderList(){
    const list = byId('templateList'); if (!list) return;
    const templates = readTemplates();
    list.innerHTML = templates.length ? templates.map(t => `<div class="template-card"><div><div class="template-card-name">${safeText(t.name)}</div><div class="template-card-meta">${t.blocks.length} block${t.blocks.length === 1 ? '' : 's'} · ${t.length || t.blocks.reduce((s,b)=>s+(Number(b.minutes)||0),0)} min${t.goal ? ' · ' + safeText(t.goal) : ''}</div></div><div class="template-card-actions"><button class="secondary" data-template-use="${t.id}" type="button">Use</button><button class="danger" data-template-delete="${t.id}" type="button">Delete</button></div></div>`).join('') : '<div class="template-empty">No saved templates yet. Build a practice, then save it as a template.</div>';
    list.querySelectorAll('[data-template-use]').forEach(b => b.addEventListener('click', () => applyTemplate(b.dataset.templateUse)));
    list.querySelectorAll('[data-template-delete]').forEach(b => b.addEventListener('click', () => deleteTemplate(b.dataset.templateDelete)));
  }

  function installButton(){
    const actions = document.querySelector('#builderPage .actions');
    if (!actions || byId('templatesBtn')) return;
    const btn = document.createElement('button');
    btn.className = 'secondary';
    btn.id = 'templatesBtn';
    btn.type = 'button';
    btn.textContent = 'Templates';
    btn.addEventListener('click', openModal);
    actions.insertAdjacentElement('afterend', btn);
  }

  window.wppTemplates = { list: readTemplates, apply: applyTemplate, open: openModal, save: saveCurrentAsTemplate, remove: deleteTemplate };

  const start = () => installButton();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ===== Universal Search (Ctrl+K / Cmd+K) ===== */
(() => {
  const byId = id => document.getElementById(id);
  const safeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const readJson = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch { return fallback; } };

  const PAGES = [
    { label: 'Home', sub: 'Dashboard and overview', page: 'home' },
    { label: 'Practice Builder', sub: "Build today's practice", page: 'builder' },
    { label: 'Coach Mode', sub: 'Run practice with the timer', page: 'coach' },
    { label: 'Team Board', sub: 'Display the plan for the team', page: 'team' },
    { label: 'Whiteboard', sub: 'TV whiteboard view', page: 'whiteboard' },
    { label: 'Archive', sub: 'Past practices', page: 'library' },
    { label: 'Data', sub: 'Season practice data', page: 'data' },
    { label: 'Practice Inbox', sub: 'Items queued for a future practice', page: 'queue' },
    { label: 'Drill Library', sub: 'Saved drills', page: 'drills' }
  ];

  function buildModal(){
    if (byId('cmdkBackdrop')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.id = 'cmdkBackdrop';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `<section class="block-modal cmdk-modal" role="dialog" aria-modal="true" aria-label="Universal search">
      <div class="cmdk-input-row"><input id="cmdkInput" type="text" placeholder="Search practices, drills, inbox, templates, pages…" autocomplete="off"></div>
      <div class="cmdk-results" id="cmdkResults"></div>
      <div class="cmdk-hint"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
    </section>`;
    document.querySelector('.app')?.appendChild(wrap);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    const input = byId('cmdkInput');
    input.addEventListener('input', () => renderResults(input.value));
    input.addEventListener('keydown', onKeydown);
  }

  function buildIndex(){
    const items = [];
    PAGES.forEach(p => items.push({ type: 'Page', label: p.label, sub: p.sub, action: () => showAppPage(p.page) }));

    const archives = readJson('wpp-practice-library', []);
    (Array.isArray(archives) ? archives : []).forEach(a => {
      const dateLabel = typeof archiveDateLabel === 'function' ? archiveDateLabel(a) : (a.date || 'Undated practice');
      items.push({
        type: 'Practice',
        label: a.goal ? a.goal : dateLabel,
        sub: `${dateLabel}${a.goal ? '' : ''}`.trim(),
        action: () => { close(); window.openArchiveCard(a.id); }
      });
    });

    const drills = readJson('wpp-drill-library', []);
    (Array.isArray(drills) ? drills : []).forEach(d => {
      items.push({
        type: 'Drill',
        label: d.name || 'Untitled drill',
        sub: `${d.minutes || 0} min${d.tags ? ' · ' + d.tags : ''}`,
        action: () => { close(); showAppPage('drills'); const s = byId('drillSearch'); if (s) { s.value = d.name || ''; s.dispatchEvent(new Event('input')); } }
      });
    });

    const inbox = readJson('wpp-practice-queue', []);
    (Array.isArray(inbox) ? inbox : []).forEach(q => {
      items.push({
        type: 'Inbox',
        label: q.title || 'Untitled item',
        sub: `Added by ${q.addedBy || 'Coach'}`,
        action: () => { close(); showAppPage('queue'); const s = byId('queueSearch'); if (s) { s.value = q.title || ''; s.dispatchEvent(new Event('input')); } }
      });
    });

    const templates = (window.wppTemplates && typeof window.wppTemplates.list === 'function') ? window.wppTemplates.list() : readJson('wpp-practice-templates', []);
    (Array.isArray(templates) ? templates : []).forEach(t => {
      items.push({
        type: 'Template',
        label: t.name || 'Untitled template',
        sub: `${(t.blocks || []).length} blocks`,
        action: () => { close(); if (window.wppTemplates) window.wppTemplates.apply(t.id); }
      });
    });

    return items;
  }

  let activeIndex = 0;
  let currentResults = [];

  function renderResults(query){
    const list = byId('cmdkResults');
    const q = (query || '').trim().toLowerCase();
    const all = buildIndex();
    currentResults = q ? all.filter(item => `${item.label} ${item.sub} ${item.type}`.toLowerCase().includes(q)) : all.slice(0, 9);
    currentResults = currentResults.slice(0, 30);
    activeIndex = 0;
    if (!currentResults.length){
      list.innerHTML = '<div class="cmdk-empty">No matches. Try a different search.</div>';
      return;
    }
    list.innerHTML = currentResults.map((item, i) => `<div class="cmdk-item${i === activeIndex ? ' active' : ''}" data-i="${i}"><div><strong>${safeText(item.label)}</strong>${item.sub ? `<span class="cmdk-sub">${safeText(item.sub)}</span>` : ''}</div><span class="cmdk-tag">${safeText(item.type)}</span></div>`).join('');
    list.querySelectorAll('.cmdk-item').forEach(el => {
      el.addEventListener('click', () => { const item = currentResults[Number(el.dataset.i)]; if (item) item.action(); });
      el.addEventListener('mouseenter', () => setActive(Number(el.dataset.i)));
    });
  }

  function setActive(i){
    activeIndex = Math.max(0, Math.min(currentResults.length - 1, i));
    byId('cmdkResults').querySelectorAll('.cmdk-item').forEach(el => el.classList.toggle('active', Number(el.dataset.i) === activeIndex));
    byId('cmdkResults').querySelector('.cmdk-item.active')?.scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(e){
    if (e.key === 'ArrowDown'){ e.preventDefault(); setActive(activeIndex + 1); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); setActive(activeIndex - 1); }
    else if (e.key === 'Enter'){ e.preventDefault(); const item = currentResults[activeIndex]; if (item) item.action(); }
    else if (e.key === 'Escape'){ e.preventDefault(); close(); }
  }

  function open(){
    buildModal();
    byId('cmdkBackdrop').classList.add('open');
    byId('cmdkBackdrop').setAttribute('aria-hidden', 'false');
    const input = byId('cmdkInput');
    input.value = '';
    renderResults('');
    setTimeout(() => input.focus(), 0);
  }

  function close(){
    byId('cmdkBackdrop')?.classList.remove('open');
    byId('cmdkBackdrop')?.setAttribute('aria-hidden', 'true');
  }

  function installTrigger(){
    const header = document.querySelector('.header');
    if (!header || byId('cmdkOpenBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'cmdkOpenBtn';
    btn.type = 'button';
    btn.className = 'cmdk-trigger';
    btn.innerHTML = '🔍 Search <kbd>Ctrl K</kbd>';
    btn.addEventListener('click', open);
    header.appendChild(btn);
  }

  document.addEventListener('keydown', e => {
    const key = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'k'){
      e.preventDefault();
      const isOpen = byId('cmdkBackdrop')?.classList.contains('open');
      if (isOpen) close(); else open();
    }
  });

  const start = () => installTrigger();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ===== Resizable Coach Mode columns ===== */
(() => {
  const KEY = 'wpp-coach-columns';
  const MINS = [250, 300, 340];
  const DEFAULT_RATIOS = [0.72, 1, 1.1];

  function loadRatios() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && n > 0)) return v;
    } catch {}
    return [...DEFAULT_RATIOS];
  }
  function saveRatios(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch {} }
  function applyRatios(grid, r) {
    grid.style.gap = '0';
    grid.style.gridTemplateColumns = `minmax(${MINS[0]}px, ${r[0]}fr) 10px minmax(${MINS[1]}px, ${r[1]}fr) 10px minmax(${MINS[2]}px, ${r[2]}fr)`;
  }

  function makeHandle(index) {
    const h = document.createElement('div');
    h.className = 'dash-resize-handle';
    h.dataset.index = String(index);
    h.setAttribute('role', 'separator');
    h.setAttribute('aria-orientation', 'vertical');
    h.setAttribute('aria-label', 'Resize columns');
    h.tabIndex = 0;
    return h;
  }

  function wireHandle(h, grid, panels, getRatios, setRatios) {
    let dragging = false, startX = 0, startWidths = null;
    const pointX = e => (e.touches ? e.touches[0].clientX : e.clientX);
    const onMove = e => {
      if (!dragging) return;
      const delta = pointX(e) - startX;
      const i = Number(h.dataset.index);
      const widths = [...startWidths];
      widths[i] = Math.max(MINS[i], startWidths[i] + delta);
      widths[i + 1] = Math.max(MINS[i + 1], startWidths[i + 1] - delta);
      setRatios(widths);
      applyRatios(grid, widths);
      if (e.cancelable) e.preventDefault();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('dash-resizing');
      saveRatios(getRatios());
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    const onDown = e => {
      dragging = true;
      document.body.classList.add('dash-resizing');
      startX = pointX(e);
      startWidths = panels.map(p => p.getBoundingClientRect().width);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
      e.preventDefault();
    };
    h.addEventListener('mousedown', onDown);
    h.addEventListener('touchstart', onDown, { passive: false });
    h.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = Number(h.dataset.index);
      const widths = panels.map(p => p.getBoundingClientRect().width);
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      const step = 20;
      widths[i] = Math.max(MINS[i], widths[i] + dir * step);
      widths[i + 1] = Math.max(MINS[i + 1], widths[i + 1] - dir * step);
      setRatios(widths);
      applyRatios(grid, widths);
      saveRatios(widths);
    });
  }

  function install() {
    const grid = document.querySelector('.dash-grid');
    if (!grid || grid.dataset.resizable === '1') return;
    const panels = [...grid.querySelectorAll(':scope > .panel')];
    if (panels.length !== 3) return;
    grid.dataset.resizable = '1';
    let ratios = loadRatios();
    applyRatios(grid, ratios);
    const h0 = makeHandle(0), h1 = makeHandle(1);
    panels[0].after(h0);
    panels[1].after(h1);
    const getRatios = () => ratios;
    const setRatios = r => { ratios = r; };
    wireHandle(h0, grid, panels, getRatios, setRatios);
    wireHandle(h1, grid, panels, getRatios, setRatios);
  }

  const start = () => install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ===== Relocate Spotify player to fill the practice column + remember collapsed state ===== */
(() => {
  function relocateSpotify() {
    const anchor = document.querySelector('#timerPanel .compact-timer-section');
    const spotifyBox = document.getElementById('spotifyBox');
    if (!anchor || !spotifyBox || spotifyBox.dataset.relocated === '1') return false;
    spotifyBox.dataset.relocated = '1';
    anchor.after(spotifyBox);
    const ratingRow = document.getElementById('practiceRatingRow');
    if (ratingRow) spotifyBox.after(ratingRow);
    return true;
  }

  function wireCollapsePersistence(el, key) {
    if (!el || el.dataset.collapseWired === '1') return;
    el.dataset.collapseWired = '1';
    try { if (localStorage.getItem(key) === '1') el.open = true; } catch {}
    el.addEventListener('toggle', () => { try { localStorage.setItem(key, el.open ? '1' : '0'); } catch {} });
  }

  function install() {
    const moved = relocateSpotify();
    wireCollapsePersistence(document.getElementById('spotifyBox'), 'wpp-spotify-open');
    wireCollapsePersistence(document.getElementById('coachPracticeInbox'), 'wpp-coach-inbox-open');
    wireCollapsePersistence(document.getElementById('coachNotesPanel'), 'wpp-coach-notes-open');
    return moved;
  }

  const start = () => install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  // Practice Inbox panel is created slightly after DOMContentLoaded in some load orders; retry briefly.
  let attempts = 0;
  const retry = setInterval(() => {
    attempts++;
    if (install() || attempts > 20) clearInterval(retry);
  }, 150);
})();

/* ===== Practice Plan QR code in Coach Mode ===== */
(() => {
  function renderQr() {
    const img = document.getElementById('practiceQrCanvas');
    const linkInput = document.getElementById('qrLinkInput');
    const hint = document.getElementById('qrSummaryHint');
    if (!img) return;
    if (!(typeof state !== 'undefined' && state.blocks && state.blocks.length)) {
      if (hint) hint.textContent = 'Add practice blocks first';
      if (linkInput) linkInput.value = '';
      img.removeAttribute('src');
      return;
    }
    const url = typeof window.currentPracticeShareUrl === 'function' ? window.currentPracticeShareUrl() : '';
    if (!url) { if (hint) hint.textContent = 'Could not build a share link.'; return; }
    if (linkInput) linkInput.value = url;
    if (hint) hint.textContent = 'Loading QR code…';
    img.onload = () => { if (hint) hint.textContent = 'Scan to open the practice plan'; };
    img.onerror = () => { if (hint) hint.textContent = 'Could not generate QR code. Check your connection.'; };
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=176x176&margin=8&data=' + encodeURIComponent(url);
  }
  function wire() {
    const box = document.getElementById('qrBox');
    if (!box || box.dataset.qrWired === '1') return;
    box.dataset.qrWired = '1';
    box.addEventListener('toggle', () => { if (box.open) renderQr(); });
    const copyBtn = document.getElementById('qrCopyBtn');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      const input = document.getElementById('qrLinkInput');
      if (!input || !input.value) return;
      try {
        await navigator.clipboard.writeText(input.value);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
      } catch {
        input.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
      }
    });
  }
  const start = () => wire();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='zads_reflash_desktop_v1';
const initial={mastered:[],practice:[],favorites:[],personalNotes:[],tasks:[],deals:[],clients:[],properties:[],theme:'light',popup:false,interval:15};
let state={...initial,...JSON.parse(localStorage.getItem(KEY)||'{}')};
let studyDeck=[],studyIndex=0,popupTimer=null,currentChapter='1',currentNoteId=null,noteSaveTimer=null;
function rawCards(note,id){
  if(!note)return[];
  const blocks=note.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean),out=[];
  let topic=`Chapter ${id}`,parts=[];
  const looksLikeHeading=line=>line.length<100&&!/^[-–•\d]+[.)]?\s/.test(line)&&!/[.!?]$/.test(line)&&line.split(/\s+/).length<=14;
  const flush=()=>{const answer=parts.join('\n\n').trim();if(answer.length>15)out.push({id:`${id}-raw-${out.length}`,q:`What do the original Chapter ${id} course notes state about ${topic}?`,a:answer});parts=[]};
  for(const block of blocks){
    const lines=block.split('\n').map(x=>x.trim()).filter(Boolean);
    if(!lines.length)continue;
    if(looksLikeHeading(lines[0])){
      flush();topic=lines[0].replace(/:$/,'');
      if(lines.length>1)parts.push(lines.slice(1).join('\n'));
    }else parts.push(lines.join('\n'));
  }
  flush();
  return out;
}
const chapters=window.REFLASH_DATA.map(([id,title])=>{const notes=(window.REFLASH_NOTES||{})[id]||'';return{id,title,notes,cards:rawCards(notes,id)}});
function save(){localStorage.setItem(KEY,JSON.stringify(state));$('#saveState').textContent='Saved locally';updateStats()}
function nav(view){$$('.view').forEach(v=>v.classList.toggle('active',v.id===view));$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#pageTitle').textContent={dashboard:'Dashboard',brain:'Brain',notes:'Personal Notes',work:'Work Mode',vault:'Vault',inventory:'NY Inventory',settings:'Settings'}[view];$('#eyebrow').textContent=view==='work'?'REAL ESTATE OPERATIONS':view.toUpperCase();if(view==='inventory'&&window.renderInventory)window.renderInventory();if(view==='vault')renderVault();if(view==='work')renderWork('agenda');if(view==='notes')renderNotesList()}
$$('#nav button').forEach(b=>b.onclick=()=>nav(b.dataset.view));$$('[data-jump]').forEach(b=>b.onclick=()=>nav(b.dataset.jump));
function renderChapters(filter=''){const f=filter.toLowerCase();$('#chapterList').innerHTML=chapters.filter(c=>!f||(`${c.id} ${c.title} ${c.notes} ${c.cards.map(x=>x.q+' '+x.a).join(' ')}`).toLowerCase().includes(f)).map(c=>{const done=c.cards.filter(x=>state.mastered.includes(x.id)).length,pct=c.cards.length?Math.round(done/c.cards.length*100):0;return`<button data-ch="${c.id}" class="${c.id===currentChapter?'active':''}"><span class="chapter-num">${c.id}</span><span class="chapter-info"><b>${c.title}</b><small>${done}/${c.cards.length} mastered • ${pct}%</small><i><em style="width:${pct}%"></em></i></span></button>`}).join('');$$('[data-ch]').forEach(b=>b.onclick=()=>{currentChapter=b.dataset.ch;renderChapters($('#brainSearch').value);renderBrainDetail()})}
function esc(s){return String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}
function escAttr(s){return esc(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function renderBrainDetail(){const c=chapters.find(x=>x.id===currentChapter)||chapters[0];$('#brainDetail').innerHTML=`<div class="panel-head"><div><p class="eyebrow">CHAPTER ${c.id}</p><h2>${c.title}</h2></div><button class="primary" id="studyChapter">Study chapter</button></div><details class="raw-notes" open><summary><b>Original raw course notes</b><span>${c.notes.length.toLocaleString()} characters</span></summary><div class="note-sheet">${esc(c.notes)}</div></details><h3>Flashcard index</h3><div class="card-index">${c.cards.map(x=>`<div class="index-card"><strong>${esc(x.q)}</strong><span>${esc(x.a)}</span></div>`).join('')}</div>`;$('#studyChapter').onclick=()=>startStudy(c.cards,c.title)}
function shuffled(a){return [...a].sort(()=>Math.random()-.5)}
function startStudy(cards,title='All Chapters'){studyDeck=cards;studyIndex=0;$('#studyDialog').dataset.title=title;showCard();$('#studyDialog').showModal()}
function showCard(){if(!studyDeck.length)return;const c=studyDeck[studyIndex];$('#studyCard').classList.remove('flipped');$('#studyQuestion').textContent=c.q;$('#studyAnswer').textContent=c.a;$('#studyMeta').textContent=`${$('#studyDialog').dataset.title} • Card ${studyIndex+1} of ${studyDeck.length}`;$('#favoriteCard').textContent=state.favorites.includes(c.id)?'★ Favorited':'☆ Favorite';$('#practiceCard').textContent=state.practice.includes(c.id)?'Review Needed ✓':'Need Practice'}
$('#studyCard').onclick=()=>$('#studyCard').classList.toggle('flipped');$('#closeStudy').onclick=()=>$('#studyDialog').close();$('#nextCard').onclick=()=>{studyIndex=(studyIndex+1)%studyDeck.length;showCard()};$('#prevCard').onclick=()=>{studyIndex=(studyIndex-1+studyDeck.length)%studyDeck.length;showCard()};
$('#masterCard').onclick=()=>{const id=studyDeck[studyIndex].id;if(!state.mastered.includes(id))state.mastered.push(id);state.practice=state.practice.filter(x=>x!==id);save();$('#nextCard').click()};$('#practiceCard').onclick=()=>{const id=studyDeck[studyIndex].id;if(!state.practice.includes(id))state.practice.push(id);state.mastered=state.mastered.filter(x=>x!==id);save();$('#nextCard').click()};
$('#favoriteCard').onclick=()=>{const id=studyDeck[studyIndex].id;state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];save();showCard()};
function cardsByIds(ids){const set=new Set(ids);return chapters.flatMap(c=>c.cards).filter(x=>set.has(x.id))}
function startReview(cards,title){if(!cards.length){alert(`No cards are currently in ${title}.`);return}startStudy(shuffled(cards),title)}
$('#studyAll').onclick=()=>startStudy(shuffled(chapters.flatMap(c=>c.cards)),'Study All • Shuffled');$('#studyFavorites').onclick=()=>startReview(cardsByIds(state.favorites),'Favorites');$('#studyPractice').onclick=()=>startReview(cardsByIds(state.practice),'Need Practice');$('#quickStudy').onclick=()=>{const c=shuffled(chapters.flatMap(c=>c.cards))[0];$('#quickCard').innerHTML=`<strong>${c.q}</strong><small>Click to reveal</small>`;$('#quickCard').onclick=()=>$('#quickCard').innerHTML=`<span>${c.a}</span>`};$('#brainSearch').oninput=e=>renderChapters(e.target.value);

function noteLinkLabel(note){
  if(note.linkType==='chapter'){const c=chapters.find(x=>x.id===note.linkId);return c?`Chapter ${c.id}`:'Course chapter'}
  if(note.linkType==='client'){const x=state.clients[Number(note.linkId)];return x?`Client: ${x.name}`:'Client'}
  if(note.linkType==='property'){const x=state.properties[Number(note.linkId)];return x?`Property: ${x.name}`:'Property'}
  return 'Unfiled';
}
function attachmentOptions(note){
  let out='<option value="none:">Unfiled</option><optgroup label="Course chapters">';
  out+=chapters.map(c=>`<option value="chapter:${c.id}">Chapter ${c.id}: ${esc(c.title)}</option>`).join('')+'</optgroup>';
  if(state.clients.length)out+='<optgroup label="Clients">'+state.clients.map((x,i)=>`<option value="client:${i}">${esc(x.name)}</option>`).join('')+'</optgroup>';
  if(state.properties.length)out+='<optgroup label="Properties">'+state.properties.map((x,i)=>`<option value="property:${i}">${esc(x.name)}</option>`).join('')+'</optgroup>';
  return out;
}
function renderNotesList(){
  const filter=($('#notesSearch')?.value||'').toLowerCase();
  const notes=[...state.personalNotes].sort((a,b)=>new Date(b.updated)-new Date(a.updated)).filter(n=>!filter||`${n.title} ${n.body} ${noteLinkLabel(n)}`.toLowerCase().includes(filter));
  $('#notesCount').textContent=state.personalNotes.length;
  $('#personalNotesList').innerHTML=notes.length?notes.map(n=>`<div class="personal-note-row ${n.id===currentNoteId?'active':''}" data-note="${n.id}"><b>${esc(n.title||'Untitled Note')}</b><span>${esc((n.body||'').replace(/\n/g,' ')||'No additional text')}</span><small>${esc(noteLinkLabel(n))} · ${new Date(n.updated).toLocaleString()}</small></div>`).join(''):'<div class="empty">No personal notes yet.</div>';
  $$('[data-note]').forEach(row=>row.onclick=()=>openNote(row.dataset.note));
}
function newPersonalNote(){
  const now=new Date().toISOString(),note={id:String(Date.now()),title:'New Note',body:'',linkType:'none',linkId:'',created:now,updated:now};
  state.personalNotes.push(note);currentNoteId=note.id;save();renderNotesList();renderNoteEditor(note);setTimeout(()=>$('#noteTitle')?.select(),0);
}
function openNote(id){currentNoteId=String(id);const note=state.personalNotes.find(n=>n.id===currentNoteId);renderNotesList();if(note)renderNoteEditor(note)}
function renderNoteEditor(note){
  $('#noteEditorPane').innerHTML=`<div class="note-editor"><div class="note-editor-top"><input id="noteTitle" value="${escAttr(note.title||'')}" placeholder="Note title"><select id="noteAttachment">${attachmentOptions(note)}</select><span class="note-save-state" id="noteSaveState">Saved</span></div><textarea class="note-body" id="noteBody" placeholder="Start typing…">${esc(note.body||'')}</textarea><div class="note-meta">Created ${new Date(note.created).toLocaleString()} · Last edited ${new Date(note.updated).toLocaleString()}</div><div class="note-editor-actions"><button class="delete-note" id="deleteNote">Delete Note</button><button class="save-done" id="saveDone">Save & Done</button></div></div>`;
  $('#noteAttachment').value=`${note.linkType||'none'}:${note.linkId||''}`;
  const changed=()=>queueNoteSave(note.id);
  $('#noteTitle').oninput=changed;$('#noteBody').oninput=changed;$('#noteAttachment').onchange=changed;
  $('#saveDone').onclick=()=>{saveCurrentNote(note.id,true);currentNoteId=null;renderNotesList();$('#noteEditorPane').innerHTML='<div class="note-empty"><div>✓</div><h2>Note saved</h2><p>Select another note or create a new one.</p></div>'};
  $('#deleteNote').onclick=()=>{if(confirm(`Delete “${note.title||'Untitled Note'}”?`)){state.personalNotes=state.personalNotes.filter(n=>n.id!==note.id);currentNoteId=null;save();renderNotesList();$('#noteEditorPane').innerHTML='<div class="note-empty"><div>📝</div><h2>Select a personal note</h2><p>Or create a new note to begin writing.</p></div>'}};
}
function queueNoteSave(id){
  $('#noteSaveState').textContent='Saving…';clearTimeout(noteSaveTimer);noteSaveTimer=setTimeout(()=>saveCurrentNote(id),350);
}
function saveCurrentNote(id,immediate=false){
  clearTimeout(noteSaveTimer);const note=state.personalNotes.find(n=>n.id===String(id));if(!note||!$('#noteTitle'))return;
  note.title=$('#noteTitle').value.trim()||'Untitled Note';note.body=$('#noteBody').value;
  const [type,...rest]=$('#noteAttachment').value.split(':');note.linkType=type;note.linkId=rest.join(':');note.updated=new Date().toISOString();
  localStorage.setItem(KEY,JSON.stringify(state));$('#saveState').textContent='Saved locally';if($('#noteSaveState'))$('#noteSaveState').textContent='Saved';renderNotesList();
}
$('#newNote').onclick=newPersonalNote;$('#notesSearch').oninput=renderNotesList;$('#openCourseNotes').onclick=()=>nav('brain');

const workflows={
  before:['Confirm appointment and listing status','Review access and lockbox instructions','Review client requirements and route','Charge phone and bring required disclosures'],
  during:['Observe exterior and neighborhood','Verify address and property details','Record questions, defects, and client feedback','Check all rooms and relevant building systems'],
  after:['Turn off lights and secure doors and windows','Return key and confirm lockbox','Send follow-up message','Update client, property, and transaction records']
};
const dealStages={rentals:['Lead','Qualified','Showing','Application','Approved','Lease Signed','Closed'],sales:['Lead','Pre-Approval','Showing','Offer','Attorney Review','Inspection','Appraisal','Contract','Walkthrough','Closed']};
function relationOptions(){let out='<option value="">No link</option>';if(state.clients.length)out+='<optgroup label="Clients">'+state.clients.map((x,i)=>`<option value="client:${i}">${esc(x.name)}</option>`).join('')+'</optgroup>';if(state.properties.length)out+='<optgroup label="Properties">'+state.properties.map((x,i)=>`<option value="property:${i}">${esc(x.name)}</option>`).join('')+'</optgroup>';return out}
function relationLabel(value){if(!value)return'';const [kind,id]=value.split(':'),arr=kind==='client'?state.clients:state.properties,x=arr[Number(id)];return x?`${kind==='client'?'Client':'Property'}: ${x.name}`:''}
function renderWork(tab='agenda'){
  $$('[data-worktab]').forEach(b=>b.classList.toggle('active',b.dataset.worktab===tab));const el=$('#workContent');
  if(tab==='agenda'){
    const open=state.tasks.filter(t=>!t.done),today=new Date().toISOString().slice(0,10),due=open.filter(t=>t.due===today).length;
    el.innerHTML=`<div class="work-summary"><div class="work-stat"><span>Open tasks</span><strong>${open.length}</strong><small>All workflows</small></div><div class="work-stat"><span>Due today</span><strong>${due}</strong><small>${today}</small></div><div class="work-stat"><span>Rental transactions</span><strong>${state.deals.filter(d=>d.type==='rentals').length}</strong><small>Active pipeline</small></div><div class="work-stat"><span>Sales transactions</span><strong>${state.deals.filter(d=>d.type==='sales').length}</strong><small>Active pipeline</small></div></div><article class="panel"><div class="panel-head"><h3>Agenda and follow-ups</h3></div><div id="taskList"></div><div class="task-add-grid"><input id="newTask" placeholder="Add a task"><input id="taskDue" type="date"><select id="taskLink">${relationOptions()}</select><button class="primary" id="addTask">Add</button></div></article>`;
    renderTasks();$('#addTask').onclick=()=>{if($('#newTask').value.trim()){state.tasks.push({id:Date.now(),text:$('#newTask').value.trim(),due:$('#taskDue').value,link:$('#taskLink').value,done:false});save();renderWork('agenda')}};
  }else if(tab==='rentals'||tab==='sales')renderPipeline(tab);
  else if(tab==='commercial')el.innerHTML='<article class="panel coming-soon"><div>🏢</div><h2>Commercial Work Mode</h2><p>This workspace is reserved for a future commercial real estate workflow.</p><span class="linked-label">Coming Soon</span></article>';
  else renderEntities(tab);
}
function renderPipeline(type){
  const deals=state.deals.filter(d=>d.type===type),stages=dealStages[type],label=type==='rentals'?'Rentals':'Residential Sales';
  $('#workContent').innerHTML=`<div class="pipeline-head"><div><p class="eyebrow">WORK PIPELINE</p><h2>${label}</h2></div><button class="primary" id="newDeal">+ New Transaction</button></div><div class="work-summary">${stages.slice(0,4).map(stage=>`<div class="work-stat"><span>${stage}</span><strong>${deals.filter(d=>d.stage===stage).length}</strong><small>transactions</small></div>`).join('')}</div><article class="panel"><h3>Transactions</h3>${deals.length?deals.map(d=>dealCard(d,stages)).join(''):'<div class="empty">No transactions yet.</div>'}</article><div class="showing-columns">${Object.entries(workflows).map(([phase,items])=>`<article class="showing-column"><h3>${phase[0].toUpperCase()+phase.slice(1)} the showing</h3><ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul><button data-add-phase="${phase}">Add to agenda</button></article>`).join('')}</div>`;
  $('#newDeal').onclick=()=>openDeal(type);$$('[data-deal-stage]').forEach(s=>s.onchange=()=>{const d=state.deals.find(x=>String(x.id)===s.dataset.dealStage);d.stage=s.value;save();renderPipeline(type)});$$('[data-delete-deal]').forEach(b=>b.onclick=()=>{if(confirm('Delete this transaction?')){state.deals=state.deals.filter(x=>String(x.id)!==b.dataset.deleteDeal);save();renderPipeline(type)}});$$('[data-add-phase]').forEach(b=>b.onclick=()=>{workflows[b.dataset.addPhase].forEach(text=>state.tasks.push({id:Date.now()+Math.random(),text,due:'',link:'',done:false,type}));save();renderWork('agenda')});
}
function dealCard(d,stages){const idx=Math.max(0,stages.indexOf(d.stage)),pct=Math.round(idx/(stages.length-1)*100),client=d.clientId!==''?state.clients[Number(d.clientId)]:null,property=d.propertyId!==''?state.properties[Number(d.propertyId)]:null;return`<div class="deal-card"><div class="deal-top"><div><strong>${esc(d.title)}</strong><p>${client?'Client: '+esc(client.name):'No client'} · ${property?'Property: '+esc(property.name):'No property'}</p></div><select data-deal-stage="${d.id}">${stages.map(s=>`<option ${s===d.stage?'selected':''}>${s}</option>`).join('')}</select></div><div class="deal-progress"><i style="width:${pct}%"></i></div><p>${esc(d.notes||'No transaction notes')} ${d.date?'· Target '+d.date:''}</p><div class="deal-actions"><span class="linked-label">${pct}% complete</span><button data-delete-deal="${d.id}">Delete</button></div></div>`}
function renderEntities(tab){const arr=tab==='clients'?state.clients:state.properties,label=tab==='clients'?'Clients':'Properties';$('#workContent').innerHTML=`<article class="panel"><div class="panel-head"><h2>${label}</h2><button class="primary" id="newEntity">+ New</button></div><div>${arr.length?arr.map((x,i)=>{const kind=tab==='clients'?'client':'property',notes=state.personalNotes.filter(n=>n.linkType===kind&&String(n.linkId)===String(i)).length,tasks=state.tasks.filter(t=>t.link===`${kind}:${i}`&&!t.done).length,deals=state.deals.filter(d=>String(kind==='client'?d.clientId:d.propertyId)===String(i)).length;return`<div class="entity-card"><strong>${esc(x.name)}</strong><p>${esc(x.detail||'')} • ${esc(x.type||'')}</p><p>${esc(x.notes||'')}</p><div class="entity-meta"><span class="linked-label">${deals} transactions</span><span class="linked-label">${tasks} open tasks</span><span class="linked-label">${notes} notes</span></div></div>`}).join(''):'<div class="empty">No records yet.</div>'}</div></article>`;$('#newEntity').onclick=()=>openEntity(tab)}
$$('[data-worktab]').forEach(b=>b.onclick=()=>renderWork(b.dataset.worktab));
function renderTasks(){const el=$('#taskList');if(!state.tasks.length){el.innerHTML='<div class="empty">No tasks yet.</div>';return}el.innerHTML=[...state.tasks].sort((a,b)=>Number(a.done)-Number(b.done)).map(t=>`<label class="check-item"><input type="checkbox" data-task="${t.id}" ${t.done?'checked':''}><span>${esc(t.text)}${t.link?`<small class="linked-label">${esc(relationLabel(t.link))}</small>`:''}</span>${t.due?`<span class="task-due">Due ${t.due}</span>`:''}<button data-delete-task="${t.id}">×</button></label>`).join('');$$('[data-task]').forEach(c=>c.onchange=()=>{const t=state.tasks.find(x=>String(x.id)===c.dataset.task);t.done=c.checked;save()});$$('[data-delete-task]').forEach(b=>b.onclick=e=>{e.preventDefault();state.tasks=state.tasks.filter(x=>String(x.id)!==b.dataset.deleteTask);save();renderWork('agenda')})}
function openEntity(kind){$('#formTitle').textContent=kind==='clients'?'New client':'New property';$('#entityForm').dataset.kind=kind;$('#formDialog').showModal()}
function openDeal(type){$('#dealForm').reset();$('#dealForm [name="type"]').value=type;$('#dealClient').innerHTML='<option value="">No client linked</option>'+state.clients.map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join('');$('#dealProperty').innerHTML='<option value="">No property linked</option>'+state.properties.map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join('');$('#dealDialog').showModal()}
$('#closeDeal').onclick=()=>$('#dealDialog').close();$('#dealForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.id=Date.now();d.stage=dealStages[d.type][0];state.deals.push(d);save();$('#dealDialog').close();renderPipeline(d.type)};
$('#entityForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target),obj=Object.fromEntries(fd);state[e.target.dataset.kind].push(obj);save();$('#formDialog').close();e.target.reset();renderWork(e.target.dataset.kind)};
let db;const dbReq=indexedDB.open('reflashVault',1);dbReq.onupgradeneeded=e=>e.target.result.createObjectStore('files',{keyPath:'id'});dbReq.onsuccess=e=>{db=e.target.result;renderVault()};
function vaultStore(mode='readonly'){return db.transaction('files',mode).objectStore('files')}
function addFiles(files){if(!db)return;[...files].forEach(file=>vaultStore('readwrite').put({id:Date.now()+Math.random(),name:file.name,type:file.type,size:file.size,date:new Date().toISOString(),blob:file}));setTimeout(renderVault,300)}
$('#fileInput').onchange=e=>addFiles(e.target.files);['dragenter','dragover'].forEach(n=>$('#dropZone').addEventListener(n,e=>{e.preventDefault();$('#dropZone').style.borderColor='var(--accent)'}));$('#dropZone').ondragleave=()=>$('#dropZone').style.borderColor='';$('#dropZone').ondrop=e=>{e.preventDefault();addFiles(e.dataTransfer.files);$('#dropZone').style.borderColor=''};
let vaultPreviewURL=null;
function previewVaultFile(file){
  if(vaultPreviewURL)URL.revokeObjectURL(vaultPreviewURL);vaultPreviewURL=URL.createObjectURL(file.blob);
  $('#vaultPreviewTitle').textContent=file.name;const type=file.type||'';let content='';
  if(type.startsWith('image/'))content=`<img class="vault-media" src="${vaultPreviewURL}" alt="${escAttr(file.name)}">`;
  else if(type==='application/pdf')content=`<iframe class="vault-frame" src="${vaultPreviewURL}"></iframe>`;
  else if(type.startsWith('audio/'))content=`<audio class="vault-av" controls src="${vaultPreviewURL}"></audio>`;
  else if(type.startsWith('video/'))content=`<video class="vault-media" controls src="${vaultPreviewURL}"></video>`;
  else if(type.startsWith('text/')||/\.(txt|md|csv|json)$/i.test(file.name)){const reader=new FileReader();reader.onload=()=>{$('#vaultPreviewBody').innerHTML=`<pre class="vault-text">${esc(reader.result)}</pre>`};reader.readAsText(file.blob);content='<div class="empty">Loading text preview…</div>'}
  else content=`<div class="empty"><h3>Preview unavailable</h3><p>${esc(file.name)} is safely stored in your Vault.</p><p>${formatBytes(file.size)} · ${esc(type||'Unknown file type')}</p></div>`;
  $('#vaultPreviewBody').innerHTML=content;$('#vaultPreview').showModal();
}
function renderVault(){if(!db)return;vaultStore().getAll().onsuccess=e=>{const files=e.target.result,filter=($('#vaultSearch').value||'').toLowerCase();const shown=files.filter(f=>f.name.toLowerCase().includes(filter));$('#vaultGrid').innerHTML=shown.length?shown.map(f=>`<div class="file-card"><strong>${esc(f.name)}</strong><small>${formatBytes(f.size)} • ${new Date(f.date).toLocaleDateString()}</small><div class="actions"><button data-open="${f.id}">Preview</button><button data-delete="${f.id}">Delete</button></div></div>`).join(''):'<div class="empty">No files stored yet.</div>';$('#vaultCount').textContent=files.length;$$('[data-open]').forEach(b=>b.onclick=()=>vaultStore().get(Number(b.dataset.open)).onsuccess=x=>previewVaultFile(x.target.result));$$('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Delete this Vault file?')){vaultStore('readwrite').delete(Number(b.dataset.delete));setTimeout(renderVault,200)}})}}
$('#closeVaultPreview').onclick=()=>{$('#vaultPreview').close();if(vaultPreviewURL){URL.revokeObjectURL(vaultPreviewURL);vaultPreviewURL=null}};
$('#vaultSearch').oninput=renderVault;function formatBytes(n){return n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB'}
function updateStats(){const total=chapters.flatMap(c=>c.cards).length;$('#overallProgress').textContent=Math.round(state.mastered.length/total*100)+'%';$('#masteredCount').textContent=`${state.mastered.length} of ${total} cards mastered`;$('#taskCount').textContent=state.tasks.filter(t=>!t.done).length;$('#agendaPreview').innerHTML=state.tasks.filter(t=>!t.done).slice(0,4).map(t=>`<div class="row">○ ${t.text}</div>`).join('')||'No tasks yet.';if($('#chapterList'))renderChapters($('#brainSearch')?.value||'')}
function applyTheme(){document.body.classList.toggle('dark',state.theme==='dark');$('#darkToggle').checked=state.theme==='dark'}$('#themeBtn').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme();save()};$('#darkToggle').onchange=e=>{state.theme=e.target.checked?'dark':'light';applyTheme();save()};
function setPopup(on){state.popup=on;clearInterval(popupTimer);$('#popupBtn').textContent=`Pop-up cards: ${on?'On':'Off'}`;if(on){popupTimer=setInterval(()=>{const c=shuffled(chapters.flatMap(x=>x.cards))[0];startStudy([c],'Desktop Pop-up Review')},state.interval*60000)}save()}
$('#popupBtn').onclick=()=>setPopup(!state.popup);$('#popupInterval').value=state.interval;$('#popupInterval').onchange=e=>{state.interval=Number(e.target.value);if(state.popup)setPopup(true);else save()};
$('#exportBtn').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='zads-reflashapp-backup.json';a.click()};$('#importInput').onchange=e=>{const r=new FileReader();r.onload=()=>{state={...initial,...JSON.parse(r.result)};save();location.reload()};r.readAsText(e.target.files[0])};$('#resetBtn').onclick=()=>{if(confirm('Reset all tasks, records, progress, and settings? Vault files are not affected.')){localStorage.removeItem(KEY);location.reload()}};
renderChapters();renderBrainDetail();renderWork();applyTheme();updateStats();if(state.popup)setPopup(true);

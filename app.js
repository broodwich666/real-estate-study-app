
(function(){
'use strict';
var KEY='nyREStudyV3';
var state=load();
var folder='all', currentPersonalNote=null, currentCourseNote=null, currentChapter=null;
var study=[], idx=0, flipped=false, autosaveTimer=null;
function $(id){return document.getElementById(id)}
function clone(x){return JSON.parse(JSON.stringify(x))}
function load(){try{var s=localStorage.getItem(KEY);if(s){var p=JSON.parse(s);if(p.version===3)return p}}catch(e){}return clone(APP_DATA)}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
function allCards(){var out=[];state.chapters.forEach(function(ch){ch.cards.forEach(function(c){out.push({chapterId:ch.id,chapterTitle:ch.title,card:c})})});return out}
function show(id,title){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});$(id).classList.add('active');if(title)$('pageTitle').textContent=title;document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('active',t.dataset.screen===id)});renderAll()}
function renderNotes(){
 var q=$('notesSearch').value.toLowerCase(), list=[];
 if(folder==='all'||folder==='course') list=list.concat(state.courseNotes.map(function(n){return Object.assign({type:'course'},n)}));
 if(folder==='all'||folder==='personal') list=list.concat(state.personalNotes.map(function(n){return Object.assign({type:'personal'},n)}));
 list=list.filter(function(n){return !q||(n.title+' '+n.body).toLowerCase().indexOf(q)!==-1});
 $('notesList').innerHTML=list.length?list.map(function(n){
   return '<div class="noteRow" data-type="'+n.type+'" data-id="'+n.id+'"><strong>'+esc(n.title)+'</strong><p>'+esc((n.body||'').split('\n').slice(0,2).join(' '))+'</p><div class="noteMeta">'+(n.type==='course'?'Course Notes':'Personal Notes')+'</div></div>'
 }).join(''):'<div class="empty">No notes found.</div>';
 document.querySelectorAll('.noteRow').forEach(function(r){r.onclick=function(){r.dataset.type==='course'?openCourse(r.dataset.id):openPersonal(r.dataset.id)}});
}
function createPersonal(){var n={id:'personal-'+Date.now(),title:'Untitled Note',body:'',folder:'Personal Notes',updated:new Date().toISOString()};state.personalNotes.unshift(n);currentPersonalNote=n.id;save();openPersonal(n.id)}
function openPersonal(id){var n=state.personalNotes.find(function(x){return x.id===id});if(!n)return;currentPersonalNote=id;$('noteTitle').value=n.title;$('noteBody').value=n.body;$('saveStatus').textContent='Saved';show('editorScreen','Edit Note')}
function autosave(){
 var n=state.personalNotes.find(function(x){return x.id===currentPersonalNote});if(!n)return;
 n.title=$('noteTitle').value.trim()||'Untitled Note';n.body=$('noteBody').value;n.updated=new Date().toISOString();save();$('saveStatus').textContent='Saved';
}
function scheduleAutosave(){clearTimeout(autosaveTimer);$('saveStatus').textContent='Saving…';autosaveTimer=setTimeout(autosave,250)}
function deletePersonal(){if(!currentPersonalNote)return;if(confirm('Delete this note?')){state.personalNotes=state.personalNotes.filter(function(n){return n.id!==currentPersonalNote});currentPersonalNote=null;save();show('notesScreen','Notes')}}
function openCourse(id){var n=state.courseNotes.find(function(x){return x.id===id});if(!n)return;currentCourseNote=id;$('courseNoteTitle').textContent=n.title;$('courseNoteBody').textContent=n.body;show('courseNoteScreen',n.title)}
function renderChapters(){var q=$('chapterSearch').value.toLowerCase();var chs=state.chapters.filter(function(ch){return !q||ch.title.toLowerCase().indexOf(q)!==-1});$('chapterList').innerHTML=chs.map(function(ch){var k=ch.cards.filter(function(c){return c.known}).length;return '<div class="chapterRow" data-id="'+ch.id+'"><div class="chapterIcon">📘</div><div class="grow"><strong>'+esc(ch.title)+'</strong><div class="subtle">'+ch.cards.length+' cards • '+k+'/'+ch.cards.length+' known</div></div><div>›</div></div>'}).join('');document.querySelectorAll('.chapterRow').forEach(function(r){r.onclick=function(){openChapter(r.dataset.id)}})}
function openChapter(id){var ch=state.chapters.find(function(x){return x.id===id});if(!ch)return;currentChapter=id;$('chapterTitle').textContent=ch.title;$('chapterStats').textContent=ch.cards.length+' flashcards • '+ch.cards.filter(function(c){return c.known}).length+' known';show('chapterScreen',ch.title)}
function begin(items){if(!items.length){alert('No cards in this set yet.');return}study=items;idx=0;flipped=false;show('studyScreen','Study')}
function renderStudy(){if(!study.length)return;var i=study[idx];$('studyChapterTitle').textContent=i.chapterTitle;$('studyCounter').textContent=(idx+1)+' of '+study.length;$('studyProgress').style.width=((idx+1)/study.length*100)+'%';$('cardSide').textContent=flipped?'Answer':'Question';$('cardText').textContent=flipped?i.card.a:i.card.q;$('favoriteCard').textContent=i.card.favorite?'★ Favorited':'☆ Favorite'}
function next(){idx=(idx+1)%study.length;flipped=false;renderStudy()} function prev(){idx=(idx-1+study.length)%study.length;flipped=false;renderStudy()}
function update(fields){var i=study[idx],ch=state.chapters.find(function(x){return x.id===i.chapterId}),c=ch.cards.find(function(x){return x.id===i.card.id});Object.keys(fields).forEach(function(k){c[k]=fields[k];i.card[k]=fields[k]});save()}
function renderIndex(){var f=$('indexChapterFilter');if(!f.dataset.ready){f.innerHTML='<option value="all">All Chapters</option>'+state.chapters.map(function(ch){return '<option value="'+ch.id+'">'+esc(ch.title)+'</option>'}).join('');f.dataset.ready='1'}var q=$('indexSearch').value.toLowerCase();var cards=allCards().filter(function(i){return (f.value==='all'||i.chapterId===f.value)&&(!q||(i.chapterTitle+' '+i.card.q+' '+i.card.a).toLowerCase().indexOf(q)!==-1)});$('indexList').innerHTML=cards.length?cards.map(function(i,n){return '<div class="indexCard"><div class="chapterTag">'+esc(i.chapterTitle)+'</div><strong>'+(n+1)+'. '+esc(i.card.q)+'</strong><p>'+esc(i.card.a)+'</p></div>'}).join(''):'<div class="empty">No cards found.</div>'}
function renderDash(){var cards=allCards(),k=cards.filter(function(i){return i.card.known}).length,p=cards.filter(function(i){return i.card.practice}).length;$('metricChapters').textContent=state.chapters.length;$('metricCards').textContent=cards.length;$('metricKnown').textContent=k;$('metricPractice').textContent=p;var pct=cards.length?Math.round(k/cards.length*100):0;$('overallProgress').style.width=pct+'%';$('overallProgressText').textContent=pct+'% of flashcards marked known'}
function renderSearch(){var q=$('globalSearch').value.toLowerCase();if(!q){$('globalResults').innerHTML='<div class="empty">Search course notes, personal notes, and flashcards.</div>';return}var html='';allCards().filter(function(i){return (i.chapterTitle+' '+i.card.q+' '+i.card.a).toLowerCase().indexOf(q)!==-1}).forEach(function(i){html+='<div class="result"><small>'+esc(i.chapterTitle)+'</small><strong>'+esc(i.card.q)+'</strong><p>'+esc(i.card.a)+'</p></div>'});state.courseNotes.filter(function(n){return (n.title+' '+n.body).toLowerCase().indexOf(q)!==-1}).forEach(function(n){html+='<div class="result" data-course="'+n.id+'"><small>Course Note</small><strong>'+esc(n.title)+'</strong><p>'+esc(n.body.slice(0,180))+'</p></div>'});state.personalNotes.filter(function(n){return (n.title+' '+n.body).toLowerCase().indexOf(q)!==-1}).forEach(function(n){html+='<div class="result" data-personal="'+n.id+'"><small>Personal Note</small><strong>'+esc(n.title)+'</strong><p>'+esc(n.body.slice(0,180))+'</p></div>'});$('globalResults').innerHTML=html||'<div class="empty">No results.</div>';document.querySelectorAll('[data-course]').forEach(function(r){r.onclick=function(){openCourse(r.dataset.course)}});document.querySelectorAll('[data-personal]').forEach(function(r){r.onclick=function(){openPersonal(r.dataset.personal)}})}
function renderAll(){renderNotes();renderChapters();renderStudy();renderIndex();renderDash();renderSearch()}

document.querySelectorAll('.tab').forEach(function(t){t.onclick=function(){show(t.dataset.screen,t.dataset.title)}});
document.querySelectorAll('.folderTab').forEach(function(b){b.onclick=function(){folder=b.dataset.folder;document.querySelectorAll('.folderTab').forEach(function(x){x.classList.remove('active')});b.classList.add('active');renderNotes()}});
$('newNoteButton').onclick=createPersonal;$('newNoteTop').onclick=createPersonal;$('backToNotes').onclick=function(){autosave();show('notesScreen','Notes')};$('doneNote').onclick=function(){autosave();show('notesScreen','Notes')};$('deleteNote').onclick=deletePersonal;$('noteTitle').oninput=scheduleAutosave;$('noteBody').oninput=scheduleAutosave;
$('backFromCourseNote').onclick=function(){show('notesScreen','Notes')};$('notesSearch').oninput=renderNotes;$('chapterSearch').oninput=renderChapters;$('backToChapters').onclick=function(){show('chaptersScreen','Chapters')};
$('studyChapter').onclick=function(){var ch=state.chapters.find(function(x){return x.id===currentChapter});begin(ch.cards.map(function(c){return {chapterId:ch.id,chapterTitle:ch.title,card:c}}))};$('viewChapterIndex').onclick=function(){$('indexChapterFilter').value=currentChapter;show('indexScreen','Flashcard Index')};
$('flashcard').onclick=function(){flipped=!flipped;renderStudy()};$('nextCard').onclick=next;$('prevCard').onclick=prev;$('knowIt').onclick=function(){update({known:true,practice:false});next();renderAll()};$('needPractice').onclick=function(){update({known:false,practice:true});next();renderAll()};$('favoriteCard').onclick=function(){update({favorite:!study[idx].card.favorite});renderStudy()};
$('indexSearch').oninput=renderIndex;$('indexChapterFilter').onchange=renderIndex;$('studyAll').onclick=function(){begin(allCards())};$('studyPractice').onclick=function(){begin(allCards().filter(function(i){return i.card.practice}))};$('studyFavorites').onclick=function(){begin(allCards().filter(function(i){return i.card.favorite}))};$('globalSearch').oninput=renderSearch;
window.addEventListener('beforeunload',autosave);
renderAll();
})();

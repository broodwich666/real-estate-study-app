(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const escM = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const miles = (a,b) => {
    const R=3958.8,toRad=x=>x*Math.PI/180;
    const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lng-a.lng);
    const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(q));
  };
  const mapperDefaults = {mapPins:[],mapRoutes:[],mapRouteDraft:[],mapTrips:[],mapVisits:[],mapSettings:{radius:10,alerts:true}};
  Object.entries(mapperDefaults).forEach(([k,v])=>{ if (!Array.isArray(v) && typeof v==='object') state[k]={...v,...(state[k]||{})}; else if (!Array.isArray(state[k])) state[k]=Array.isArray(v)?[...v]:v; });
  let map=null,markers=new Map(),userMarker=null,territoryLayer=null,currentLocation=null,editingId=null,selectedId=null;


  function importInventoryPins(records){
    let added=0,updated=0;
    (records||[]).forEach(r=>{
      let pin=state.mapPins.find(p=>p.inventoryId===r.inventoryId || (p.address||'').toLowerCase()===(r.address||'').toLowerCase());
      if(pin){Object.assign(pin,r);updated++;}
      else{state.mapPins.push({...r,id:'inventory-'+(r.inventoryId||Date.now()+'-'+added),lat:null,lng:null,createdAt:new Date().toISOString()});added++;}
    });
    save();renderMapper();geocodeMissingInventory();
    return {added,updated};
  }
  async function geocodeMissingInventory(){
    const pending=state.mapPins.filter(p=>p.address&&(!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng)))).slice(0,18);
    if(!pending.length)return;
    const status=$('#mapperPinCount');
    for(let i=0;i<pending.length;i++){
      const p=pending[i];
      try{
        if(status)status.textContent=`Geocoding ${i+1}/${pending.length}`;
        const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(p.address)}`,{headers:{'Accept':'application/json'}});
        const d=await r.json();
        if(d&&d[0]){p.lat=Number(d[0].lat);p.lng=Number(d[0].lon);p.geocodedAt=new Date().toISOString();save();renderMarkers();}
      }catch(e){}
      await new Promise(res=>setTimeout(res,1100));
    }
    renderMapper();
  }

  function normalizeLegacyProperties(){
    if (!Array.isArray(state.properties)) return;
    state.properties.forEach((p,i)=>{
      if (state.mapPins.some(x=>x.sourcePropertyIndex===i)) return;
      if (!p.lat || !p.lng) return;
      state.mapPins.push({id:'prop-'+i,title:p.name||'Property',address:p.detail||'',lat:Number(p.lat),lng:Number(p.lng),type:p.type||'Residential Sale',status:'active',client:'',appointment:'',notes:p.notes||'',sourcePropertyIndex:i,createdAt:new Date().toISOString()});
    });
  }

  function ensureMap(){
    if (map || !$('#reflashMap')) return;
    if (!window.L) { $('#mapperMapFallback').hidden=false; return; }
    map=L.map('reflashMap',{zoomControl:true}).setView([40.7128,-74.006],10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    map.on('click', e=>openPinForm(null,e.latlng));
    setTimeout(()=>map.invalidateSize(),150);
  }

  function iconFor(pin){
    const color={Rental:'#5f6fff','Residential Sale':'#2fa36b',Lead:'#e28a28',Client:'#8b5cf6','Open House':'#e24a68',Other:'#68717f'}[pin.type]||'#68717f';
    return L.divIcon({className:'',html:`<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 8px #0006"></div>`,iconSize:[18,18],iconAnchor:[9,9]});
  }

  function renderMarkers(){
    ensureMap(); if (!map) return;
    markers.forEach(m=>m.remove()); markers.clear();
    const pins=filteredPins();
    const groups=new Map();
    pins.forEach(p=>{
      const key=`${Number(p.lat).toFixed(4)},${Number(p.lng).toFixed(4)}`;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
    });
    groups.forEach(group=>{
      const p=group[0]; if(!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng)))return;
      const m=L.marker([p.lat,p.lng],{icon:iconFor(p)}).addTo(map);
      const title=group.length>1?`${group.length} locations here`:p.title;
      m.bindPopup(`<strong>${escM(title)}</strong><br>${escM(p.address||'No address')}<br><button onclick="window.reflashMapperSelect('${escM(p.id)}')">Open details</button>`);
      m.on('click',()=>selectPin(p.id)); markers.set(p.id,m);
    });
  }

  function filteredPins(){
    const q=($('#mapperSearch')?.value||'').toLowerCase(),type=$('#mapperFilter')?.value||'all',status=$('#mapperStatus')?.value||'all',radius=Number($('#mapperRadius')?.value||10);
    return state.mapPins.filter(p=>{
      const text=[p.title,p.address,p.client,p.notes,p.type,p.status].join(' ').toLowerCase();
      if(q&&!text.includes(q))return false;if(type!=='all'&&p.type!==type)return false;if(status!=='all'&&p.status!==status)return false;
      if(currentLocation&&radius>0&&miles(currentLocation,p)>radius)return false;
      return true;
    });
  }

  function renderList(){
    const pins=filteredPins(); $('#mapperPinCount').textContent=pins.length;
    $('#mapperLocationList').innerHTML=pins.length?pins.map(p=>`<div class="mapper-location ${selectedId===p.id?'active':''}" data-map-id="${escM(p.id)}"><div class="mapper-location-top"><h4>${escM(p.title)}</h4><span>${Number.isFinite(Number(p.lat))?'📍':'○'}</span></div><p>${escM(p.address||'No address')}</p><div class="mapper-badges"><span class="mapper-badge">${escM(p.type)}</span><span class="mapper-badge">${escM(p.status)}</span>${p.asking?`<span class="mapper-badge">${escM(p.asking)}</span>`:''}${p.client?`<span class="mapper-badge">${escM(p.client)}</span>`:''}</div><div class="mapper-location-actions"><button data-map-select="${escM(p.id)}">View details</button><button data-map-visit="${escM(p.id)}">Mark visited</button><button data-map-edit="${escM(p.id)}">Edit</button><button data-map-delete="${escM(p.id)}">Delete</button></div></div>`).join(''):'<div class="mapper-empty">No matching inventory. Add a property pin or widen the radius.</div>';
    $$('[data-map-select]').forEach(b=>b.onclick=()=>selectPin(b.dataset.mapSelect));
    $$('[data-map-visit]').forEach(b=>b.onclick=()=>checkIn(b.dataset.mapVisit));
    $$('[data-map-edit]').forEach(b=>b.onclick=()=>openPinForm(b.dataset.mapEdit));
    $$('[data-map-delete]').forEach(b=>b.onclick=()=>deletePin(b.dataset.mapDelete));
  }

  function selectPin(id){
    selectedId=id;const p=state.mapPins.find(x=>x.id===id);if(!p)return;
    if(map&&Number.isFinite(Number(p.lat))){map.setView([p.lat,p.lng],15);const m=markers.get(id);if(m)m.openPopup();}
    renderList();
    renderPropertyDetail(p);
  }

  function renderPropertyDetail(p){
    const box=$('#mapperPropertyDetail'); if(!box)return;
    if(!p){box.innerHTML='<div class="mapper-empty">Select a property to view its details.</div>';return;}
    const field=(label,value)=>value?`<div class="mapper-detail-row"><span>${escM(label)}</span><strong>${escM(value)}</strong></div>`:'';
    box.innerHTML=`<div class="panel-head"><div><p class="eyebrow">PROPERTY RECORD</p><h3>${escM(p.title)}</h3></div><span class="mapper-badge">${escM(p.status||'active')}</span></div>
      <p class="mapper-detail-address">${escM(p.address||'No address')}</p>
      <div class="mapper-detail-grid">${field('Availability',p.availability||p.dealType||p.type)}${field('Asking terms',p.asking||p.price||p.rent)}${field('Property type',p.propertyType||p.type)}${field('Available space',p.space||p.squareFeet)}${field('Owner / entity',p.owner||p.ownerEntity)}${field('Management company',p.management||p.managementCompany)}${field('Listing broker',p.broker||p.listingBroker)}${field('Client / contact',p.client)}</div>
      <div class="mapper-detail-notes"><strong>Notes</strong><p>${escM(p.notes||'No notes yet.')}</p></div>
      <div class="mapper-location-actions"><button class="primary" data-detail-edit="${escM(p.id)}">Edit property</button><button data-detail-visit="${escM(p.id)}">Mark visited</button></div>`;
    const e=box.querySelector('[data-detail-edit]'); if(e)e.onclick=()=>openPinForm(e.dataset.detailEdit);
    const v=box.querySelector('[data-detail-visit]'); if(v)v.onclick=()=>checkIn(v.dataset.detailVisit);
  }
  window.reflashMapperSelect=selectPin;

  function openPinForm(id=null,latlng=null){
    editingId=id;const form=$('#mapperPinForm');form.reset();
    const p=id?state.mapPins.find(x=>x.id===id):null;
    $('#mapperPinTitle').textContent=p?'Edit map location':'Add map location';
    if(p) Object.entries(p).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v??''});
    if(latlng){form.elements.lat.value=latlng.lat.toFixed(6);form.elements.lng.value=latlng.lng.toFixed(6);}
    $('#mapperPinDialog').showModal();
  }

  async function geocodeAddress(){
    const form=$('#mapperPinForm'),address=form.elements.address.value.trim();if(!address){alert('Enter an address first.');return;}
    $('#mapperGeocode').textContent='Finding…';
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,{headers:{'Accept':'application/json'}});
      const d=await r.json();if(!d[0])throw new Error('Address not found. Try adding city, state, and ZIP.');
      form.elements.lat.value=Number(d[0].lat).toFixed(6);form.elements.lng.value=Number(d[0].lon).toFixed(6);
    }catch(e){alert(e.message||String(e));}finally{$('#mapperGeocode').textContent='Find coordinates from address';}
  }

  function savePin(e){
    e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.lat=Number(d.lat);d.lng=Number(d.lng);
    if(!Number.isFinite(d.lat)||!Number.isFinite(d.lng)){alert('Add valid coordinates or use Find coordinates from address.');return;}
    if(editingId){const i=state.mapPins.findIndex(x=>x.id===editingId);state.mapPins[i]={...state.mapPins[i],...d,updatedAt:new Date().toISOString()};}
    else state.mapPins.push({...d,id:'pin-'+Date.now(),createdAt:new Date().toISOString()});
    save();$('#mapperPinDialog').close();renderMapper();
  }

  function deletePin(id){if(!confirm('Delete this map location?'))return;state.mapPins=state.mapPins.filter(x=>x.id!==id);state.mapRouteDraft=state.mapRouteDraft.filter(x=>x!==id);save();renderMapper();}
  function addToRoute(id){if(!state.mapRouteDraft.includes(id))state.mapRouteDraft.push(id);save();renderRoute();}
  function removeFromRoute(id){state.mapRouteDraft=state.mapRouteDraft.filter(x=>x!==id);save();renderRoute();}
  function routePins(){return state.mapRouteDraft.map(id=>state.mapPins.find(p=>p.id===id)).filter(Boolean);}

  function optimizeRoute(){
    let pts=routePins();if(pts.length<2){alert('Add at least two locations to the route.');return;}
    const start=currentLocation||pts.shift();const remaining=[...pts],ordered=[];let cur=start;
    while(remaining.length){remaining.sort((a,b)=>miles(cur,a)-miles(cur,b));const n=remaining.shift();ordered.push(n);cur=n;}
    if(!currentLocation)ordered.unshift(start);state.mapRouteDraft=ordered.map(x=>x.id);save();renderRoute();fitRoute();
  }

  function renderRoute(){
    const pts=routePins();
    $('#mapperRouteList').innerHTML=pts.length?pts.map((p,i)=>`<div class="mapper-route-stop" draggable="true" data-route-id="${escM(p.id)}"><div class="mapper-route-top"><strong>${i+1}. ${escM(p.title)}</strong><span>☰</span></div><small>${escM(p.address||'')}</small><div class="mapper-route-actions"><button data-route-up="${escM(p.id)}">↑</button><button data-route-down="${escM(p.id)}">↓</button><button data-route-remove="${escM(p.id)}">Remove</button></div></div>`).join(''):'<div class="mapper-empty">Add properties to build a showing route.</div>';
    let dist=0,prev=currentLocation;pts.forEach(p=>{if(prev)dist+=miles(prev,p);prev=p;});const mins=Math.round(dist/22*60);
    $('#mapperRouteSummary').innerHTML=pts.length?`<strong>${pts.length} stops</strong><br>Estimated ${dist.toFixed(1)} miles · ${mins} minutes driving`:'No active route';
    $$('[data-route-remove]').forEach(b=>b.onclick=()=>removeFromRoute(b.dataset.routeRemove));
    $$('[data-route-up]').forEach(b=>b.onclick=()=>moveRoute(b.dataset.routeUp,-1));$$('[data-route-down]').forEach(b=>b.onclick=()=>moveRoute(b.dataset.routeDown,1));
    setupDrag();
  }
  function moveRoute(id,delta){const i=state.mapRouteDraft.indexOf(id),j=i+delta;if(i<0||j<0||j>=state.mapRouteDraft.length)return;[state.mapRouteDraft[i],state.mapRouteDraft[j]]=[state.mapRouteDraft[j],state.mapRouteDraft[i]];save();renderRoute();}
  function setupDrag(){let dragging=null;$$('.mapper-route-stop').forEach(el=>{el.ondragstart=()=>{dragging=el.dataset.routeId;el.classList.add('dragging')};el.ondragend=()=>el.classList.remove('dragging');el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();const target=el.dataset.routeId;if(dragging===target)return;const a=state.mapRouteDraft.indexOf(dragging),b=state.mapRouteDraft.indexOf(target);state.mapRouteDraft.splice(a,1);state.mapRouteDraft.splice(b,0,dragging);save();renderRoute();}})}

  function fitRoute(){if(!map)return;const pts=routePins();if(!pts.length)return;const line=pts.map(p=>[p.lat,p.lng]);if(currentLocation)line.unshift([currentLocation.lat,currentLocation.lng]);map.fitBounds(line,{padding:[35,35]});}
  function openNavigation(){const pts=routePins();if(!pts.length){alert('Add stops first.');return;}const origin=currentLocation?`${currentLocation.lat},${currentLocation.lng}`:'';const dest=pts[pts.length-1];const waypoints=pts.slice(0,-1).map(p=>`${p.lat},${p.lng}`).join('|');const url=`https://www.google.com/maps/dir/?api=1${origin?`&origin=${encodeURIComponent(origin)}`:''}&destination=${encodeURIComponent(dest.lat+','+dest.lng)}${waypoints?`&waypoints=${encodeURIComponent(waypoints)}`:''}&travelmode=driving`;window.open(url,'_blank');}
  function saveRoute(){const pts=routePins();if(!pts.length){alert('Build a route first.');return;}const name=prompt('Route name',`Showing Route ${new Date().toLocaleDateString()}`);if(!name)return;state.mapRoutes.push({id:'route-'+Date.now(),name,pinIds:[...state.mapRouteDraft],createdAt:new Date().toISOString()});save();alert('Route saved and included in cloud sync.');}
  function logTrip(){const pts=routePins();if(!pts.length){alert('Build a route first.');return;}let dist=0,prev=currentLocation;pts.forEach(p=>{if(prev)dist+=miles(prev,p);prev=p;});const actual=prompt('Mileage for this trip',dist.toFixed(1));if(actual===null)return;state.mapTrips.push({id:'trip-'+Date.now(),date:new Date().toISOString(),miles:Number(actual)||0,stops:pts.map(p=>p.title),routeIds:pts.map(p=>p.id)});save();renderActivity();alert('Mileage saved.');}
  function checkIn(id){const p=state.mapPins.find(x=>x.id===id);if(!p)return;state.mapVisits.push({id:'visit-'+Date.now(),pinId:id,title:p.title,date:new Date().toISOString(),location:currentLocation||null,notes:''});p.status='visited';save();renderMapper();alert(`Checked in at ${p.title}.`);}

  function locate(){
    if(!navigator.geolocation){alert('Location is not available in this browser.');return;}
    $('#mapperLocate').textContent='Locating…';navigator.geolocation.getCurrentPosition(pos=>{
      currentLocation={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};state.mapSettings.lastLocation={...currentLocation,at:new Date().toISOString()};save();ensureMap();if(map){if(userMarker)userMarker.remove();userMarker=L.circleMarker([currentLocation.lat,currentLocation.lng],{radius:8,color:'#1473e6',fillColor:'#1473e6',fillOpacity:.8}).addTo(map).bindPopup('Your current location');map.setView([currentLocation.lat,currentLocation.lng],13);}$('#mapperLocate').textContent='◎ Location Active';renderMapper();nearbyAlert();
    },err=>{alert(err.message||'Could not access location.');$('#mapperLocate').textContent='◎ Use My Location';},{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
  }
  function nearbyAlert(){if(!state.mapSettings.alerts||!currentLocation)return;const near=state.mapPins.filter(p=>miles(currentLocation,p)<0.2&&p.status==='active');if(near.length)alert(`You are near ${near[0].title}. Tap Check in to record the visit.`);}

  function renderActivity(){
    const rows=[...state.mapTrips].reverse();$('#mapperActivityBody').innerHTML=`<h3>Mileage</h3><p><strong>${rows.reduce((n,x)=>n+Number(x.miles||0),0).toFixed(1)} total miles</strong></p><table class="mapper-activity-table"><thead><tr><th>Date</th><th>Miles</th><th>Stops</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${new Date(x.date).toLocaleString()}</td><td>${Number(x.miles).toFixed(1)}</td><td>${escM((x.stops||[]).join(' → '))}</td></tr>`).join('')||'<tr><td colspan="3">No mileage logged.</td></tr>'}</tbody></table><h3>Visits</h3><table class="mapper-activity-table"><tbody>${[...state.mapVisits].reverse().map(x=>`<tr><td>${new Date(x.date).toLocaleString()}</td><td>${escM(x.title)}</td></tr>`).join('')||'<tr><td>No visits recorded.</td></tr>'}</tbody></table>`;
  }
  function exportMileage(){const rows=[['Date','Miles','Stops'],...state.mapTrips.map(x=>[x.date,x.miles,(x.stops||[]).join(' -> ')])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='reflash-mileage.csv';a.click();}
  function selectedPin(){return state.mapPins.find(x=>x.id===selectedId)||routePins()[0]||state.mapPins[0];}
  function nearbyComps(){const p=selectedPin();if(!p){alert('Select a property first.');return;}window.open(`https://www.google.com/search?q=${encodeURIComponent('recent sold comparable properties near '+(p.address||p.lat+','+p.lng))}`,'_blank');}
  function amenities(){const p=selectedPin();if(!p){alert('Select a location first.');return;}window.open(`https://www.google.com/maps/search/schools+parks+transit+near+${encodeURIComponent(p.lat+','+p.lng)}`,'_blank');}
  function territory(){if(!map){return;}if(territoryLayer){territoryLayer.remove();territoryLayer=null;return;}const center=currentLocation||selectedPin();if(!center){alert('Use your location or select a pin first.');return;}territoryLayer=L.circle([center.lat,center.lng],{radius:Number($('#mapperRadius').value||10)*1609.344,color:'#8b5cf6',fillOpacity:.08}).addTo(map);map.fitBounds(territoryLayer.getBounds());}

  function renderMapper(){normalizeLegacyProperties();renderList();renderMarkers();renderPropertyDetail(state.mapPins.find(x=>x.id===selectedId));if(map)setTimeout(()=>map.invalidateSize(),50);}
  function bind(){
    $('#mapperImportInventory').onclick=()=>{const raw=localStorage.getItem('reflash_ny_inventory_v1');const records=raw?JSON.parse(raw):[];const mapped=records.map(x=>({inventoryId:x.id,title:x.address,address:x.address,type:x.deal==='For Lease'?'Rental':'Residential Sale',status:'active',availability:x.deal,asking:x.price,propertyType:x.type,space:x.space,owner:x.owner,management:x.management,broker:x.broker,sourceUrl:x.sourceUrl,notes:x.notes||''}));const r=importInventoryPins(mapped);alert(`${r.added} inventory pins added, ${r.updated} refreshed.`);};$('#mapperLocate').onclick=locate;$('#mapperAddPin').onclick=()=>openPinForm();
    $('#mapperSearch').oninput=renderMapper;$('#mapperFilter').onchange=renderMapper;$('#mapperStatus').onchange=renderMapper;$('#mapperRadius').onchange=()=>{state.mapSettings.radius=Number($('#mapperRadius').value||10);save();renderMapper()};
    $('#mapperPinClose').onclick=()=>$('#mapperPinDialog').close();$('#mapperPinForm').onsubmit=savePin;$('#mapperGeocode').onclick=geocodeAddress;$('#mapperNearbyComps').onclick=nearbyComps;$('#mapperAmenities').onclick=amenities;$('#mapperTerritory').onclick=territory;
    const mapperNav=document.querySelector('[data-view="mapper"]');if(mapperNav)mapperNav.addEventListener('click',()=>setTimeout(renderMapper,80));
    $('#mapperRadius').value=state.mapSettings.radius||10;
  }
  window.addEventListener('reflash:inventory-map',e=>importInventoryPins(e.detail));window.addEventListener('DOMContentLoaded',()=>{bind();normalizeLegacyProperties();save();setTimeout(()=>{if(document.querySelector('#mapper.view.active'))geocodeMissingInventory();},1200);});
})();

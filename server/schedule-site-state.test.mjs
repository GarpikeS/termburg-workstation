import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { startScheduleService } from './schedule-service.mjs';
import { importSiteSchedule, sameSiteEvents } from './schedule-site-state.mjs';
import { recoverHolidayEvents, recoverWorkstationSchedule } from '../workstation/schedule-recovery.mjs';
import { buildWordPressSchedulePayload } from './wordpress-schedule.mjs';
const approved = JSON.parse(await readFile(new URL('../workstation/holiday-recovery-20261017.json',import.meta.url)));
const fixture = () => ({ schemaVersion:1,revision:1,updatedAt:'2026-10-16',locations:[{id:'1',timezone:'Europe/Moscow'},{id:'2',timezone:'Asia/Krasnoyarsk'}],weeklyEvents:[
  ...approved.filter(e=>e.date==='2026-10-17').map(e=>({id:e.replacesEventId,locationId:'2',daysOfWeek:[1,2,3,4,5,6,7],time:e.time,title:'Обычное парение',venue:'Парная',priceKind:'paid',price:390,published:true})),
  {id:'moscow',locationId:'1',daysOfWeek:[1,2,3,4,5,6,7],time:'11:00',title:'Москва',venue:'Парная',priceKind:'free',published:true}],exceptions:[],monthlyPosters:[] });

test('holiday recovery restores 20 dated free events, keeps custom replacements and ordinary data, and runs once', async () => {
  const original=fixture(), recovered=recoverHolidayEvents(original,approved);
  assert.equal(recovered.added,20);assert.deepEqual(recovered.schedule.weeklyEvents,original.weeklyEvents);
  recovered.schedule.exceptions[0].title='Правка сотрудника';
  assert.equal(recoverHolidayEvents(recovered.schedule,approved).schedule.exceptions[0].title,'Правка сотрудника');
  const root=await mkdtemp(path.join(os.tmpdir(),'tb-recovery-test-'));
  try {
    await writeFile(path.join(root,'schedule.json'),JSON.stringify(original));
    await writeFile(path.join(root,'site-sync.json'),JSON.stringify({locations:{'2':{endpoint:'https://fixture.invalid/schedule/import',complexCode:'zelenogorsk'}}}));
    const options={userData:root,fetchImpl:async()=>{throw Error('offline fixture');},logger:{info(){},warn(){}}};
    await recoverWorkstationSchedule(options);
    let saved=JSON.parse(await readFile(path.join(root,'schedule.json')));assert.equal(saved.exceptions.length,20);
    saved.exceptions=[];await writeFile(path.join(root,'schedule.json'),JSON.stringify(saved));
    await recoverWorkstationSchedule(options);
    assert.equal(JSON.parse(await readFile(path.join(root,'schedule.json'))).exceptions.length,0,'explicit later resets must not be resurrected');
  } finally {await rm(root,{recursive:true,force:true});}
});

test('site loading preserves Moscow, posters and private drafts, while linking overrides to local IDs', () => {
  const before=fixture(); before.monthlyPosters=[{id:'poster',locationId:'2'}];
  before.weeklyEvents.push({...before.weeklyEvents[0],id:'private',published:false});
  const id=approved[0].replacesEventId.replace(/^official-2-/,'');
  const state={events:[{id,title:'С сайта',time:'11:00',weekdays:['Суббота','Воскресенье'],location:'Парная',isFree:true},{id:'special',date:'2026-10-17',replacesEventId:id,title:'Праздник',time:'11:00',location:'Парная',isFree:true}]};
  const next=importSiteSchedule(before,'2',state);
  assert.equal(next.exceptions[0].replacesEventId,approved[0].replacesEventId);
  assert.deepEqual(next.weeklyEvents.find(e=>e.id==='moscow'),before.weeklyEvents.find(e=>e.id==='moscow'));
  assert(next.weeklyEvents.some(e=>e.id==='private'&&!e.published));assert.deepEqual(next.monthlyPosters,before.monthlyPosters);
});

test('first launch loads the recovered current publication and retains account connections and Moscow', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'tb-recovery-online-'));
  try {
    const before=fixture(), bytes=JSON.stringify(before);
    const restored=recoverHolidayEvents(before,approved).schedule;
    restored.weeklyEvents.find(e=>e.locationId==='2').title='Свежая правка сотрудника';
    const events=buildWordPressSchedulePayload(restored,'2');
    const state={protocol:1,site:'zelenogorsk',revision:'d'.repeat(64),count:events.length,events};
    await writeFile(path.join(root,'schedule.json'),bytes);
    await writeFile(path.join(root,'site-sync.json'),JSON.stringify({locations:{'1':{token:'moscow-fixture'},'2':{endpoint:'https://fixture.invalid/schedule/import',complexCode:'zelenogorsk',token:'green-fixture'}}}));
    await recoverWorkstationSchedule({userData:root,logger:{info(){},warn(){}},fetchImpl:async()=>({ok:true,json:async()=>state})});
    const after=JSON.parse(await readFile(path.join(root,'schedule.json')));
    assert.equal(after.exceptions.filter(e=>e.replacesEventId).length,20);
    assert.equal(after.weeklyEvents.find(e=>e.locationId==='2').title,'Свежая правка сотрудника');
    assert.deepEqual(after.weeklyEvents.filter(e=>e.locationId==='1'),before.weeklyEvents.filter(e=>e.locationId==='1'));
    const settings=JSON.parse(await readFile(path.join(root,'site-sync.json')));
    assert.equal(settings.locations['2'].lastRemoteRevision,state.revision);
    assert.equal(settings.locations['1'].token,'moscow-fixture');assert.equal(settings.locations['2'].token,'green-fixture');
  } finally {await rm(root,{recursive:true,force:true});}
});

test('loading, publishing and concurrent stale saves enforce baseline and preserve data after rejection', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'tb-site-state-'));let service,remote;
  const firstId=approved[0].replacesEventId.replace(/^official-2-/,'');
  const state={protocol:1,site:'zelenogorsk',revision:'a'.repeat(64),count:1,events:[{id:firstId,title:'С сайта',time:'11:00',weekdays:['Суббота','Воскресенье'],location:'Парная',isFree:true}]};
  let writes=0;
  try {
    remote=createServer(async(req,res)=>{
      if(req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(state));return;}
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      if(req.headers['if-match']!==`"${state.revision}"`){res.writeHead(409,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'stale fixture'}));return;}
      writes++;state.events=JSON.parse(Buffer.concat(chunks));state.count=state.events.length;state.revision='b'.repeat(64);
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,site:state.site,count:state.count,revision:state.revision,updatedAt:new Date().toISOString()}));
    });
    await new Promise(resolve=>remote.listen(0,'127.0.0.1',resolve));
    const dataFile=path.join(root,'schedule.json'),settingsFile=path.join(root,'site-sync.json');
    await writeFile(dataFile,JSON.stringify(fixture()));
    await writeFile(settingsFile,JSON.stringify({locations:{'2':{endpoint:`http://127.0.0.1:${remote.address().port}/schedule/import`,complexCode:'zelenogorsk',token:'fixture-only-token',authMode:'bearer'}}}));
    service=await startScheduleService({staticRoot:root,dataFile,siteSyncFile:settingsFile,seedFile:dataFile,host:'127.0.0.1',port:0,localWritesOnly:true,logger:{info(){},error(){}}});
    const origin=`http://127.0.0.1:${service.port}`;
    const post=(route,body)=>fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await post('/api/site-sync/publish',{locationId:'2'})).status,400);assert.equal(writes,0);
    const loaded=await post('/api/site-sync/load',{locationId:'2',baseRevision:1});assert.equal(loaded.status,200);const data=await loaded.json();
    assert.equal(data.weeklyEvents.find(e=>e.locationId==='2').title,'С сайта');
    const put=body=>fetch(origin+'/api/schedule',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const draft={...data,baseRevision:data.revision,revision:data.revision+1};draft.weeklyEvents.find(e=>e.locationId==='2').title='Правка';
    const parallel=await Promise.all([put(draft),put(draft)]);assert.deepEqual(parallel.map(r=>r.status).sort(),[200,409]);
    const publish=await post('/api/site-sync/publish',{locationId:'2'});assert.equal(publish.status,200);assert.equal(writes,1);
    assert.equal(JSON.parse(await readFile(settingsFile)).locations['2'].lastRemoteRevision,state.revision);
    state.revision='c'.repeat(64);
    const currentBytes=await readFile(dataFile,'utf8');
    assert.equal((await post('/api/site-sync/publish',{locationId:'2'})).status,502);assert.equal(writes,1);
    assert.equal(await readFile(dataFile,'utf8'),currentBytes);
  } finally {await service?.close();if(remote)await new Promise(resolve=>remote.close(resolve));await rm(root,{recursive:true,force:true});}
});

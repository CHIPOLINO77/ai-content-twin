const API="/api";const state={file:null,objectUrl:null,duration:0,ratio:"9:16",clips:[],projects:JSON.parse(localStorage.getItem("CT_PROJECTS")||"[]")};const $=id=>document.getElementById(id);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const size=n=>{if(!n)return"—";const u=["B","KB","MB","GB"];let i=0;while(n>1024&&i<3){n/=1024;i++}return n.toFixed(i?1:0)+" "+u[i]};const tm=s=>{s=Math.max(0,Number(s)||0);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(Math.floor(s%60)).padStart(2,"0")};function steps(n){document.querySelectorAll(".step").forEach((x,i)=>x.classList.toggle("active",i<n))}function save(){localStorage.setItem("CT_PROJECTS",JSON.stringify(state.projects))}function view(v){document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));$("view-"+v)?.classList.add("active");$("results").classList.add("hidden");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v))}function setFile(f){if(!f?.type.startsWith("video/"))return;state.file=f;if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=URL.createObjectURL(f);$("dropzone").classList.add("hidden");$("sourceCard").classList.remove("hidden");$("sourceVideo").src=state.objectUrl;$("sourceName").textContent=f.name;$("sourceSize").textContent=size(f.size);$("sourceVideo").onloadedmetadata=()=>{state.duration=$("sourceVideo").duration;$("sourceDuration").textContent=tm(state.duration);$("startAnalysis").disabled=false};steps(1)}$("chooseFile").onclick=()=>$("fileInput").click();$("fileInput").onchange=e=>setFile(e.target.files[0]);$("dropzone").ondragover=e=>{e.preventDefault();$("dropzone").classList.add("drag")};$("dropzone").ondragleave=()=>$("dropzone").classList.remove("drag");$("dropzone").ondrop=e=>{e.preventDefault();$("dropzone").classList.remove("drag");setFile(e.dataTransfer.files[0])};$("removeSource").onclick=()=>{state.file=null;if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);$("sourceVideo").src="";$("sourceCard").classList.add("hidden");$("dropzone").classList.remove("hidden");$("startAnalysis").disabled=true;steps(0)};document.querySelectorAll(".choice").forEach(b=>b.onclick=()=>{document.querySelectorAll(".choice").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.ratio=b.dataset.ratio});document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{view(b.dataset.view);if(b.dataset.view==="projects")renderProjects()});$("newProject").onclick=()=>{view("create");$("removeSource").click()};$("backCreate").onclick=()=>{view("create");$("results").classList.add("hidden")};$("settingsBtn").onclick=()=>{$("settingsModal").classList.remove("hidden")};$("closeSettings").onclick=$("closeSettings2").onclick=()=>$("settingsModal").classList.add("hidden");async function analyze(){const t=$("transcript").value.trim();if(!state.file)return;if(!t){alert("Сначала запусти автоматическую расшифровку или вставь готовый текст.");return}const b=$("startAnalysis");b.disabled=true;b.innerHTML="<span>◌</span> AI анализирует…";$("engineState").textContent="WORKING";steps(2);try{const r=await fetch(API+"/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transcript:t,duration:state.duration,max_clips:Number($("clipCount").value),min_duration:Number($("minLength").value),language:"ru"})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||d.detail||("HTTP "+r.status));state.clips=(d.clips||[]).filter(x=>Number(x.end)>Number(x.start));renderResults();steps(3);$("engineState").textContent="READY"}catch(e){$("engineState").textContent="ERROR";steps(1);alert("Ошибка анализа: "+e.message)}finally{b.disabled=false;b.innerHTML="<span>✦</span> Найти лучшие моменты"}}$("startAnalysis").onclick=analyze;function renderResults(){$("view-create").classList.remove("active");$("results").classList.remove("hidden");$("resultVideo").src=state.objectUrl;$("resultSummary").textContent=state.clips.length+" кандидатов · "+tm(state.duration)+" исходник · "+state.ratio;const tl=$("timeline");tl.innerHTML=state.clips.map(c=>'<i style="left:'+(Number(c.start)/state.duration*100||0)+'%;width:'+((Number(c.end)-Number(c.start))/state.duration*100||1)+'%"></i>').join("");$("clipResults").innerHTML=state.clips.length?state.clips.map((c,i)=>'<article class="clip-card"><div class="clip-rank">'+String(i+1).padStart(2,"0")+'</div><div><div class="clip-top"><b>'+esc(c.title||"Сильный момент")+'</b><strong class="score">'+esc(c.score||0)+'</strong></div><div class="clip-time">'+tm(c.start)+" — "+tm(c.end)+" · "+tm(c.end-c.start)+'</div><p>'+esc(c.reason||"AI выбрал этот фрагмент как самостоятельный короткий ролик.")+'</p><div class="clip-meta"><span>HOOK · '+esc(c.hook||"—")+'</span><span>CAPTION · '+esc(c.caption||"—")+'</span></div><button class="ghost" data-export="'+i+'">Скачать фрагмент</button></div></article>').join(""):'<div class="clip-empty"><b>Ничего не найдено</b>Попробуй другую расшифровку.</div>';$("clipResults").querySelectorAll("[data-export]").forEach(b=>b.onclick=()=>exportClip(state.clips[Number(b.dataset.export)]));state.projects.unshift({name:state.file.name,created:new Date().toLocaleString("ru-RU"),count:state.clips.length,duration:state.duration});state.projects=state.projects.slice(0,20);save();$("projectCount").textContent=state.projects.length}async function exportClip(c){
 const v=document.createElement("video");v.src=state.objectUrl;v.preload="auto";v.playsInline=true;
 await new Promise((a,b)=>{v.onloadedmetadata=a;v.onerror=b});
 const start=Math.max(0,Number(c.start)),end=Math.min(v.duration,Number(c.end));if(end<=start)return;
 const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1920;const ctx=canvas.getContext("2d");
 const canvasStream=canvas.captureStream(30),sourceStream=v.captureStream?.();if(!sourceStream){alert("Браузер не поддерживает экспорт этого формата.");return}
 const audio=sourceStream.getAudioTracks()[0];if(audio)canvasStream.addTrack(audio);
 const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")?"video/webm;codecs=vp9,opus":"video/webm",parts=[],rec=new MediaRecorder(canvasStream,{mimeType:mime,videoBitsPerSecond:6000000});rec.ondataavailable=e=>e.data.size&&parts.push(e.data);
 const draw=()=>{if(v.paused&&v.currentTime<end)return;const vw=v.videoWidth,vh=v.videoHeight,target=9/16,src=vw/vh;let sw=vw,sh=vh,sx=0,sy=0;if(src>target){sw=vh*target;sx=(vw-sw)/2}else{sh=vw/target;sy=(vh-sh)/2}ctx.fillStyle="#000";ctx.fillRect(0,0,1080,1920);ctx.drawImage(v,sx,sy,sw,sh,0,0,1080,1920);if(v.currentTime<end)requestAnimationFrame(draw)};
 await new Promise((a,b)=>{rec.onerror=b;rec.onstop=a;v.currentTime=start;v.onseeked=async()=>{try{rec.start(200);await v.play();draw();const loop=()=>v.currentTime>=end?(v.pause(),rec.stop()):requestAnimationFrame(loop);loop()}catch(e){b(e)}}});
 const url=URL.createObjectURL(new Blob(parts,{type:mime})),a=document.createElement("a");a.href=url;a.download="content-twin-vertical-"+tm(start).replace(":","-")+"-"+tm(end).replace(":","-")+".webm";a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)
}
function renderProjects(){const box=$("projectsList");$("projectCount").textContent=state.projects.length;box.innerHTML=state.projects.length?state.projects.map((p,i)=>'<div class="project"><div><b>'+esc(p.name)+'</b><small>'+esc(p.created)+" · "+p.count+" клипов · "+tm(p.duration)+'</small></div><button class="ghost" data-delete="'+i+'">Удалить</button></div>').join(""):'<div class="clip-empty"><b>Проектов пока нет</b>Загрузи первое видео и запусти анализ.</div>';box.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{state.projects.splice(Number(b.dataset.delete),1);save();renderProjects()})}$("projectCount").textContent=state.projects.length;


async function autoTranscribe(){
 if(!state.file){alert("Сначала загрузи видео.");return}
 const btn=$("transcribeBtn");btn.disabled=true;btn.textContent="◌ Расшифровываю…";
 $("transcribeHint").textContent="Подготавливаю аудио…";
 $("engineState").textContent="TRANSCRIBING";
 try{
  const v=document.createElement("video");v.src=state.objectUrl;v.muted=true;v.playsInline=true;v.preload="auto";
  await new Promise((a,b)=>{v.onloadedmetadata=a;v.onerror=()=>b(Error("Не удалось открыть видео."))});
  const stream=v.captureStream?.();const track=stream?.getAudioTracks?.()[0];
  if(!track)throw Error("В видео не найден аудиотрек.");
  const audioStream=new MediaStream([track]);
  const mime=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":"audio/webm";
  const recorder=new MediaRecorder(audioStream,{mimeType:mime});
  const pending=[]; let sent=0, completed=0, failed=false;
  const sendChunk=async blob=>{
    const buf=await blob.arrayBuffer();const bytes=new Uint8Array(buf);let bin="";
    for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    const b64=btoa(bin);
    const offset=sent; sent+=60;
    const r=await fetch(API+"/transcribe",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({audio:b64,mime,language:"ru",model:"openai/whisper-large-v3",offset})});
    const raw=await r.text();let d={};try{d=JSON.parse(raw)}catch{}
    if(!r.ok)throw Error(d.error||d.detail||("HTTP "+r.status));
    const text=d.text||"";
    if(text)$("transcript").value+=($("transcript").value?" ":"")+text;
    completed++;
    $("transcribeHint").textContent="Расшифровано примерно "+Math.min(state.duration,completed*60).toFixed(0)+" из "+state.duration.toFixed(0)+" сек.";
  };
  recorder.ondataavailable=e=>{if(e.data.size)pending.push(sendChunk(e.data).catch(err=>{failed=true;throw err}))};
  recorder.start(60000);
  await v.play();
  await new Promise(resolve=>{const tick=()=>v.ended?resolve():requestAnimationFrame(tick);tick()});
  try{recorder.stop()}catch{}
  await new Promise(resolve=>{const check=()=>recorder.state==="inactive"?resolve():setTimeout(check,100)});
  const results=await Promise.allSettled(pending);
  const bad=results.find(x=>x.status==="rejected");
  if(bad)throw bad.reason;
  if(failed)throw Error("Не удалось распознать один из аудиофрагментов.");
  $("transcribeHint").textContent="Расшифровка готова. Теперь можно запускать поиск лучших моментов.";
  $("engineState").textContent="READY";
 }catch(e){
  $("engineState").textContent="ERROR";
  $("transcribeHint").textContent="Ошибка транскрибации: "+e.message;
  alert("Не удалось расшифровать видео: "+e.message);
 }finally{btn.disabled=false;btn.textContent="✦ Расшифровать видео автоматически"}
}
$("transcribeBtn")?.addEventListener("click",autoTranscribe);

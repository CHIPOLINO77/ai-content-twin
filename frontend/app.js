const $=id=>document.getElementById(id);
const POLZA_URL="https://polza.ai/api/v1";
const POLZA_MEDIA_URL="https://polza.ai/api/v1/media";
const POLZA_KEY_STORAGE="CONTENT_TWIN_POLZA_KEY";
const POLZA_MODEL_STORAGE="CONTENT_TWIN_POLZA_MODEL";
const DEFAULT_MODEL="openai/gpt-6-astra";
const state={videos:[],profile:null,lastShort:null,generated:false,videoJob:null};
const logStore=[];
function addLog(message,type="INFO"){
  const now=new Date();const time=now.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  logStore.push({time,message,type});if(logStore.length>100)logStore.shift();
  const box=$("logWindow");if(!box)return;
  box.innerHTML=logStore.map(x=>'<div class="log-line '+(x.type==="ERROR"?"error":x.type==="OK"?"ok":"")+'"><span class="log-time">'+x.time+'</span><span class="log-type">'+x.type+'</span><span class="log-msg">'+esc(x.message)+'</span></div>').join("");
  box.scrollTop=box.scrollHeight;if($("logCount"))$("logCount").textContent=String(logStore.length);
}


function getProfileContext(){
  let transcript=$("sourceTranscript")?.value.trim()||"";
  if(!transcript) transcript=localStorage.getItem("CONTENT_TWIN_TRANSCRIPT")||"";
  return {profile:state.profile||{},sourceTranscript:transcript.slice(0,30000)};
}
function parseJson(text,fallback={}){
  try{return JSON.parse(text)}catch{}
  const obj=text.match(/\{[\s\S]*\}/)?.[0];
  if(obj)try{return JSON.parse(obj)}catch{}
  const arr=text.match(/\[[\s\S]*\]/)?.[0];
  if(arr)try{return JSON.parse(arr)}catch{}
  return fallback;
}

function getKey(){return localStorage.getItem(POLZA_KEY_STORAGE)||""}
function getModel(){return localStorage.getItem(POLZA_MODEL_STORAGE)||DEFAULT_MODEL}
function saveSettings(){
  const key=$("polzaKey")?.value.trim()||"";
  const model=$("polzaModel")?.value.trim()||DEFAULT_MODEL;
  if(key)localStorage.setItem(POLZA_KEY_STORAGE,key);else localStorage.removeItem(POLZA_KEY_STORAGE);
  localStorage.setItem(POLZA_MODEL_STORAGE,model);
  updateStatus();
  closeSettings();
}
function openSettings(){
  if(!$("settingsModal"))return;
  $("polzaKey").value=getKey();
  $("polzaModel").value=getModel();
  $("settingsModal").classList.remove("hidden");
}
function closeSettings(){$("settingsModal")?.classList.add("hidden")}
function updateStatus(){
  const ok=!!getKey();
  $("apiStatus").textContent=ok?"Polza AI готов":"Нужен API-ключ Polza";
}
async function polza(messages,temperature=.7){
  const key=getKey();
  if(!key)throw new Error("Добавь API-ключ Polza в настройках");
  const r=await fetch(POLZA_URL+"/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
    body:JSON.stringify({model:getModel(),messages,temperature})
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error?.message||data.detail||("Polza API: HTTP "+r.status));
  return data;
}
function showSection(name){
  document.querySelectorAll(".section").forEach(x=>x.classList.add("hidden"));
  const target=$(name==="ideas"?"ideasSection":name);
  if(target)target.classList.remove("hidden");
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.section===name));
}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>showSection(b.dataset.section));
$("settingsBtn")?.addEventListener("click",openSettings);
$("saveSettings")?.addEventListener("click",saveSettings);
$("closeSettings")?.addEventListener("click",closeSettings);$("closeSettingsTop")?.addEventListener("click",closeSettings);
$("settingsModal")?.addEventListener("click",e=>{if(e.target.id==="settingsModal")closeSettings()});

async function generateWithTwin(prompt,context={}){
  const profile=state.profile||{};
  return polza([
    {role:"system",content:"Ты AI Content Twin. Создавай оригинальный контент в стиле автора по аналитическому профилю, но не копируй дословно чужие тексты. Пиши практично и естественно. Профиль автора:\n"+JSON.stringify(profile)},
    {role:"user",content:prompt+"\n\nКонтекст продукта: "+JSON.stringify(context)}
  ],.8);
}

$("generate")?.addEventListener("click",async()=>{
  const topic=$("topic").value.trim();if(!topic)return;
  $("ideas").innerHTML="<p>Polza генерирует идеи…</p>";
  try{
    const d=await generateWithTwin(
      "Сгенерируй 10 идей для Shorts/Reels по теме: "+topic+
      ". Верни только JSON-массив объектов с полями title, hook, angle, payoff.",
      {platform:"shorts"}
    );
    const text=d.choices?.[0]?.message?.content||"[]";
    let list;try{list=JSON.parse(text.match(/\[[\s\S]*\]/)?.[0]||"[]")}catch{list=[]}
    $("ideas").innerHTML=list.length?list.map((x,i)=>`<div class="idea"><h3>${i+1}. ${esc(x.title||"Идея")}</h3><p><b>Hook:</b> ${esc(x.hook||"—")}</p><p>${esc(x.angle||"")}</p><span class="tag">${esc(x.payoff||"AI Content Twin")}</span></div>`).join(""):"<p>Модель вернула ответ не в JSON. Попробуй ещё раз.</p>";
  }catch(e){$("ideas").innerHTML="<p>Ошибка: "+esc(e.message)+"</p>"}
});

$("copyGenerated")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("generatedContent")?.textContent||"");$("copyGenerated").textContent="Скопировано ✓"}catch{}});
$("downloadGenerated")?.addEventListener("click",()=>{const text=$("generatedContent")?.textContent||"";if(!text||text==="Создаю…")return;const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));a.download="content-twin-output.txt";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});

$("generateContent")?.addEventListener("click",async()=>{
  const prompt=$("generatorPrompt")?.value.trim();if(!prompt)return;
  $("generatedContent").textContent="Создаю текст через AI…";
  $("generateContent").disabled=true;
  try{
    const d=await generateWithTwin(prompt,{product:"AI Content Twin",mode:"text-generation"});
    const content=d.choices?.[0]?.message?.content||JSON.stringify(d,null,2);
    $("generatedContent").textContent=content;
    localStorage.setItem("CONTENT_TWIN_GENERATED_TEXT",content);
    $("sendGeneratedToVideo")?.classList.remove("hidden");
    addLog("Текст сгенерирован. Готов к передаче в Kling.","OK");
  }catch(e){$("generatedContent").textContent="Ошибка: "+e.message;addLog(e.message,"ERROR")}
  finally{$("generateContent").disabled=false}
});
$("sendGeneratedToVideo")?.addEventListener("click",()=>{
  const content=$("generatedContent")?.textContent?.trim()||localStorage.getItem("CONTENT_TWIN_GENERATED_TEXT")||"";
  if(!content||content==="Создаю…"){alert("Сначала сгенерируй текст.");return}
  localStorage.setItem("CONTENT_TWIN_GENERATED_TEXT",content);
  const topic=$("studioTopic");if(topic)topic.value=($("generatorPrompt")?.value.trim()||"AI short");
  showSection("studio");
  $("videoPromptPreview").textContent=content;
  addLog("Текст передан в Video Studio. Kling возьмёт его автоматически.","OK");
});


function renderVideos(){
  const list=$("videoList"),count=$("videoCount");
  if(!list)return;
  count.textContent=String(state.videos.length);
  list.innerHTML=state.videos.length?state.videos.map((v,i)=>'<div class="video-row"><div><b>'+esc(v.name)+'</b><small>'+esc(v.size)+' • локально</small></div><button class="small" data-remove-video="'+i+'">Удалить</button></div>').join(""):'<p>Видео пока не добавлены.</p>';
  list.querySelectorAll("[data-remove-video]").forEach(b=>b.addEventListener("click",()=>{state.videos.splice(Number(b.dataset.removeVideo),1);saveVideos();renderVideos()}));
}
function saveVideos(){try{localStorage.setItem("CONTENT_TWIN_VIDEOS",JSON.stringify(state.videos))}catch{}}
function loadVideos(){try{state.videos=JSON.parse(localStorage.getItem("CONTENT_TWIN_VIDEOS")||"[]")}catch{state.videos=[]}renderVideos()}

function uploadLocalInfo(file){
  const row=document.createElement("div");row.className="uploadrow";
  row.textContent=file.name+" • "+formatSize(file.size)+" • файл выбран";
  $("uploads")?.append(row);
  state.videos.push({name:file.name,size:formatSize(file.size)});saveVideos();renderVideos();
}
$("pick")?.addEventListener("click",()=>$("fileInput").click());
$("fileInput")?.addEventListener("change",e=>[...e.target.files].forEach(uploadLocalInfo));
$("dropzone")?.addEventListener("dragover",e=>e.preventDefault());
$("dropzone")?.addEventListener("drop",e=>{
  e.preventDefault();
  [...e.dataTransfer.files].filter(f=>f.type.startsWith("video/")).forEach(uploadLocalInfo);
});

function renderProfile(p){
  state.profile=p;
  const keys=["voice","tone","pacing","audience","structure","strengths","generation_rules"];
  const html=keys.filter(k=>p[k]).map(k=>`<div class="profile-item"><b>${esc(k)}</b><p>${esc(Array.isArray(p[k])?p[k].join(" • "):p[k])}</p></div>`).join("");
  $("profileView").innerHTML=html||"<pre>"+esc(JSON.stringify(p,null,2))+"</pre>";
  $("profileEmpty")?.classList.add("hidden");$("profileView")?.classList.remove("hidden");
  $("fullProfile").innerHTML=html||"<pre>"+esc(JSON.stringify(p,null,2))+"</pre>";
  $("profileState").textContent="Профиль готов";
}
$("buildProfile")?.addEventListener("click",async()=>{
  $("profileState").textContent="Создаю профиль…";
  try{
    const transcript=$("sourceTranscript")?.value.trim()||localStorage.getItem("CONTENT_TWIN_TRANSCRIPT")||"";
    if(!transcript){$("profileState").textContent="Нужна расшифровка";alert("Сначала вставь расшифровку или описание роликов.");return}
    localStorage.setItem("CONTENT_TWIN_TRANSCRIPT",transcript);
    const d=await generateWithTwin(
      "Проанализируй расшифровку автора ниже. Не выдумывай наблюдения, которых нет в исходном тексте. Выдели повторяющиеся речевые и структурные паттерны, тон, темп, типы хуков, темы, аудиторию и правила генерации. Верни только JSON с voice,tone,hook_patterns,pacing,topics,structure,audience,strengths,generation_rules. РАСШИФРОВКА:\n"+transcript,
      {mode:"transcript-analysis"}
    );
    const raw=d.choices?.[0]?.message?.content||"{}";
    const p=parseJson(raw,{raw_profile:raw})
    localStorage.setItem("CONTENT_TWIN_PROFILE",JSON.stringify(p));
    renderProfile(p);
  }catch(e){$("profileState").textContent="Ошибка";alert(e.message)}
});
$("sourceTranscript")?.addEventListener("input",e=>localStorage.setItem("CONTENT_TWIN_TRANSCRIPT",e.target.value));

$("createShort")?.addEventListener("click",async()=>{
  const topic=$("studioTopic")?.value.trim();
  if(!topic)return;
  const platform=$("studioPlatform").value;
  const duration=$("studioDuration").value;
  const goal=$("studioGoal")?.value.trim()||"удержание внимания";
  const out=$("studioResult");out.innerHTML="<div class=\"empty-state\">Создаю структуру…</div>";
  try{
    const d=await generateWithTwin(
      "Создай оригинальный план короткого вертикального видео. Верни только JSON: {title,hook,script,beats:[{time,text,visual,caption}],broll,edit_plan,caption_style,cta,hashtags}. Тема: "+topic+". Платформа: "+platform+". Длительность: "+duration+" секунд. Цель: "+goal+". Script должен быть рассчитан на указанную длительность. Beats — последовательные отрезки времени. Не копируй чужие тексты дословно.",
      {product:"Shorts Studio",platform,duration,goal}
    );
    const raw=d.choices?.[0]?.message?.content||"{}";
    const p=parseJson(raw,{});
    if(!p.title&&!p.hook){out.innerHTML="<pre class=\"generated\">"+esc(raw)+"</pre>";return}
    state.lastShort=p;state.generated=true;updateAnalytics();$("renderShort")?.classList.remove("hidden");out.innerHTML=`<div class="studio-output"><h2>${esc(p.title||"Shorts")}</h2><div class="hook"><b>HOOK</b><p>${esc(p.hook||"")}</p></div><h3>Сценарий</h3><p>${esc(p.script||"")}</p><h3>Таймлайн</h3>${Array.isArray(p.beats)?p.beats.map(b=>`<div class="beat"><b>${esc(b.time||"")}</b><div><strong>${esc(b.text||"")}</strong><small>${esc(b.visual||"")}<br>Субтитры: ${esc(b.caption||"")}</small></div></div>`).join(""):""}<h3>Монтаж</h3><p>${esc(p.edit_plan||"")}</p><p><b>B-roll:</b> ${esc(Array.isArray(p.broll)?p.broll.join(" • "):(p.broll||"—"))}</p><p><b>CTA:</b> ${esc(p.cta||"—")}</p><p><b>Хэштеги:</b> ${esc(Array.isArray(p.hashtags)?p.hashtags.join(" "):(p.hashtags||""))}</p></div>`;
  }catch(e){out.innerHTML="<p>Ошибка: "+esc(e.message)+"</p>"}
});

function buildVideoPrompt(p){
  const beats=Array.isArray(p.beats)?p.beats.map(b=>b.visual||b.text||"").filter(Boolean).join("; "):"";
  return ("Vertical 9:16 short-form video. "+(p.title||"")+". Hook: "+(p.hook||"")+". Visual direction: "+beats+". Dynamic creator style, strong opening, natural motion, cinematic lighting, fast pacing, no on-screen text, no logos.").slice(0,2500);
}
async function generateAiVideo(){
  addLog("Запуск генерации AI-видео","INFO");
  const p=state.lastShort;if(!p){addLog("Нет Shorts-плана","ERROR");alert("Сначала создай Shorts-план.");return}
  const key=getKey();if(!key){addLog("API-ключ Polza не найден","ERROR");openSettings();return}
  const model=$("videoModel")?.value||"kling/v3";
  const duration=Math.max(3,Math.min(15,Number($("videoDuration")?.value||10)));
  const durationValue=String(duration);
  const status=$("videoGenerationStatus"),button=$("generateAiVideo");
  if(status)status.innerHTML="<span>Запускаю Kling 3.0…</span>";
  if(button){button.disabled=true;button.textContent="Генерация…"}
  try{
    const r=await fetch(POLZA_URL+"/media",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model,input:{prompt:buildVideoPrompt(p),aspect_ratio:"9:16",duration:durationValue,images:[],mode:"std",sound:true},async:true})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error?.message||data.detail||("Polza: HTTP "+r.status));
    if(!data.id)throw new Error("Polza не вернула ID задачи.");
    state.videoJob=data;if(status)status.innerHTML="<span>Задача создана. Генерирую…</span>";addLog("Задача создана: "+data.id,"OK");
    await pollVideoJob(data.id,key);
  }catch(e){
    if(status)status.innerHTML="<span class=\"video-error\">Ошибка: "+esc(e.message)+"</span>";addLog(e.message,"ERROR");
  }finally{
    if(button){button.disabled=false;button.textContent="✦ Сгенерировать AI-видео"}
  }
}
async function pollVideoJob(id,key){
  addLog("Проверяю статус задачи "+id,"INFO");
  const status=$("videoGenerationStatus");
  for(let attempt=0;attempt<90;attempt++){
    await new Promise(r=>setTimeout(r,4000));
    const r=await fetch(POLZA_URL+"/media/"+encodeURIComponent(id),{headers:{"Authorization":"Bearer "+key}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error?.message||data.detail||("Polza: HTTP "+r.status));
    state.videoJob=data;
    if(status)status.innerHTML="<span>Генерация… "+Math.min(99,Math.round((attempt+1)/90*100))+"%</span>";
    if(data.status==="failed"||data.status==="cancelled")throw new Error(data.error?.message||"Генерация завершилась ошибкой.");
    if(data.status==="completed"){
      const url=data.output?.url||data.data?.output?.url||data.data?.url||data.url;
      if(!url)throw new Error("Polza сообщила о готовности, но URL видео отсутствует.");
      showGeneratedVideo(url,data);return;
    }
  }
  throw new Error("Генерация ещё выполняется. Попробуй снова через минуту.");
}
function showGeneratedVideo(url,data){
  const box=$("studioResult");if(!box)return;box.querySelector(".ai-video-result")?.remove();
  const wrap=document.createElement("div");wrap.className="ai-video-result";
  const head=document.createElement("div");head.className="video-result-head";
  const title=document.createElement("strong");title.textContent="AI VIDEO READY";
  const model=document.createElement("span");model.textContent=data.model||"kling/v3";head.append(title,model);
  const video=document.createElement("video");video.controls=true;video.playsInline=true;video.preload="metadata";video.src=url;
  const actions=document.createElement("div");actions.className="result-actions";
  const open=document.createElement("a");open.className="small";open.href=url;open.target="_blank";open.rel="noopener";open.textContent="Открыть видео";
  const download=document.createElement("a");download.className="small";download.href=url;download.download="content-twin-ai-video.mp4";download.textContent="Скачать";
  actions.append(open,download);wrap.append(head,video,actions);box.appendChild(wrap);
  if($("videoGenerationStatus"))$("videoGenerationStatus").innerHTML="<span>✓ AI-видео готово</span>";
}
async function renderShortVideo(){
  const p=state.lastShort;if(!p)return;
  const canvas=document.createElement("canvas");canvas.width=720;canvas.height=1280;
  const ctx=canvas.getContext("2d");const stream=canvas.captureStream(30);
  const chunks=[];const rec=new MediaRecorder(stream,{mimeType:"video/webm"});
  rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const duration=Math.max(5,Math.min(15,Number($("studioDuration")?.value||15)));
  const lines=String(p.script||p.hook||"AI Content Twin").match(/.{1,34}(?:\s|$)/g)||[String(p.script||p.hook||"AI Content Twin")];
  let startTime=performance.now();
  rec.start();
  await new Promise(resolve=>{
    const draw=now=>{
      const t=(now-startTime)/1000;
      ctx.fillStyle="#090a0d";ctx.fillRect(0,0,720,1280);
      ctx.fillStyle="#a78bfa";ctx.font="700 24px system-ui";ctx.fillText("CONTENT TWIN",42,70);
      ctx.fillStyle="#fff";ctx.font="800 42px system-ui";
      const line=lines[Math.min(lines.length-1,Math.floor(t/Math.max(.7,duration/lines.length)))];
      ctx.fillText(line?.trim()||"",42,620);
      ctx.fillStyle="#8f96a3";ctx.font="18px system-ui";ctx.fillText("AI Content Twin • preview",42,1210);
      if(t<duration)requestAnimationFrame(draw);else resolve();
    };
    requestAnimationFrame(draw);
  });
  rec.stop();
  await new Promise(resolve=>rec.onstop=resolve);
  const blob=new Blob(chunks,{type:"video/webm"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="content-twin-short-preview.webm";a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  $("renderShort").textContent="✓ Preview готов";
}
$("renderShort")?.addEventListener("click",renderShortVideo);
$("generateAiVideo")?.addEventListener("click",generateAiVideo);

function loadProfile(){
  try{
    const p=JSON.parse(localStorage.getItem("CONTENT_TWIN_PROFILE")||"null");
    if(p)renderProfile(p);
    const t=localStorage.getItem("CONTENT_TWIN_TRANSCRIPT")||"";if($("sourceTranscript"))$("sourceTranscript").value=t;
  }catch{}
}
function formatSize(n){return n<1048576?(n/1024).toFixed(0)+" KB":(n/1048576).toFixed(1)+" MB"}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function enhanceStudioResult(){
  const box=$("studioResult");
  const output=box?.querySelector(".studio-output");
  if(!output||output.querySelector(".result-actions"))return;
  const actions=document.createElement("div");
  actions.className="result-actions";
  const copy=document.createElement("button");
  copy.className="small";copy.textContent="Копировать";
  copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(output.innerText);copy.textContent="Скопировано ✓"}catch{copy.textContent="Не удалось"}});
  const save=document.createElement("button");
  save.className="small";save.textContent="Скачать TXT";
  save.addEventListener("click",()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([output.innerText],{type:"text/plain;charset=utf-8"}));a.download="shorts-plan.txt";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
  actions.append(copy,save);output.prepend(actions);
}
if($("studioResult")){new MutationObserver(enhanceStudioResult).observe($("studioResult"),{childList:true,subtree:true});}

document.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.jump)));
const titles={logs:["System Logs.","Технические события и состояние генерации."],dashboard:["Your content. Amplified.","Преврати свои материалы в систему производства контента."],videos:["Моя библиотека.","Материалы автора в одном workspace."],profile:["Content Profile.","Собери цифровой отпечаток своего стиля."],ideas:["Idea Lab.","Идеи, которые можно сразу превращать в ролики."],generator:["Content Generator.","От запроса к готовому контенту."],studio:["Shorts Studio.","Сценарий, таймлайн и монтаж в одном месте."],hooks:["Hook Lab.","Тестируй первые секунды до публикации."],analytics:["Analytics.","Смотри на контент как на систему."]};
const oldShowSection=showSection;
showSection=function(name){oldShowSection(name);const t=titles[name]||titles.dashboard;if($("pageTitle"))$("pageTitle").textContent=t[0];if($("pageSubtitle"))$("pageSubtitle").textContent=t[1];updateAnalytics();};
function updateAnalytics(){
  if($("metricVideos"))$("metricVideos").textContent=String(state.videos.length);
  if($("metricProfile"))$("metricProfile").textContent=state.profile?"Готов":"—";
  if($("metricShort"))$("metricShort").textContent=state.generated?"Готов":"—";
  if($("dashVideoState"))$("dashVideoState").textContent=state.videos.length+" материалов";
  if($("dashProfileState"))$("dashProfileState").textContent=state.profile?"Готов":"Не создан";
}
$("generateHooks")?.addEventListener("click",async()=>{
  const topic=$("hookTopic")?.value.trim();const count=Number($("hookCount")?.value||10);
  if(!topic)return;
  $("hookResults").innerHTML="<div class=\"empty-state\">Генерирую варианты…</div>";
  try{
    const d=await generateWithTwin("Сгенерируй "+count+" оригинальных хуков для коротких вертикальных видео по теме: "+topic+". Верни только JSON-массив объектов {hook,visual,curiosity}. Хуки должны отличаться по механике и быть пригодны для первых секунд ролика.",{module:"Hook Lab",topic});
    const list=parseJson(d.choices?.[0]?.message?.content||"[]",[]);
    $("hookResults").innerHTML=Array.isArray(list)&&list.length?list.map((x,i)=>`<div class="hook-card"><span>${i+1}</span><div><strong>${esc(x.hook||"")}</strong><p>${esc(x.visual||"")}</p><small>${esc(x.curiosity||"")}</small></div></div>`).join(""):"<p>Не удалось разобрать ответ модели.</p>";
  }catch(e){$("hookResults").innerHTML="<p>Ошибка: "+esc(e.message)+"</p>"}
});
$("refreshAnalytics")?.addEventListener("click",()=>{updateAnalytics();});
$("resetWorkspace")?.addEventListener("click",()=>{
  if(!confirm("Удалить локальный профиль, расшифровку и список видео?"))return;
  localStorage.removeItem("CONTENT_TWIN_PROFILE");localStorage.removeItem("CONTENT_TWIN_TRANSCRIPT");localStorage.removeItem("CONTENT_TWIN_VIDEOS");
  state.profile=null;state.videos=[];if($("sourceTranscript"))$("sourceTranscript").value="";
  renderVideos();$("profileView").innerHTML="";$("fullProfile").innerHTML="";$("profileState").textContent="Профиль не создан";
  $("profileEmpty")?.classList.remove("hidden");$("profileView")?.classList.add("hidden");updateAnalytics();
});
updateAnalytics();
updateStatus();loadVideos();loadProfile();

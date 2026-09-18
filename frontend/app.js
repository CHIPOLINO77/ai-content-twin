const POLZA_URL="https://api.polza.ai/v1";
const POLZA_KEY_STORAGE="CONTENT_TWIN_POLZA_KEY";
const POLZA_MODEL_STORAGE="CONTENT_TWIN_POLZA_MODEL";
const DEFAULT_MODEL="openai/gpt-6-astra";
const state={videos:[],profile:null};

function getProfileContext(){
  let transcript=$("sourceTranscript")?.value.trim()||"";
  if(!transcript) transcript=localStorage.getItem("CONTENT_TWIN_TRANSCRIPT")||"";
  return {profile:state.profile||{},sourceTranscript:transcript.slice(0,30000)};
}
function parseJson(text,fallback={}){
  try{return JSON.parse(text)}catch{}
  const obj=text.match(/\\{[\\s\\S]*\\}/)?.[0];
  if(obj)try{return JSON.parse(obj)}catch{}
  const arr=text.match(/\\[[\\s\\S]*\\]/)?.[0];
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

$("generateContent")?.addEventListener("click",async()=>{
  const prompt=$("generatorPrompt").value.trim();if(!prompt)return;
  $("generatedContent").textContent="Создаю…";
  try{
    const d=await generateWithTwin(prompt,{product:"AI Content Twin"});
    $("generatedContent").textContent=d.choices?.[0]?.message?.content||JSON.stringify(d,null,2);
  }catch(e){$("generatedContent").textContent="Ошибка: "+e.message}
});

function uploadLocalInfo(file){
  const row=document.createElement("div");row.className="uploadrow";
  row.textContent=file.name+" • "+formatSize(file.size)+" • файл выбран";
  $("uploads")?.append(row);
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
    const d=await generateWithTwin(
      "Создай Content Profile автора на основе информации, доступной сейчас. Если исходных видео ещё нет, создай базовый профиль с понятными правилами генерации для русскоязычного автора. Верни JSON с voice,tone,hook_patterns,pacing,topics,structure,audience,strengths,generation_rules.",
      {mode:"browser-only"}
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
    out.innerHTML=`<div class="studio-output"><h2>${esc(p.title||"Shorts")}</h2><div class="hook"><b>HOOK</b><p>${esc(p.hook||"")}</p></div><h3>Сценарий</h3><p>${esc(p.script||"")}</p><h3>Таймлайн</h3>${Array.isArray(p.beats)?p.beats.map(b=>`<div class="beat"><b>${esc(b.time||"")}</b><div><strong>${esc(b.text||"")}</strong><small>${esc(b.visual||"")}<br>Субтитры: ${esc(b.caption||"")}</small></div></div>`).join(""):""}<h3>Монтаж</h3><p>${esc(p.edit_plan||"")}</p><p><b>B-roll:</b> ${esc(Array.isArray(p.broll)?p.broll.join(" • "):(p.broll||"—"))}</p><p><b>CTA:</b> ${esc(p.cta||"—")}</p><p><b>Хэштеги:</b> ${esc(Array.isArray(p.hashtags)?p.hashtags.join(" "):(p.hashtags||""))}</p></div>`;
  }catch(e){out.innerHTML="<p>Ошибка: "+esc(e.message)+"</p>"}
});

function loadProfile(){
  try{
    const p=JSON.parse(localStorage.getItem("CONTENT_TWIN_PROFILE")||"null");
    if(p)renderProfile(p);\n    const t=localStorage.getItem("CONTENT_TWIN_TRANSCRIPT")||"";if($("sourceTranscript"))$("sourceTranscript").value=t;
  }catch{}
}
function formatSize(n){return n<1048576?(n/1024).toFixed(0)+" KB":(n/1048576).toFixed(1)+" MB"}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
updateStatus();loadProfile();

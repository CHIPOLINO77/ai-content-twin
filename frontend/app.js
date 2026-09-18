const POLZA_URL="https://api.polza.ai/v1";
const POLZA_KEY_STORAGE="CONTENT_TWIN_POLZA_KEY";
const POLZA_MODEL_STORAGE="CONTENT_TWIN_POLZA_MODEL";
const DEFAULT_MODEL="openai/gpt-5";
const $=id=>document.getElementById(id);
const state={videos:[],profile:null};

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
$("closeSettings")?.addEventListener("click",closeSettings);
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
    let p;try{p=JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0]||"{}")}catch{p={raw_profile:raw}}
    localStorage.setItem("CONTENT_TWIN_PROFILE",JSON.stringify(p));
    renderProfile(p);
  }catch(e){$("profileState").textContent="Ошибка";alert(e.message)}
});
function loadProfile(){
  try{
    const p=JSON.parse(localStorage.getItem("CONTENT_TWIN_PROFILE")||"null");
    if(p)renderProfile(p);
  }catch{}
}
function formatSize(n){return n<1048576?(n/1024).toFixed(0)+" KB":(n/1048576).toFixed(1)+" MB"}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
updateStatus();loadProfile();

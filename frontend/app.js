const API=localStorage.getItem("CONTENT_TWIN_API")||"http://localhost:8000";
const $=id=>document.getElementById(id);
const state={videos:[]};

async function request(path,options={}){
  const r=await fetch(API+path,options);
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.detail||"Ошибка запроса");
  return data;
}
async function health(){
  try{const d=await request("/health");$("apiStatus").textContent=d.polza_configured&&d.model_configured?"Polza AI подключён":"Backend online • настрой .env";}
  catch(e){$("apiStatus").textContent="Backend offline";}
}
function showSection(name){
  document.querySelectorAll(".section").forEach(x=>x.classList.add("hidden"));
  const target=$(name==="ideas"?"ideasSection":name);
  if(target)target.classList.remove("hidden");
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.section===name));
}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>showSection(b.dataset.section));

async function upload(file){
  const row=document.createElement("div");row.className="uploadrow";row.textContent=file.name+" — загрузка…";$("uploads").append(row);
  const fd=new FormData();fd.append("file",file);
  try{
    const d=await request("/api/upload",{method:"POST",body:fd});
    row.textContent=d.filename+" ✓ Загружено";
    await refreshVideos();
  }catch(e){row.textContent=file.name+" — ошибка: "+e.message}
}
$("pick").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>[...e.target.files].forEach(upload);
$("dropzone").ondragover=e=>e.preventDefault();
$("dropzone").ondrop=e=>{e.preventDefault();[...e.dataTransfer.files].filter(f=>f.type.startsWith("video/")).forEach(upload)};

async function refreshVideos(){
  try{
    state.videos=await request("/api/videos");
    $("videoCount").textContent=state.videos.length;
    $("videoList").innerHTML=state.videos.length?state.videos.map(v=>`
      <div class="video-row"><div><strong>${esc(v.filename)}</strong><small>${formatSize(v.size)} • ${esc(v.status)}</small></div>
      <button class="small" onclick="processVideo('${v.id}')">${v.status==="uploaded"?"Анализировать":v.status==="analyzed"?"Готово":"Повторить"}</button></div>`).join(""):"<p>Видео пока нет.</p>";
  }catch(e){$("videoList").innerHTML="<p>Не удалось получить список видео.</p>"}
}
async function processVideo(id){
  try{
    await request("/api/videos/"+id+"/transcribe",{method:"POST"});
    await request("/api/videos/"+id+"/analyze",{method:"POST"});
    await refreshVideos();
    $("profileState").textContent="Видео проанализировано";
  }catch(e){alert(e.message)}
}
window.processVideo=processVideo;

$("buildProfile").onclick=async()=>{
  $("profileState").textContent="Собираю…";
  try{
    const data=await request("/api/profile/build",{method:"POST"});
    renderProfile(data);
    $("profileState").textContent="Обучен";
  }catch(e){$("profileState").textContent="Ошибка";alert(e.message)}
};
function renderProfile(p){
  const keys=["voice","tone","pacing","audience","structure","strengths","generation_rules"];
  const html=keys.filter(k=>p[k]).map(k=>`<div class="profile-item"><b>${esc(k)}</b><p>${esc(Array.isArray(p[k])?p[k].join(" • "):p[k])}</p></div>`).join("");
  $("profileView").innerHTML=html||"<pre>"+esc(JSON.stringify(p,null,2))+"</pre>";
  $("profileEmpty").classList.add("hidden");$("profileView").classList.remove("hidden");$("fullProfile").innerHTML=html||"<pre>"+esc(JSON.stringify(p,null,2))+"</pre>";
}
async function loadProfile(){
  try{const d=await request("/api/profile");renderProfile(d.profile);$("profileState").textContent="Обучен";}catch(e){}
}

$("generate").onclick=async()=>{
  const topic=$("topic").value.trim();if(!topic)return;
  $("ideas").innerHTML="<p>Polza генерирует идеи…</p>";
  try{
    const list=await request("/api/ideas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,count:10,platform:"shorts"})});
    $("ideas").innerHTML=(Array.isArray(list)?list:[list]).map((x,i)=>`<div class="idea"><h3>${i+1}. ${esc(x.title||"Идея")}</h3><p><b>Hook:</b> ${esc(x.hook||"—")}</p><p>${esc(x.angle||"")}</p><span class="tag">${esc(x.why_it_fits||"AI Content Twin")}</span></div>`).join("");
  }catch(e){$("ideas").innerHTML="<p>Ошибка: "+esc(e.message)+"</p>"}
};
$("generateContent").onclick=async()=>{
  const prompt=$("generatorPrompt").value.trim();if(!prompt)return;
  $("generatedContent").textContent="Создаю…";
  try{
    const d=await request("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt,context:{product:"AI Content Twin"}})});
    $("generatedContent").textContent=d.choices?.[0]?.message?.content||JSON.stringify(d,null,2);
  }catch(e){$("generatedContent").textContent="Ошибка: "+e.message}
};
function formatSize(n){return n<1048576?(n/1024).toFixed(0)+" KB":(n/1048576).toFixed(1)+" MB"}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","'":"&#039;"}[c]))}
health();refreshVideos();loadProfile();
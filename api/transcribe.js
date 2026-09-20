export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const key=process.env.POLZA_API_KEY;if(!key)return res.status(500).json({error:"POLZA_API_KEY is not configured on server"});
 try{
  const chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));if(!body.audio) return res.status(400).json({error:"audio is required"});
  const bytes=Buffer.from(body.audio,"base64");const form=new FormData();form.append("file",new Blob([bytes],{type:body.mime||"audio/webm"}),"chunk.webm");form.append("model",body.model||"openai/whisper-large-v3");form.append("language",body.language||"ru");
  const r=await fetch("https://polza.ai/api/v1/audio/transcriptions",{method:"POST",headers:{"Authorization":"Bearer "+key},body:form});const text=await r.text();res.status(r.status).setHeader("Content-Type",r.headers.get("content-type")||"application/json").send(text);
 }catch(e){res.status(502).json({error:"Transcription service failed",detail:e.message})}
}
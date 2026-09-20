export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const key=process.env.POLZA_API_KEY;
 if(!key)return res.status(500).json({error:"POLZA_API_KEY is not configured on server"});
 try{
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(!body.audio)return res.status(400).json({error:"audio is required"});
  const mime=body.mime||"audio/webm";
  const file=body.audio.startsWith("data:")?body.audio:"data:"+mime+";base64,"+body.audio;
  const payload={
   file,
   model:body.model||"aiesa/transcribe-fast",
   language:body.language||"ru",
   response_format:"verbose_json",
   timestamp_granularities:["segment","word"],
   temperature:0
  };
  let r=await fetch("https://polza.ai/api/v1/audio/transcriptions",{
   method:"POST",
   headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
   body:JSON.stringify(payload)
  });
  let text=await r.text();
  if(!r.ok && body.model==="aiesa/transcribe-fast"){
   const fallbackPayload={...payload,model:"aiesa/transcribe"};
   const fallback=await fetch("https://polza.ai/api/v1/audio/transcriptions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
    body:JSON.stringify(fallbackPayload)
   });
   text=await fallback.text();
   return res.status(fallback.status).setHeader("Content-Type",fallback.headers.get("content-type")||"application/json").send(text);
  }
  res.status(r.status).setHeader("Content-Type",r.headers.get("content-type")||"application/json").send(text);
 }catch(e){
  res.status(502).json({error:"Transcription service failed",detail:e.message});
 }
}
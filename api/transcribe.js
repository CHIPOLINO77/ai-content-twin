export const config={api:{bodyParser:false}};
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const key=process.env.POLZA_API_KEY;if(!key)return res.status(500).json({error:"POLZA_API_KEY is not configured on server"});
 try{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
  const type=req.headers["content-type"]||"application/octet-stream";
  const r=await fetch("https://polza.ai/api/v1/audio/transcriptions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":type},body});
  const text=await r.text();res.status(r.status).setHeader("Content-Type",r.headers.get("content-type")||"application/json").send(text);
 }catch(e){res.status(502).json({error:"Transcription service failed",detail:e.message})}
}
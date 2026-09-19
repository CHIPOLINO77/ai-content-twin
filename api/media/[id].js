export default async function handler(req,res) {
  const key=process.env.POLZA_API_KEY;
  if(!key)return res.status(500).json({error:"POLZA_API_KEY is not configured on server"});
  const id=req.query.id;
  try{
    const r=await fetch("https://polza.ai/api/v1/media/"+encodeURIComponent(id),{headers:{"Authorization":"Bearer "+key}});
    const text=await r.text();
    res.status(r.status).setHeader("Content-Type",r.headers.get("content-type")||"application/json").send(text);
  }catch(e){res.status(502).json({error:"Polza connection failed",detail:e.message});}
}
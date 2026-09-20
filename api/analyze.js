export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  const key=process.env.POLZA_API_KEY;if(!key)return res.status(500).json({error:"POLZA_API_KEY is not configured on server"});
  const {transcript="",duration=0,max_clips=12,language="ru"}=req.body||{};
  if(!transcript.trim())return res.status(400).json({error:"Transcript is required"});
  const prompt=`Ты semantic video clipping engine. Проанализируй расшифровку длинного видео и найди до ${Math.min(20,Math.max(1,Number(max_clips)||12))} самостоятельных фрагментов, которые имеют высокий потенциал для Shorts/Reels/TikTok: сильная мысль, конфликт, неожиданный факт, история, эмоция, юмор, практический совет или сильный вывод. Не выдумывай события. Каждый фрагмент должен быть пригоден для отдельного короткого ролика. Если в расшифровке есть таймкоды — используй их. Если таймкодов нет, оцени позиции пропорционально длине текста и общей длительности ${duration||0} секунд.
Верни ТОЛЬКО JSON: {"clips":[{"title":"...","start":0,"end":30,"score":0,"reason":"...","hook":"...","caption":"..."}]}.
score 0-100. start/end в секундах. Не создавай пересекающиеся фрагменты без причины. Язык ответа: ${language}.
РАСШИФРОВКА:
${transcript.slice(0,50000)}`;
  try{
    const r=await fetch("https://polza.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:"openai/gpt-4.1-nano",messages:[{role:"system",content:"Ты точный JSON API для анализа видео."},{role:"user",content:prompt}],temperature:.2})});
    const text=await r.text();if(!r.ok)return res.status(r.status).send(text);
    let data;try{data=JSON.parse(text)}catch{return res.status(502).json({error:"Invalid upstream JSON"})}
    const content=data.choices?.[0]?.message?.content||"";
    const raw=content.match(/\{[\s\S]*\}/)?.[0]||'{"clips":[]}';
    let result;try{result=JSON.parse(raw)}catch{result={clips:[]}};
    result.clips=(Array.isArray(result.clips)?result.clips:[]).filter(x=>Number.isFinite(Number(x.start))&&Number.isFinite(Number(x.end))&&Number(x.end)>Number(x.start)&&Number(x.end)-Number(x.start)>=Number(req.body?.min_duration||15)).map(x=>({...x,start:Math.max(0,Number(x.start)),end:duration?Math.min(Number(duration),Number(x.end)):Number(x.end),score:Math.max(0,Math.min(100,Number(x.score)||0))})).sort((a,b)=>b.score-a.score).slice(0,20);
    return res.status(200).json(result);
  }catch(e){return res.status(502).json({error:"Polza connection failed",detail:e.message})}
}
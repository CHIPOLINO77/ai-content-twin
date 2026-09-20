export default async function handler(req,res) {
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});

  const key = process.env.POLZA_API_KEY;
  if (!key) return res.status(500).json({error:"POLZA_API_KEY is not configured on server"});

  const payload = req.body || {};
  const endpoints = [
    "https://polza.ai/api/v1/chat/completions",
    "https://api.polza.ai/v1/chat/completions"
  ];

  try {
    let lastStatus = 502;
    let lastText = "";

    for (const endpoint of endpoints) {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + key
        },
        body: JSON.stringify(payload)
      });

      const text = await r.text();
      lastStatus = r.status;
      lastText = text;

      if (r.ok) {
        return res
          .status(r.status)
          .setHeader("Content-Type", r.headers.get("content-type") || "application/json")
          .send(text);
      }

      if (![404, 405, 502, 503].includes(r.status)) {
        return res
          .status(r.status)
          .setHeader("Content-Type", r.headers.get("content-type") || "application/json")
          .send(text);
      }
    }

    return res.status(lastStatus).json({
      error: "Polza upstream request failed",
      upstream_status: lastStatus,
      upstream_response: lastText.slice(0, 2000)
    });
  } catch (e) {
    return res.status(502).json({
      error: "Polza connection failed",
      detail: e.message
    });
  }
}

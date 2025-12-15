export default async function handler(_req: Request): Promise<Response> {
  return new Response(JSON.stringify({ ok: true, todo: "match-score" }), { headers: { "content-type": "application/json" } });
}

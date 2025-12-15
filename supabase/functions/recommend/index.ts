export default async function handler(_req: Request): Promise<Response> {
  return new Response(JSON.stringify({ ok: true, todo: "recommendations" }), { headers: { "content-type": "application/json" } });
}

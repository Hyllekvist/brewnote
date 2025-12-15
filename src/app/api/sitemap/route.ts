import { NextResponse } from "next/server";
const base = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function GET() {
  const urls = ["/","/coffees","/teas","/guides","/roasters","/pricing","/coffees/gigino-80-anniversario","/teas/sencha-konomi","/guides/pourover-basics","/roasters/barbanera"];
  const body = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.map((u) => `<url><loc>${base()}${u}</loc></url>`).join("") +
    `</urlset>`;
  return new NextResponse(body, { headers: { "Content-Type": "application/xml" } });
}

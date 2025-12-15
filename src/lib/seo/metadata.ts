import type { Metadata } from "next";
type Args = { title: string; description: string; canonical: string; ogImage?: string };
export function buildMetadata(a: Args): Metadata {
  const og = a.ogImage || "/og/default.svg";
  return { title: a.title, description: a.description, alternates: { canonical: a.canonical }, openGraph: { title: a.title, description: a.description, images: [og], type: "website" } };
}

import type { Metadata } from "next";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Smagsprofil – BrewNote",
  description: "Din smagsprofil og confidence, baseret på dine ratings.",
  alternates: { canonical: "/profile" },
};

export default function ProfilePage() {
  return <ProfileClient />;
}
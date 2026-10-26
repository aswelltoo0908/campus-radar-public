import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./radar-ui.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://campus-radar-umich.aswelltoo.chatgpt.site"),
  title: "Campus Radar — U-M Research, Scholarships & Internships",
  description: "Discover student opportunities that fit your goals, with clear eligibility, original sources and next steps.",
  openGraph: {
    title: "Campus Radar — Don't miss what matters at Michigan",
    description: "Research, scholarships and internships selected around your goals, with sources and next steps.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Campus Radar social preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Campus Radar — Don't miss what matters at Michigan",
    description: "Three clear moves. Every morning.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}

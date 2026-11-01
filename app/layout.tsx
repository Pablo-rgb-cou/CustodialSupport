import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.custodialmanagement.net"),
  applicationName: "CustodialSupport",
  title: "CustodialSupport",
  description:
    "Clear account and transaction support, with practical guidance when you need it.",
  openGraph: {
    type: "website",
    url: "https://www.custodialmanagement.net",
    siteName: "CustodialSupport",
    title: "CustodialSupport",
    description:
      "Clear account and transaction support, with practical guidance when you need it.",
    images: [
      {
        url: "/custodial-support-preview.png",
          width: 1729,
          height: 910,
        alt: "CustodialSupport — clear account and transaction support",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CustodialSupport",
    description:
      "Clear account and transaction support, with practical guidance when you need it.",
    images: ["/custodial-support-preview.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

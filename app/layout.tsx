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
  title: {
    default: "CustodialSupport | Client Support",
    template: "%s | CustodialSupport",
  },
  description:
    "Get clear guidance, account support, and help with transaction-related questions through CustodialSupport.",
  openGraph: {
    type: "website",
    url: "https://www.custodialmanagement.net",
    siteName: "CustodialSupport",
    title: "CustodialSupport | Client Support",
    description:
      "Get clear guidance, account support, and help with transaction-related questions through CustodialSupport.",
  },
  twitter: {
    card: "summary",
    title: "CustodialSupport | Client Support",
    description:
      "Get clear guidance, account support, and help with transaction-related questions through CustodialSupport.",
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

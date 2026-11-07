import Script from "next/script";
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
  icons: {
    icon: [
      { url: "/brand/custodial-icon-v20261103-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/custodial-icon-v20261103-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=20261103",
    apple: { url: "/brand/custodial-icon-v20261103-180.png", sizes: "180x180", type: "image/png" },
  },
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
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}
      <Script
  id="smartsupp-chat"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      var _smartsupp = window._smartsupp || {};
      _smartsupp.key = '951fb46282afc63496427e8fbbe184821af58267';
      window._smartsupp = _smartsupp;

      window.smartsupp || (function(d) {
        var s, c, o = window.smartsupp = function() {
          o._.push(arguments);
        };
        o._ = [];
        s = d.getElementsByTagName('script')[0];
        c = d.createElement('script');
        c.type = 'text/javascript';
        c.charset = 'utf-8';
        c.async = true;
        c.src = 'https://www.smartsuppchat.com/loader.js?';
        s.parentNode.insertBefore(c, s);
      })(document);
    `,
  }}
/>
      </body>
    </html>
  );
}

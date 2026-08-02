import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "TCOS Finance Tracking",
  description: "ระบบติดตามและบริหารจัดการการเงิน The Coming of Stages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${prompt.variable} ${prompt.className} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}


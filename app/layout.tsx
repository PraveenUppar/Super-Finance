import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Super Finance",
  description: "SME IPO draft prospectus builder",
};

/**
 * Fonts and Clerk only. The app's own chrome (the sidebar) and the
 * "you need an organization" gate both live in `app/(app)/layout.tsx` now,
 * a route group deliberately excluding `/sign-in` and `/sign-up` — see that
 * file's comment for why.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} dark h-full antialiased`}
      >
        <body className="h-full min-h-full">{children}</body>
      </html>
    </ClerkProvider>
  );
}

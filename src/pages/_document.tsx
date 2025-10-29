import { Html, Head, Main, NextScript } from 'next/document';

// Yeh file har page ka base HTML structure define karti hai (SEO + Verification ke liye).

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* 🔹 Google Search Console Verification */}
        <meta
          name="google-site-verification"
          content="DoZI_GopcOg-q6fim50D5Wd62MXhg5_s_tXbGsOrV3M"
        />

        {/* 🔹 Basic SEO Meta Tags */}
        <meta name="description" content="MCPE ModForge AI - Turn your Minecraft ideas into reality." />
        <meta name="author" content="ModForge AI" />

        {/* 🔹 Favicon (Optional, add your link if available) */}
        <link rel="icon" href="/favicon.ico" />

        {/* 🔹 Fonts (optional performance tweak) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </Head>

      <body className="bg-[#121212] text-white min-h-screen">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}


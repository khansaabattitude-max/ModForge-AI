import { Html, Head, Main, NextScript } from 'next/document';

// Yeh file Next.js mein har page ke base HTML structure ko define karti hai.

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/*
          Google Search Console ka Verification Tag Yahan Daal Diya Gaya Hai.
        */}
        <meta name="google-site-verification" content="DoZI_GopcOg-q6fim50D5Wd62MXhg5_s_tXbGsOrV3M" />
        
        {/*
          Agar aapke paas koi aur zaroori tags hain (jaise favicon ya fonts), woh yahan aayenge.
        */}
        
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

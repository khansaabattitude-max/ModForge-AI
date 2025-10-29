import '../styles/globals.css';
import React from 'react';
import { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    // Yeh Tailwind classes body ko dark background dengi
    <div className="bg-gray-900 text-white min-h-screen"> 
      <Component {...pageProps} />
    </div>
  );
}

export default MyApp;

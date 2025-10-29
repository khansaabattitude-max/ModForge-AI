import type { AppProps } from 'next/app';
import '../styles/globals.css'; // Correct relative path

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp;

// next.config.mjs

// Next.js ke latest versions mein defineConfig ko aise import karte hain
import pkg from 'next'; 
const { defineConfig } = pkg;

/** @type {import('next').NextConfig} */
const nextConfig = defineConfig({
  // Yeh 'output: standalone' line Next.js ko Vercel par sahi se deploy hone mein madad karti hai
  output: 'standalone', 
});

export default nextConfig;

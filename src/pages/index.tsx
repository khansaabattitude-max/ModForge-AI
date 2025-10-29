import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import type { ModData, OutputTab } from '../types';
import { generateMod, moderateReview } from '../services/apiClient';
import SparklesIcon from '../components/icons/SparklesIcon';
import DownloadIcon from '../components/icons/DownloadIcon';
import ErrorIcon from '../components/icons/ErrorIcon';
import StarIcon from '../components/icons/StarIcon';
import Loader from '../components/Loader';
import CodeBlock from '../components/CodeBlock';

// Declare JSZip for use with the script tag added in index.html
declare const JSZip: any;

interface Review {
  rating: number;
  feedback: string;
}

const samplePrompts = [
  "Create a glowing torch that can be held and lights up the area.",
  "A heavy battle axe that deals more damage but swings slower.",
  "A diamond sword with sharpness 5 and fire aspect 2.",
  "Armor that changes color when health drops below 50%.",
];

const HomePage: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [modData, setModData] = useState<ModData | null>(null);
  const [activeTab, setActiveTab] = useState<OutputTab>('explanation');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [userRating, setUserRating] = useState<number>(0);
  const [userFeedback, setUserFeedback] = useState<string>('');
  const [reviewStatus, setReviewStatus] = useState<'idle' | 'moderating' | 'success' | 'error'>('idle');
  const [reviewError, setReviewError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt || isLoading) return;

    setIsLoading(true);
    setError(null);
    setModData(null);
    setReviews([]);
    setReviewStatus('idle');
    setUserRating(0);
    setUserFeedback('');

    try {
      const data = await generateMod(prompt);
      setModData(data);
      setActiveTab('explanation');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, isLoading]);

  const handleSamplePrompt = (sample: string) => setPrompt(sample);

  const handleReviewSubmit = useCallback(async () => {
    if (userRating === 0 || !userFeedback.trim()) {
      setReviewError("Please provide a rating and some feedback.");
      setReviewStatus('error');
      return;
    }
    setReviewStatus('moderating');
    setReviewError(null);

    const moderationResult = await moderateReview(userFeedback);

    if (moderationResult === 'SAFE') {
      setReviews(prev => [...prev, { rating: userRating, feedback: userFeedback }]);
      setUserRating(0);
      setUserFeedback('');
      setReviewStatus('success');
      setTimeout(() => setReviewStatus('idle'), 3000);
    } else {
      setReviewError("Your review was flagged as inappropriate and was not published.");
      setReviewStatus('error');
    }
  }, [userRating, userFeedback]);

  const handleDownloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const svgToPngBlob = (svgString: string, width: number, height: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not get canvas context'));

      ctx.imageSmoothingEnabled = false;

      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob conversion failed'));
        }, 'image/png');
      };

      img.onerror = reject;
      img.src = `data:image/svg+xml;base64,${btoa(svgString)}`;
    });
  };

  const handleDownloadMcaddon = useCallback(async () => {
    if (!modData) return;

    try {
      const zip = new JSZip();

      // Behavior Pack
      zip.file(`behavior_pack/manifest.json`, modData.behaviorPack.manifest);
      zip.file(`behavior_pack/items/${modData.modName}.json`, modData.behaviorPack.item);
      if (modData.scripts.main) zip.file(`behavior_pack/scripts/main.js`, modData.scripts.main);

      // Resource Pack
      zip.file(`resource_pack/manifest.json`, modData.resourcePack.manifest);
      zip.file(`resource_pack/items/${modData.modName}.json`, modData.resourcePack.items);

      const textureBlob = await svgToPngBlob(modData.texture_svg, 16, 16);
      zip.file(`resource_pack/${modData.resourcePack.textures.item_texture}`, textureBlob);

      if (modData.pack_icon_base64) {
        const packIconBytes = atob(modData.pack_icon_base64);
        const packIconArray = new Uint8Array(packIconBytes.length);
        for (let i = 0; i < packIconBytes.length; i++) {
          packIconArray[i] = packIconBytes.charCodeAt(i);
        }
        const packIconBlob = new Blob([packIconArray], { type: 'image/png' });
        zip.file(`behavior_pack/pack_icon.png`, packIconBlob);
        zip.file(`resource_pack/pack_icon.png`, packIconBlob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(`${modData.modName}.mcaddon`, zipBlob);
    } catch (err) {
      console.error("Failed to create .mcaddon file:", err);
      setError(err instanceof Error ? err.message : "Unknown error during packaging.");
    }
  }, [modData]);

  const renderOutput = () => {
    if (isLoading) return <Loader />;
    if (error) return (
      <div className="text-red-300 bg-red-900/50 p-6 rounded-lg border border-red-600 flex items-start gap-4">
        <ErrorIcon className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
        <div>
          <h3 className="text-xl font-bold text-red-300 mb-2">Mod Generation Failed</h3>
          <p className="text-red-300 mb-4">{error}</p>
          <p className="text-sm text-red-400">
            <strong>Suggestions:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Try rephrasing or simplifying your prompt.</li>
              <li>Ensure your request is for a single item with clear functionality.</li>
              <li>Try again later if the issue persists.</li>
            </ul>
          </p>
        </div>
      </div>
    );

    if (!modData) return null;

    return (
      <div className="bg-mc-gray/50 border border-mc-light-gray rounded-lg p-6 w-full">
        <h2 className="text-2xl font-bold text-mc-green mb-4">{modData.modName}</h2>
        {/* Tabs */}
        <div className="flex border-b border-mc-light-gray mb-4 overflow-x-auto">
          <TabButton name="Explanation" id="explanation" activeTab={activeTab} onClick={setActiveTab} />
          <TabButton name="Code Preview" id="code" activeTab={activeTab} onClick={setActiveTab} />
          <TabButton name="Download & Texture" id="download" activeTab={activeTab} onClick={setActiveTab} />
          <TabButton name={`Reviews (${reviews.length})`} id="reviews" activeTab={activeTab} onClick={setActiveTab} />
        </div>
        <div>
          {activeTab === 'explanation' && (
            <article className="prose prose-invert max-w-none text-gray-300" dangerouslySetInnerHTML={{ __html: modData.explanation.replace(/\n/g, '<br />') }} />
          )}
          {activeTab === 'code' && (
            <div>
              {modData.scripts.main && <CodeBlock fileName="behavior_pack/scripts/main.js" code={modData.scripts.main} language="javascript" />}
              <CodeBlock fileName="behavior_pack/manifest.json" code={modData.behaviorPack.manifest} language="json" />
              <CodeBlock fileName={`behavior_pack/items/${modData.modName}.json`} code={modData.behaviorPack.item} language="json" />
              <CodeBlock fileName="resource_pack/manifest.json" code={modData.resourcePack.manifest} language="json" />
              <CodeBlock fileName={`resource_pack/items/${modData.modName}.json`} code={modData.resourcePack.items} language="json" />
            </div>
          )}
          {activeTab === 'download' && (
            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* Texture & Pack Icon */}
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-mc-blue mb-2">Item Texture</h3>
                  <div className="bg-mc-dark p-2 rounded-lg border border-mc-light-gray inline-block">
                    <div className="w-24 h-24" style={{ imageRendering: 'pixelated' }} dangerouslySetInnerHTML={{ __html: modData.texture_svg }} />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-mc-blue mb-2">Pack Icon</h3>
                  <div className="bg-mc-dark p-2 rounded-lg border border-mc-light-gray inline-block">
                    <img src={`data:image/png;base64,${modData.pack_icon_base64}`} alt="Generated Pack Icon" className="w-24 h-24 rounded" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {modData.requiresExperimental && (
                  <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-4 rounded-lg">
                    <h4 className="font-bold text-yellow-200">Experimental Features Required</h4>
                    <p className="text-sm mt-1">This mod uses scripting. Enable <strong>Beta APIs</strong> for it to work.</p>
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-mc-blue mb-2">Download Mod Pack</h3>
                  <p className="text-sm text-gray-400 mb-4">Click below to download the complete <code className="bg-mc-dark px-1 rounded">.mcaddon</code> file.</p>
                  <button onClick={handleDownloadMcaddon} className="w-full flex items-center justify-center gap-3 px-6 py-3 font-bold text-white bg-mc-blue rounded-md shadow-md hover:bg-opacity-90 transition-all">
                    <DownloadIcon className="w-5 h-5" />
                    <span>Download {modData.modName}.mcaddon</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'reviews' && (
            <div className="space-y-8">
              <div className="bg-mc-dark/50 p-4 rounded-lg border border-mc-light-gray">
                <h3 className="text-lg font-semibold text-mc-blue mb-3">Leave a Review</h3>
                <div className="flex items-center mb-3">
                  <span className="text-sm text-gray-400 mr-3">Your Rating:</span>
                  <div className="flex">
                    {[1,2,3,4,5].map(star => (
                      <button key={star} onClick={() => setUserRating(star)} className="text-gray-500 hover:text-yellow-400">
                        <StarIcon className={`w-6 h-6 ${userRating >= star ? 'text-yellow-400' : 'text-gray-600'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={userFeedback}
                  onChange={e => setUserFeedback(e.target.value)}
                  placeholder="Tell us what you think..."
                  className="w-full h-24 p-2 bg-mc-dark text-gray-200 rounded-md border border-mc-light-gray focus:ring-2 focus:ring-mc-blue focus:outline-none transition"
                  disabled={reviewStatus === 'moderating' || reviewStatus === 'success'}
                />
                <div className="mt-3 flex items-center justify-between">
                  <div className="h-5">
                    {reviewStatus === 'success' && <p className="text-sm text-mc-green">Thank you! Review published.</p>}
                    {reviewStatus === 'error' && <p className="text-sm text-red-400">{reviewError}</p>}
                    {reviewStatus === 'moderating' && <p className="text-sm text-yellow-400 animate-pulse">Checking review...</p>}
                  </div>
                  <button
                    onClick={handleReviewSubmit}
                    disabled={reviewStatus === 'moderating' || reviewStatus === 'success' || userRating === 0 || !userFeedback.trim()}
                    className="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-mc-blue rounded-md hover:bg-opacity-90 transition-all disabled:bg-mc-light-gray disabled:cursor-not-allowed"
                  >
                    Submit Review
                  </button>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-mc-blue mb-4">Community Feedback</h3>
                {reviews.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No reviews yet.</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review, idx) => (
                      <div key={idx} className="bg-mc-dark/30 p-4 rounded-lg border border-mc-light-gray">
                        <div className="flex items-center mb-2">
                          {[1,2,3,4,5].map(star => (
                            <StarIcon key={star} className={`w-5 h-5 ${review.rating >= star ? 'text-yellow-400' : 'text-gray-600'}`} />
                          ))}
                        </div>
                        <p className="text-gray-300">{review.feedback}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>MCPE ModForge AI</title>
        <meta name="description" content="Turn your Minecraft ideas into reality. Just describe your mod." />
      </Head>
      <div className="min-h-screen bg-mc-dark flex flex-col items-center p-4 sm:p-8">
        <main className="w-full max-w-4xl mx-auto flex flex-col items-center space-y-8">
          <header className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
              <span className="text-mc-green">MCPE</span> ModForge AI
            </h1>
            <p className="mt-2 text-lg text-gray-400">Turn your Minecraft ideas into reality. Just describe your mod.</p>
          </header>

          <div className="w-full p-4 bg-mc-gray/30 border border-mc-light-gray rounded-lg shadow-lg">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g., 'A sword that shoots lightning' or 'boots that let you walk on water'"
              className="w-full h-32 p-3 bg-mc-dark text-gray-200 rounded-md border border-mc-light-gray focus:ring-2 focus:ring-mc-green focus:outline-none transition resize-none"
              disabled={isLoading}
            />
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-400 mr-2">Try an example:</span>
                {samplePrompts.map(p => (
                  <button
                    key={p}
                    onClick={() => handleSamplePrompt(p)}
                    className="px-2 py-1 text-xs font-medium bg-mc-light-gray hover:bg-mc-green hover:text-mc-dark rounded-md transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={isLoading || !prompt}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-bold text-white bg-mc-green rounded-md shadow-lg hover:bg-opacity-90 transition-all disabled:bg-mc-light-gray disabled:cursor-not-allowed disabled:shadow-none animate-pulse-glow disabled:animate-none"
              >
                <SparklesIcon className="w-5 h-5" />
                <span>{isLoading ? 'Generating...' : 'Forge Mod'}</span>
              </button>
            </div>
          </div>

          <div className="w-full">{renderOutput()}</div>
        </main>
        <footer className="w-full max-w-4xl mx-auto text-center py-4 mt-8">
          <p className="text-xs text-gray-500">
            Powered by Google Gemini. This is an experimental tool. Generated mods may require manual adjustments.
          </p>
        </footer>
      </div>
    </>
  );
};

// --- TabButton Component ---
interface TabButtonProps {
  name: string;
  id: OutputTab;
  activeTab: OutputTab;
  onClick: (id: OutputTab) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ name, id, activeTab, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
      activeTab === id ? 'text-mc-green border-b-2 border-mc-green' : 'text-gray-400 hover:text-white'
    }`}
  >
    {name}
  </button>
);

// --- DownloadButton Component ---
interface DownloadButtonProps {
  label: string;
  onClick: () => void;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 text-sm font-mono text-gray-300 bg-mc-gray hover:bg-mc-light-gray rounded-md transition-colors"
  >
    <span>{label}</span>
    <DownloadIcon className="w-4 h-4" />
  </button>
);

export default HomePage;

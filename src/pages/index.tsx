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

// Declare JSZip for downloading .mcaddon
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
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modData, setModData] = useState<ModData | null>(null);
  const [activeTab, setActiveTab] = useState<OutputTab>('explanation');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [userRating, setUserRating] = useState(0);
  const [userFeedback, setUserFeedback] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'idle'|'moderating'|'success'|'error'>('idle');
  const [reviewError, setReviewError] = useState<string|null>(null);

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
      setError(e instanceof Error ? e.message : 'Unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [prompt, isLoading]);

  const handleSamplePrompt = (sample: string) => setPrompt(sample);

  const handleReviewSubmit = useCallback(async () => {
    if (userRating === 0 || !userFeedback.trim()) {
      setReviewError("Please provide rating and feedback.");
      setReviewStatus('error');
      return;
    }
    setReviewStatus('moderating');
    setReviewError(null);

    const result = await moderateReview(userFeedback);
    if (result === 'SAFE') {
      setReviews(prev => [...prev, { rating: userRating, feedback: userFeedback }]);
      setUserRating(0);
      setUserFeedback('');
      setReviewStatus('success');
      setTimeout(() => setReviewStatus('idle'), 3000);
    } else {
      setReviewError("Your review was flagged as inappropriate.");
      setReviewStatus('error');
    }
  }, [userRating, userFeedback]);

  const handleDownloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadBlob = (filename: string, blob: Blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const svgToPngBlob = (svgString: string, width: number, height: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failed'));
      ctx.imageSmoothingEnabled = false;

      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Blob conversion failed'));
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

      zip.file(`behavior_pack/manifest.json`, modData.behaviorPack.manifest);
      zip.file(`behavior_pack/items/${modData.modName}.json`, modData.behaviorPack.item);
      if (modData.scripts.main) zip.file(`behavior_pack/scripts/main.js`, modData.scripts.main);

      zip.file(`resource_pack/manifest.json`, modData.resourcePack.manifest);
      zip.file(`resource_pack/items/${modData.modName}.json`, modData.resourcePack.items);

      const textureBlob = await svgToPngBlob(modData.texture_svg, 16, 16);
      zip.file(`resource_pack/${modData.resourcePack.textures.item_texture}`, textureBlob);

      if (modData.pack_icon_base64) {
        const bytes = atob(modData.pack_icon_base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: 'image/png' });
        zip.file(`behavior_pack/pack_icon.png`, blob);
        zip.file(`resource_pack/pack_icon.png`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(`${modData.modName}.mcaddon`, zipBlob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating .mcaddon');
    }
  }, [modData]);

  const renderOutput = () => {
    if (isLoading) return <Loader />;
    if (error) return (
      <div className="text-red-300 bg-red-900/50 p-6 rounded-lg border border-red-600 flex items-start gap-4">
        <ErrorIcon className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
        <div>
          <h3 className="text-xl font-bold text-red-300 mb-2">Mod Generation Failed</h3>
          <p>{error}</p>
        </div>
      </div>
    );
    if (!modData) return null;

    return (
      <div className="bg-mc-gray/50 border border-mc-light-gray rounded-lg p-6 w-full">
        {/* Tabs */}
        <div className="flex border-b border-mc-light-gray mb-4 overflow-x-auto">
          <TabButton name="Explanation" id="explanation" activeTab={activeTab} onClick={setActiveTab} />
          <TabButton name="Code Preview" id="code" activeTab={activeTab} onClick={setActiveTab} />
          <TabButton name="Download" id="download" activeTab={activeTab} onClick={setActiveTab} />
          <TabButton name={`Reviews (${reviews.length})`} id="reviews" activeTab={activeTab} onClick={setActiveTab} />
        </div>
        <div>
          {activeTab === 'explanation' && (
            <article className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: modData.explanation.replace(/\n/g, '<br/>') }} />
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
            <div className="space-y-4">
              <button
                onClick={handleDownloadMcaddon}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 font-bold text-white bg-mc-green rounded-md shadow-lg hover:bg-opacity-90 transition-all"
              >
                <DownloadIcon className="w-5 h-5" /> Download {modData.modName}.mcaddon
              </button>
            </div>
          )}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="bg-mc-dark/50 p-4 rounded-lg border border-mc-light-gray">
                <h3 className="text-lg font-semibold text-mc-green mb-2">Leave a Review</h3>
                <div className="flex items-center mb-2">
                  <span className="text-sm text-gray-400 mr-2">Rating:</span>
                  {[1,2,3,4,5].map(star => (
                    <button key={star} onClick={() => setUserRating(star)} className="text-gray-500 hover:text-yellow-400">
                      <StarIcon className={`w-5 h-5 ${userRating>=star?'text-yellow-400':'text-gray-600'}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={userFeedback}
                  onChange={e => setUserFeedback(e.target.value)}
                  placeholder="Write your feedback..."
                  className="w-full p-2 bg-mc-dark text-gray-200 rounded-md border border-mc-light-gray focus:ring-2 focus:ring-mc-green transition resize-none"
                  disabled={reviewStatus==='moderating'||reviewStatus==='success'}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={handleReviewSubmit}
                    disabled={reviewStatus==='moderating'||reviewStatus==='success'}
                    className="px-4 py-2 bg-mc-green text-white font-bold rounded-md hover:bg-opacity-90 disabled:bg-gray-700 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
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
      </Head>
      <div className="min-h-screen bg-mc-dark flex flex-col items-center p-4 sm:p-8">
        <main className="w-full max-w-4xl flex flex-col items-center space-y-8">
          <header className="text-center">
            <h1 className="text-5xl font-bold text-white">
              <span className="text-mc-green">MCPE</span> ModForge AI
            </h1>
            <p className="text-gray-400 mt-2">Turn your Minecraft ideas into reality.</p>
          </header>

          <div className="w-full p-4 bg-mc-gray/30 border border-mc-light-gray rounded-lg shadow-lg">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe your mod..."
              className="w-full h-32 p-3 bg-mc-dark text-gray-200 rounded-md border border-mc-light-gray focus:ring-2 focus:ring-mc-green resize-none transition"
              disabled={isLoading}
            />
            <div className="mt-3 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <span className="text-gray-400 text-sm">Try examples:</span>
                {samplePrompts.map(p => (
                  <button
                    key={p}
                    onClick={() => handleSamplePrompt(p)}
                    className="px-2 py-1 text-xs rounded-md bg-mc-light-gray hover:bg-mc-green hover:text-mc-dark transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={isLoading||!prompt}
                className="flex items-center gap-2 px-6 py-3 bg-mc-green text-white font-bold rounded-md shadow-lg hover:bg-opacity-90 disabled:bg-gray-700 disabled:cursor-not-allowed animate-pulse-glow"
              >
                <SparklesIcon className="w-5 h-5" />
                {isLoading?'Generating...':'Forge Mod'}
              </button>
            </div>
          </div>

          <div className="w-full">{renderOutput()}</div>
        </main>
      </div>
    </>
  );
};

interface TabButtonProps {
  name: string;
  id: OutputTab;
  activeTab: OutputTab;
  onClick: (id: OutputTab) => void;
}

const TabButton: React.FC<TabButtonProps> =

    <DownloadIcon className="w-4 h-4" />
  </button>
);

export default HomePage;

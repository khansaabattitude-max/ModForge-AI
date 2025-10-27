
import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8 bg-mc-gray/30 rounded-lg">
      <div className="w-16 h-16 border-4 border-mc-green border-t-transparent rounded-full animate-spin"></div>
      <p className="text-mc-green text-lg font-semibold">Forging your mod...</p>
      <p className="text-gray-400 text-sm max-w-sm text-center">The AI is parsing your idea, generating code, and designing textures. This might take a moment.</p>
    </div>
  );
};

export default Loader;

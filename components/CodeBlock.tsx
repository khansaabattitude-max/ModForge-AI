
import React, { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language: 'javascript' | 'json';
  fileName: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, fileName }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-mc-dark rounded-lg overflow-hidden border border-mc-light-gray my-4">
      <div className="flex justify-between items-center px-4 py-2 bg-mc-gray">
        <span className="text-sm font-mono text-gray-300">{fileName}</span>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs font-semibold text-white bg-mc-light-gray hover:bg-mc-green hover:text-mc-dark rounded transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto">
        <code className={`language-${language} font-mono`}>{code}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;

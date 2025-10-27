import type { ModData } from '../types';

async function handleApiResponse(response: Response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    return response.json();
}

export const generateMod = async (prompt: string): Promise<ModData> => {
  const response = await fetch('/api/modforge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      action: 'generateMod', 
      payload: { prompt } 
    }),
  });
  return handleApiResponse(response);
};

export const moderateReview = async (feedback: string): Promise<'SAFE' | 'UNSAFE'> => {
  try {
    const response = await fetch('/api/modforge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'moderateReview', 
        payload: { feedback } 
      }),
    });
    const result = await handleApiResponse(response);
    return result.decision;
  } catch (error) {
    console.error("Error moderating review:", error);
    return 'SAFE'; // Fail open on network/API error
  }
};

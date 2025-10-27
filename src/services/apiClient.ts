// This file contains functions for the frontend to communicate with the backend API.
// It uses fetch() to send requests and receive responses, keeping network logic separate from UI components.

import type { ModData } from '../types';

// NOTE: In a real app, these functions would make network requests to a running server.
// For this environment, we are simulating the backend call by importing and calling the server-side logic directly.
// This is NOT how a production app would be built, but it allows the code to function here.
// The key takeaway is the architectural separation.
import { handleGenerateMod, handleModerateReview } from '../../api/modforge';


export const generateMod = async (prompt: string): Promise<ModData> => {
  // Production code would look like this:
  /*
  const response = await fetch('/api/generate-mod', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to generate mod');
  }
  return response.json();
  */

  // Simulating the backend call for this environment:
  try {
    return await handleGenerateMod(prompt);
  } catch (error) {
     console.error("Error in simulated backend call for generateMod:", error);
     throw new Error(error instanceof Error ? error.message : "An unknown error occurred during generation.");
  }
};

export const moderateReview = async (feedback: string): Promise<'SAFE' | 'UNSAFE'> => {
  // Production code would look like this:
  /*
  const response = await fetch('/api/moderate-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  });
  if (!response.ok) {
    // Fail open on moderation error
    return 'SAFE';
  }
  const result = await response.json();
  return result.decision;
  */
  
  // Simulating the backend call for this environment:
  try {
     const result = await handleModerateReview(feedback);
     return result.decision;
  } catch (error) {
    console.error("Error in simulated backend call for moderateReview:", error);
    return 'SAFE'; // Fail open
  }
};

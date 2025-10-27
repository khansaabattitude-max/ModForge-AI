// IMPORTANT: This file represents a backend API endpoint.
// In a real-world deployment on Vercel or Render, this code would run in a serverless function.
// The frontend would call this endpoint (e.g., /api/modforge) instead of calling the AI directly.
// This is the ONLY place where the API key is used, ensuring it's never exposed to the client browser.

import { GoogleGenAI, Type } from "@google/genai";
import type { ModData } from '../src/types';

// This function simulates how a backend would securely initialize the AI client.
function getAI() {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set on the server");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

const modSchema = {
  type: Type.OBJECT,
  properties: {
    modName: { type: Type.STRING, description: "A short, camelCase name for the mod, like 'glowingTorch' or 'heavyAxe'." },
    explanation: { type: Type.STRING, description: "A detailed but easy-to-understand explanation of what the mod does and how the generated code works. Format this with markdown." },
    enchantments: {
      type: Type.ARRAY,
      description: "A list of enchantments to be applied to the item via script. Leave empty if no enchantments are requested.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "The enchantment ID, e.g., 'sharpness' or 'fire_aspect'." },
          level: { type: Type.INTEGER, description: "The level of the enchantment." }
        },
        required: ['id', 'level']
      }
    },
    behaviorPack: {
      type: Type.OBJECT,
      properties: {
        manifest: { type: Type.STRING, description: "JSON content for behavior pack manifest.json. Must contain valid, unique UUIDs." },
        item: { type: Type.STRING, description: "JSON content for the custom item in the behavior pack (e.g., glowing_torch.json)." },
      },
      required: ['manifest', 'item']
    },
    resourcePack: {
      type: Type.OBJECT,
      properties: {
        manifest: { type: Type.STRING, description: "JSON content for resource pack manifest.json. Must contain valid, unique UUIDs, different from the behavior pack." },
        items: { type: Type.STRING, description: "JSON content for the item definition in the resource pack (e.g., glowing_torch.json)." },
        textures: {
          type: Type.OBJECT,
          properties: {
            item_texture: { type: Type.STRING, description: "The filename for the item texture, e.g., 'textures/items/glowing_torch.png'" }
          },
          required: ['item_texture']
        },
      },
      required: ['manifest', 'items', 'textures']
    },
    scripts: {
      type: Type.OBJECT,
      properties: {
        main: { type: Type.STRING, description: "The main JavaScript code for the mod's logic, using the '@minecraft/server' module." }
      },
      required: ['main']
    },
    texture_svg: { type: Type.STRING, description: "A simple, pixel-art style, 16x16 SVG string representing the item's texture. Use a <svg viewBox='0 0 16 16'> and only use <path> elements with a fill color. Make it look like a Minecraft item." }
  },
  required: ['modName', 'explanation', 'enchantments', 'behaviorPack', 'resourcePack', 'scripts', 'texture_svg']
};

export async function handleGenerateMod(prompt: string): Promise<ModData> {
  const ai = getAI();
  // Step 1: Generate the core mod data
  const modGenResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Based on the user's request: "${prompt}", generate a complete MCPE mod. If the user requests any enchantments (e.g., "a sword with sharpness 5"), identify them and include them in the 'enchantments' array. Then, ensure the 'scripts/main.js' file contains logic to apply these specified enchantments to the custom item when it is created or given to a player. For example, the script could listen for an event to grant the enchanted custom item. Provide the output as a single, valid JSON object. Ensure all JSON and JavaScript content is provided as complete, escaped strings. Generate two different, valid UUIDs for the manifest files. The Minecraft version for the manifests should be modern, e.g., [1, 20, 0]. The item identifier should be in the format 'custom:item_name'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: modSchema,
    },
  });

  const jsonText = modGenResponse.text.trim();
  let modData: Omit<ModData, 'pack_icon_base64'> = JSON.parse(jsonText);

  // Step 2: Generate the cinematic pack icon
  const imagePrompt = `A cinematic, high-quality, realistic promotional image for a Minecraft mod. The mod's name is "${modData.modName}". The image should serve as a game icon, focusing on the central item described as: "${modData.explanation.substring(0, 250)}". Dramatic lighting, detailed texture.`;
  
  const imageResponse = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '1:1',
      },
  });

  const pack_icon_base64 = imageResponse.generatedImages[0].image.imageBytes;
  
  // Step 3: Combine and return
  return { ...modData, pack_icon_base64 };
}

export async function handleModerateReview(feedback: string): Promise<{ decision: 'SAFE' | 'UNSAFE' }> {
  const ai = getAI();
  const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following user-submitted review for toxic content, spam, or hate speech. Your response must be a single word: either 'SAFE' or 'UNSAFE'. Review: "${feedback}"`,
      config: { temperature: 0 },
  });

  const result = response.text.trim().toUpperCase();
  if (result.includes('SAFE')) return { decision: 'SAFE' };
  if (result.includes('UNSAFE')) return { decision: 'UNSAFE' };
  
  return { decision: 'SAFE' }; // Fail open
}
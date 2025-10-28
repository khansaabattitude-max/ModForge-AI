import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenAI, Type } from "@google/genai";
import type { ModData } from '../../types';

// Fix for TypeScript error TS2580 on process.env, as requested.
// API_KEY is included to prevent new errors in the getAI function.
declare var process: {
  env: {
    NEXT_PUBLIC_MODE: string;
    API_KEY: string | undefined;
  }
}

function getAI() {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set on the server. Please set it in your Vercel project settings.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

const modSchema = {
  type: Type.OBJECT,
  properties: {
    modName: { type: Type.STRING, description: "A short, camelCase name for the mod, like 'glowingTorch' or 'heavyAxe'." },
    explanation: { type: Type.STRING, description: "A detailed but easy-to-understand explanation of what the mod does and how the generated code works. Format this with markdown." },
    requiresExperimental: { type: Type.BOOLEAN, description: "Set to true if the mod uses the '@minecraft/server' module (has a scripts/main.js file), otherwise false." },
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
        main: { type: Type.STRING, description: "The main JavaScript code for the mod's logic, using the '@minecraft/server' module. Should be an empty string if requiresExperimental is false." }
      },
      required: ['main']
    },
    texture_svg: { type: Type.STRING, description: "A simple, pixel-art style, 16x16 SVG string representing the item's texture. Use a <svg viewBox='0 0 16 16'> and only use <path> elements with a[...]"},
  required: ['modName', 'explanation', 'requiresExperimental', 'enchantments', 'behaviorPack', 'resourcePack', 'scripts', 'texture_svg']
};

async function handleGenerateMod(prompt: string): Promise<ModData> {
  const ai = getAI();
  const modGenResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Your task is to act as the ModForge AI core. You must generate complete, correct, and instantly deployable code for a Minecraft Bedrock Add-on based on the user's prompt: "${prompt}[...]`,
    config: {
      responseMimeType: "application/json",
      responseSchema: modSchema,
    },
  });

  const jsonText = modGenResponse.text.trim();
  let modData: Omit<ModData, 'pack_icon_base64'>;

  try {
      modData = JSON.parse(jsonText);
  } catch(e) {
      console.error("Failed to parse AI JSON response:", jsonText);
      throw new Error("The AI returned a malformed response. Please try a different prompt.");
  }
  
  const imagePrompt = `A cinematic, high-quality, realistic promotional image for a Minecraft mod. The mod's name is "${modData.modName}". The image should serve as a game icon, focusing on the c[...]`;
  
  const imageResponse = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: imagePrompt,
      config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '1:1' },
  });

  const pack_icon_base64 = imageResponse.generatedImages[0].image.imageBytes;
  
  return { ...modData, pack_icon_base64 };
}

async function handleModerateReview(feedback: string): Promise<{ decision: 'SAFE' | 'UNSAFE' }> {
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

// MOCK DATA for a working demo mode
const demoModData: ModData = {
    modName: 'demoGlowingSword',
    explanation: `This is a **Glowing Sword** generated in demo mode. When held, it emits a faint light.
    \nThis is just a mock response to show the app's functionality without using the real AI.`,
    requiresExperimental: true,
    enchantments: [{ id: 'sharpness', level: 1 }],
    behaviorPack: {
        manifest: JSON.stringify({ format_version: 2, header: { name: "Demo Sword BP", description: "Demo Behavior Pack", uuid: "a1b2c3d4-e5f6-7890-1234-567890abcdef", version: [1,0,0], min_engin[...] }),
        item: JSON.stringify({ "format_version": "1.16.100", "minecraft:item": { "description": { "identifier": "demo:glowing_sword" }, "components": { "minecraft:max_stack_size": 1, "minecraft:h[...] })
    },
    resourcePack: {
        manifest: JSON.stringify({ format_version: 2, header: { name: "Demo Sword RP", description: "Demo Resource Pack", uuid: "c3d4e5f6-a7b8-9012-3456-7890abcdef12", version: [1,0,0], min_engin[...] }),
        items: JSON.stringify({ "format_version": "1.16.100", "minecraft:item": { "description": { "identifier": "demo:glowing_sword", "category": "Equipment" }, "components": { "minecraft:icon":[...] }),
        textures: { item_texture: 'textures/items/glowing_sword.png' }
    },
    scripts: {
        main: `import { world, system } from '@minecraft/server';\n\n// Demo Script: Make player holding the sword glow\nsystem.runInterval(() => {\n  for (const player of world.getAllPlayers()) [...]\n},`
    },
    texture_svg: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M7 2L7 12L6 13L5 13L5 14L4 15L5 16L11 16L12 15L11 14L11 13L10 13L9 12L9 2L7 2ZM8 0L8 1L7 2L9 2L8 1V0Z" fill=[...]`,
    pack_icon_base64: 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAaklEQVR42u3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA[...]'
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // === Requested demo-mode logic (placed immediately inside handler) ===
    if (process.env.NEXT_PUBLIC_MODE === 'demo') {
        const { prompt } = req.body;
        
        // Demo mode: Simulate a successful response
        return res.status(200).json({
            message: `⚙️ Demo Mode Active: Mod idea generated for: ${prompt}. (No real AI used.)`,
            preview: "demo_mod_file.mcaddon"
        });
    }
    // === end demo-mode block ===

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action, payload } = req.body;

    try {
        if (action === 'generateMod') {
            if (!payload || typeof payload.prompt !== 'string') {
                return res.status(400).json({ error: 'Invalid payload for generateMod' });
            }
            const modData = await handleGenerateMod(payload.prompt);
            return res.status(200).json(modData);
        } else if (action === 'moderateReview') {
            if (!payload || typeof payload.feedback !== 'string') {
                return res.status(400).json({ error: 'Invalid payload for moderateReview' });
            }
            const result = await handleModerateReview(payload.feedback);
            return res.status(200).json(result);
        } else {
            return res.status(400).json({ error: 'Invalid action specified' });
        }
    } catch (error) {
        console.error(`Error in API route for action "${action}":`, error);
        const message = error instanceof Error ? error.message : "An unknown server error occurred.";
        return res.status(500).json({ error: message });
    }
}
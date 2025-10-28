import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenAI, Type } from "@google/genai";
import type { ModData } from '../../types';

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
    texture_svg: { type: Type.STRING, description: "A simple, pixel-art style, 16x16 SVG string representing the item's texture. Use a <svg viewBox='0 0 16 16'> and only use <path> elements with a fill color. Make it look like a Minecraft item." }
  },
  required: ['modName', 'explanation', 'requiresExperimental', 'enchantments', 'behaviorPack', 'resourcePack', 'scripts', 'texture_svg']
};

async function handleGenerateMod(prompt: string): Promise<ModData> {
  const ai = getAI();
  const modGenResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Your task is to act as the ModForge AI core. You must generate complete, correct, and instantly deployable code for a Minecraft Bedrock Add-on based on the user's prompt: "${prompt}".

**CRITICAL INSTRUCTIONS: Output Integrity and Verification**
1.  **Manifest Integrity:**
    - Generate two unique, valid UUIDs.
    - Create a behavior pack \`manifest.json\` and a resource pack \`manifest.json\`.
    - **The behavior pack's manifest MUST depend on the resource pack's UUID, and the resource pack's manifest MUST depend on the behavior pack's UUID.** This ensures Minecraft loads the packs together correctly.
    - Both manifests MUST use \`"format_version": 2\` and have a \`min_engine_version\` of at least \`[1, 20, 0]\`.

2.  **Scripting Path Validation:**
    - If the mod's logic requires scripting, you MUST generate a \`scripts/main.js\` file using the '@minecraft/server' module.
    - When a script is generated, you MUST:
      a) Set the \`requiresExperimental\` flag in the output to \`true\`.
      b) Include a "modules" entry of type "script" in the behavior pack's manifest, with the "entry" path set exactly to "scripts/main.js".
    - If no scripting is needed, the "main" script content must be an empty string, no "script" module should be in the manifest, and \`requiresExperimental\` must be \`false\`.

3.  **File Path Consistency:**
    - Ensure all file paths are correct. The item texture filename in the resource pack's \`items\` JSON must exactly match the \`item_texture\` filename provided.
    - The item identifier (e.g., \`custom:glowing_torch\`) must be consistent across all relevant files.

4.  **Enchantments:**
    - If the user requests enchantments, populate the 'enchantments' array and ensure the 'scripts/main.js' file contains the logic to apply them.

5.  **Final Output:**
    - Provide the entire output as a single, valid JSON object matching the provided schema. All JSON and JavaScript content must be complete, escaped strings.`,
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
  
  const imagePrompt = `A cinematic, high-quality, realistic promotional image for a Minecraft mod. The mod's name is "${modData.modName}". The image should serve as a game icon, focusing on the central item described as: "${modData.explanation.substring(0, 250)}". Dramatic lighting, detailed texture.`;
  
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NEXT_PUBLIC_MODE === 'demo') {
        const { action, payload } = req.body;
        if (action === 'generateMod') {
            const prompt = payload?.prompt || '[no prompt provided]';
            return res.status(200).json({
                message: `⚙️ Demo Mode Active: Mod idea generated for: ${prompt}. (No real AI used.)`,
                preview: 'demo_mod_file.mcaddon'
            });
        }
        if (action === 'moderateReview') {
            return res.status(200).json({ decision: 'SAFE' });
        }
    }

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

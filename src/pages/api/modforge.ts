
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

// MOCK DATA for a working demo mode
const demoModData: ModData = {
    modName: 'demoGlowingSword',
    explanation: `This is a **Glowing Sword** generated in demo mode. When held, it emits a faint light.
    \nThis is just a mock response to show the app's functionality without using the real AI.`,
    requiresExperimental: true,
    enchantments: [{ id: 'sharpness', level: 1 }],
    behaviorPack: {
        manifest: JSON.stringify({ format_version: 2, header: { name: "Demo Sword BP", description: "Demo Behavior Pack", uuid: "a1b2c3d4-e5f6-7890-1234-567890abcdef", version: [1,0,0], min_engine_version: [1,20,0] }, modules: [{ type: "script", uuid: "b2c3d4e5-f6a7-8901-2345-67890abcdef1", version: [1,0,0], entry: "scripts/main.js" }], dependencies: [{ uuid: "c3d4e5f6-a7b8-9012-3456-7890abcdef12", version: [1,0,0] }] }, null, 2),
        item: JSON.stringify({ "format_version": "1.16.100", "minecraft:item": { "description": { "identifier": "demo:glowing_sword" }, "components": { "minecraft:max_stack_size": 1, "minecraft:hand_equipped": true, "minecraft:damage": 5 } } }, null, 2)
    },
    resourcePack: {
        manifest: JSON.stringify({ format_version: 2, header: { name: "Demo Sword RP", description: "Demo Resource Pack", uuid: "c3d4e5f6-a7b8-9012-3456-7890abcdef12", version: [1,0,0], min_engine_version: [1,20,0] }, modules: [{ type: "resources", uuid: "d4e5f6a7-b8c9-0123-4567-890abcdef123", version: [1,0,0] }], dependencies: [{ uuid: "a1b2c3d4-e5f6-7890-1234-567890abcdef", version: [1,0,0] }] }, null, 2),
        items: JSON.stringify({ "format_version": "1.16.100", "minecraft:item": { "description": { "identifier": "demo:glowing_sword", "category": "Equipment" }, "components": { "minecraft:icon": { "texture": "glowing_sword" } } } }, null, 2),
        textures: { item_texture: 'textures/items/glowing_sword.png' }
    },
    scripts: {
        main: `import { world, system } from '@minecraft/server';\n\n// Demo Script: Make player holding the sword glow\nsystem.runInterval(() => {\n  for (const player of world.getAllPlayers()) {\n    const item = player.getComponent('inventory').container.getItem(player.selectedSlot);\n    if (item?.typeId === 'demo:glowing_sword') {\n      player.addEffect('night_vision', 220, { showParticles: false });\n    } \n  }\n});`
    },
    texture_svg: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M7 2L7 12L6 13L5 13L5 14L4 15L5 16L11 16L12 15L11 14L11 13L10 13L9 12L9 2L7 2ZM8 0L8 1L7 2L9 2L8 1V0Z" fill="#c0c0c0"/><path d="M8 2L8 12L7 13L9 13L8 12V2Z" fill="#f0f0f0"/><path d="M8 4L8 10" fill="#a0a0ff"/><path d="M8 3L8 4" fill="#5555ff"/><path d="M8 10L8 11" fill="#5555ff"/></svg>`,
    pack_icon_base64: 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAaklEQVR42u3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBPAAB6GFmSAAAAABJRU5ErkJggg=='
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // This demo mode implementation returns a valid mock object to prevent client-side errors,
    // which is an improvement on the previous demo logic.
    if (process.env.NEXT_PUBLIC_MODE === 'demo') {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        const { action } = req.body;
        if (action === 'generateMod') {
            return res.status(200).json(demoModData);
        }
        if (action === 'moderateReview') {
            return res.status(200).json({ decision: 'SAFE' });
        }
        return res.status(400).json({ error: 'Unknown action in demo mode' });
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

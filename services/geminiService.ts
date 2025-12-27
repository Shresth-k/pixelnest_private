import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generatePixelAsset = async (prompt: string): Promise<string | null> => {
  try {
    const ai = getClient();
    
    // We use gemini-2.5-flash-image for image generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a pixel art asset for an RPG game on a white background. The style should be cute, 16-bit or 32-bit. Object: ${prompt}`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export const removeBackgroundWithAI = async (base64Image: string): Promise<string | null> => {
  try {
    const ai = getClient();
    const base64Data = base64Image.split(',')[1]; // Remove header

    // Using gemini-2.5-flash-image for editing/masking task
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          },
          {
            text: "Remove the background from this image. Return the main object exactly as is but on a transparent background. Do not alter the object's pixel art style.",
          },
        ],
      },
      config: {
        // No special config needed, it returns an image by default for image generation/edit tasks
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini BG Removal Error:", error);
    return null; // Fail gracefully
  }
};
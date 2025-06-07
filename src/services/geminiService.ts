import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

// Initialize the Google Generative AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Configure the safety settings
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export class GeminiService {
  /**
   * Generate a text response using Gemini
   */
  static async generateText(prompt: string): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-pro",
        safetySettings,
      });
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating text with Gemini:', error);
      throw error;
    }
  }

  /**
   * Generate text response with provided context
   */
  static async generateWithContext(
    prompt: string, 
    context: Record<string, any>
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-pro",
        safetySettings,
      });
      
      const contextStr = JSON.stringify(context);
      const fullPrompt = `Context: ${contextStr}\n\nPrompt: ${prompt}`;
      
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating text with context using Gemini:', error);
      throw error;
    }
  }

  /**
   * Generate an image using Gemini 2.0 Flash Preview Image Generation
   */
  static async generateImage(prompt: string): Promise<string> {
    try {
      console.log('Generating image with Gemini REST API...');
      console.log('Prompt:', prompt);
      
      // Use REST API directly since SDK doesn't support responseModalities
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Please generate an image of: ${prompt}. Also provide a brief description of the image you created.`
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096
        }
      };
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      console.log('Gemini response received, processing...');
      
      // Check for image data in the response
      const candidates = data.candidates;
      if (candidates && candidates.length > 0) {
        const parts = candidates[0].content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
              console.log('Found image data in response');
              
              // Save the image locally
              const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
              const fileName = `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${this.getImageExtension(part.inlineData.mimeType)}`;
              const uploadsDir = path.join(process.cwd(), 'uploads', 'recipes');
              
              // Ensure uploads directory exists
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }
              
              const filePath = path.join(uploadsDir, fileName);
              fs.writeFileSync(filePath, imageBuffer);
              
              const imageUrl = `/uploads/recipes/${fileName}`;
              console.log('Image saved successfully:', imageUrl);
              
              return imageUrl;
            }
          }
        }
      }
      
      // Log response for debugging
      console.log('No image found in response');
      console.log('Response data:', JSON.stringify(data, null, 2));
      
      throw new Error('No image data received from Gemini');
      
    } catch (error) {
      console.error('Error generating image with Gemini:', error);
      throw error;
    }
  }

  /**
   * Generate recipe image with specific styling prompt
   */
  static async generateRecipeImage(recipeName: string, description: string, ingredients: string[]): Promise<string> {
    const prompt = `Generate a high-quality, appetizing food photography image of "${recipeName}". 
    
    Description: ${description}
    
    Key ingredients: ${ingredients.slice(0, 5).join(', ')}
    
    Style: Professional food photography, well-lit, natural lighting, clean appetizing presentation, restaurant-quality plating, vibrant colors, clean white or wooden background, no text or watermarks, make it look delicious and Instagram-worthy.`;
    
    return await this.generateImage(prompt);
  }

  /**
   * Get file extension from MIME type
   */
  private static getImageExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    
    return mimeToExt[mimeType] || 'jpg';
  }

  /**
   * Extract JSON from a response that might be wrapped in markdown code blocks
   */
  static extractJsonFromResponse(response: string): string {
    let jsonStr = response;
    
    if (response.includes('```')) {
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const match = response.match(codeBlockRegex);
      
      if (match && match[1]) {
        jsonStr = match[1].trim();
      }
    }
    
    return jsonStr;
  }
}
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
      // Get the text-only model
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
      
      // Prepare context as a string
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
   * Generate an image using Gemini Image Generation
   */
  static async generateImage(prompt: string): Promise<string> {
    try {
      console.log('Generating image with prompt:', prompt);
      
      // Get the image generation model
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-preview-image-generation",
        safetySettings,
      });
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      
      // Get the image data
      const imageData = response.candidates?.[0]?.content?.parts?.[0];
      
      if (!imageData || !imageData.inlineData) {
        throw new Error('No image data received from Gemini');
      }
      
      // Save the image locally
      const imageBuffer = Buffer.from(imageData.inlineData.data, 'base64');
      const fileName = `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${this.getImageExtension(imageData.inlineData.mimeType)}`;
      const uploadsDir = path.join(process.cwd(), 'uploads', 'recipes');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, imageBuffer);
      
      // Return the URL path that can be accessed via your server
      const imageUrl = `/uploads/recipes/${fileName}`;
      console.log('Image saved successfully:', imageUrl);
      
      return imageUrl;
    } catch (error) {
      console.error('Error generating image with Gemini:', error);
      throw error;
    }
  }

  /**
   * Generate recipe image with specific styling prompt
   */
  static async generateRecipeImage(recipeName: string, description: string, ingredients: string[]): Promise<string> {
    // Create a detailed prompt for food photography
    const prompt = `Create a high-quality, appetizing food photography image of "${recipeName}". 
    
    Description: ${description}
    
    Key ingredients visible: ${ingredients.slice(0, 5).join(', ')}
    
    Style requirements:
    - Professional food photography
    - Well-lit, natural lighting
    - Clean, appetizing presentation
    - Restaurant-quality plating
    - Vibrant colors
    - Shallow depth of field
    - Top-down or 45-degree angle view
    - Clean white or wooden background
    - No text or watermarks
    - High resolution, sharp focus
    - Make it look delicious and Instagram-worthy
    
    The image should showcase the finished dish in an appealing way that would make someone want to cook and eat it.`;
    
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
    
    // Check if the response is wrapped in a code block
    if (response.includes('```')) {
      // Find code block markers
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const match = response.match(codeBlockRegex);
      
      if (match && match[1]) {
        // Extract just the JSON part
        jsonStr = match[1].trim();
      }
    }
    
    return jsonStr;
  }
}
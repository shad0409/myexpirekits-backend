import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
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
      // Get the text-only model (updated to use the correct model name)
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-pro-preview-05-06",
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
        model: "gemini-2.5-pro-preview-05-06",
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
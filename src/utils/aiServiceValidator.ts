/**
 * AI Service Validator
 * ====================
 * 
 * Validates that AI services are properly configured before attempting generation.
 * Helps provide clear error messages when API keys or services are not available.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_GEMINI_MODEL_ID } from '@/config/aiModels';

export interface AIServiceStatus {
  isConfigured: boolean;
  hasAPIKey: boolean;
  functionAvailable: boolean;
  error?: string;
}

/**
 * Check if the ai-code-assistant function is properly configured
 */
export async function validateAIService(): Promise<AIServiceStatus> {
  try {
    // Try a lightweight health check by invoking with minimal payload
    const { data, error } = await supabase.functions.invoke('ai-code-assistant', {
      body: {
        messages: [{ role: 'user', content: 'test' }],
        mode: 'creative',
        model: DEFAULT_GEMINI_MODEL_ID,
        maxTokens: 10
      }
    });

    // Check for specific error types
    if (error) {
      const errorMessage = error.message?.toLowerCase() || '';
      
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        return {
          isConfigured: false,
          hasAPIKey: false,
          functionAvailable: false,
          error: 'AI backend function "ai-code-assistant" was not found. Please redeploy the backend function.'
        };
      }
      
      if (errorMessage.includes('api key') || errorMessage.includes('not configured')) {
        return {
          isConfigured: false,
          hasAPIKey: false,
          functionAvailable: true,
          error: 'AI gateway key is not configured on the backend. Please refresh the managed AI gateway key.'
        };
      }
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        return {
          isConfigured: true,
          hasAPIKey: true,
          functionAvailable: true,
          error: 'Rate limit exceeded. Please wait a moment.'
        };
      }
      
      if (errorMessage.includes('credits') || errorMessage.includes('402')) {
        return {
          isConfigured: true,
          hasAPIKey: true,
          functionAvailable: true,
          error: 'No credits available. Please add credits to continue.'
        };
      }
    }

    // If we got here without error or with a valid response, service is configured
    return {
      isConfigured: true,
      hasAPIKey: true,
      functionAvailable: true
    };

  } catch (error) {
    console.error('[AIServiceValidator] Validation failed:', error);
    return {
      isConfigured: false,
      hasAPIKey: false,
      functionAvailable: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

/**
 * Validate and show user-friendly error if service is not available
 */
export async function ensureAIServiceAvailable(): Promise<boolean> {
  const status = await validateAIService();
  
  if (!status.isConfigured) {
    toast.error('AI Service Not Available', {
      description: status.error || 'AI service is not properly configured'
    });
    return false;
  }
  
  return true;
}

/**
 * Get a user-friendly error message from a Supabase function error
 */
export function getAIErrorMessage(error: any): string {
  const errorStr = error?.message?.toLowerCase() || JSON.stringify(error).toLowerCase();
  
  // Check for connection/network errors first
  if (errorStr.includes('failed to send') || errorStr.includes('failed to fetch') || errorStr.includes('network request failed')) {
    return 'Cannot connect to AI service. Please check your connection and retry after the backend function redeploys.';
  }
  
  if (errorStr.includes('not found') || errorStr.includes('404')) {
    return 'AI backend function not found. Please redeploy the backend function.';
  }
  
  if (errorStr.includes('api key') || errorStr.includes('not configured') || errorStr.includes('503')) {
    return 'AI service not configured. Please refresh the managed AI gateway key.';
  }
  
  if (errorStr.includes('rate limit') || errorStr.includes('429')) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  }
  
  if (errorStr.includes('credits') || errorStr.includes('402')) {
    return 'No credits available. Please add credits to continue using AI features.';
  }
  
  if (errorStr.includes('timeout')) {
    return 'Request timed out. Please try again with a simpler prompt.';
  }
  
  if (errorStr.includes('network')) {
    return 'Network error. Please check your internet connection.';
  }
  
  if (errorStr.includes('cors')) {
    return 'CORS error. The function may not be properly configured.';
  }
  
  return error?.message || 'An unexpected error occurred. Please try again.';
}

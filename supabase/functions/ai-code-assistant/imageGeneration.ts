/**
 * Image generation logic.
 * Extracted from index.ts lines 1128-1207.
 */

import { createImageGeneration, isImageGenerationConfigured } from '../_shared/ai/providerClient.ts';

export interface ImageGenerationResult {
  generatedImageUrl: string;
  imageHtml: string;
}

export async function generateImageIfNeeded(opts: {
  userPrompt: string;
  generateImage: boolean;
  imagePlacement?: string;
  fastTemplateReact: boolean;
}): Promise<ImageGenerationResult> {
  const result: ImageGenerationResult = { generatedImageUrl: '', imageHtml: '' };

  const imageKeywords = ['generate image', 'create image', 'generate a logo', 'create a logo', 'make a logo', 'add logo image', 'insert image'];
  const shouldGenerate = !opts.fastTemplateReact && (opts.generateImage || imageKeywords.some(kw => opts.userPrompt.includes(kw)));

  if (!shouldGenerate || !isImageGenerationConfigured()) return result;

  console.log('[AI-Code-Assistant] Generating image for request');
  const imagePromptMatch = opts.userPrompt.match(/(?:generate|create|add|place|insert)\s+(?:an?\s+)?(?:image|logo|photo|picture)\s+(?:of\s+)?(.+?)(?:\s+(?:in|at|on|to)\s+|$)/i);
  const imageDescription = imagePromptMatch?.[1] || opts.userPrompt.replace(/generate|create|add|place|insert|image|logo|photo|picture/gi, '').trim();

  let detectedPlacement = opts.imagePlacement || 'top-left';
  if (opts.userPrompt.includes('corner left') || opts.userPrompt.includes('top left')) detectedPlacement = 'top-left';
  else if (opts.userPrompt.includes('corner right') || opts.userPrompt.includes('top right')) detectedPlacement = 'top-right';
  else if (opts.userPrompt.includes('bottom left')) detectedPlacement = 'bottom-left';
  else if (opts.userPrompt.includes('bottom right')) detectedPlacement = 'bottom-right';
  else if (opts.userPrompt.includes('center')) detectedPlacement = 'center';
  else if (opts.userPrompt.includes('header')) detectedPlacement = 'top-left';
  else if (opts.userPrompt.includes('footer')) detectedPlacement = 'bottom-left';

  const isLogo = opts.userPrompt.includes('logo') || opts.userPrompt.includes('brand');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const imageResponse = await createImageGeneration({
      prompt: `${imageDescription}, ${isLogo ? 'clean professional logo design, minimal, vector style, transparent background' : 'high quality digital art'}`,
      size: '1024x1024',
      quality: 'low',
    }, controller.signal);
    clearTimeout(timeoutId);

    if (imageResponse.ok) {
      const imageText = await imageResponse.text();
      if (imageText && imageText.trim()) {
        try {
          const imageData = JSON.parse(imageText);
          const b64 = imageData.data?.[0]?.b64_json || '';
          const mimeType = imageData.data?.[0]?.mime_type || 'image/png';
          result.generatedImageUrl = b64 ? `data:${mimeType};base64,${b64}` : imageData.data?.[0]?.url || '';
          if (result.generatedImageUrl) {
            const placementStyles: Record<string, string> = {
              'top-left': 'position: absolute; top: 10px; left: 10px;',
              'top-center': 'position: absolute; top: 10px; left: 50%; transform: translateX(-50%);',
              'top-right': 'position: absolute; top: 10px; right: 10px;',
              'center': 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);',
              'bottom-left': 'position: absolute; bottom: 10px; left: 10px;',
              'bottom-right': 'position: absolute; bottom: 10px; right: 10px;',
            };
            const placementCss = placementStyles[detectedPlacement] || placementStyles['top-left'];
            const maxSize = isLogo ? 'max-width: 120px; max-height: 60px;' : 'max-width: 300px; max-height: 200px;';
            result.imageHtml = `
<!-- AI Generated Image -->
<div class="ai-image-container resizable-image" style="${placementCss} ${maxSize} z-index: 100;">
  <img src="${result.generatedImageUrl}" alt="${imageDescription}" class="w-full h-auto object-contain" />
</div>`;
            console.log('[AI-Code-Assistant] Image generated and placed at:', detectedPlacement);
          }
        } catch (parseErr) {
          console.error('[AI-Code-Assistant] Failed to parse image response:', parseErr);
        }
      }
    } else {
      console.warn('[AI-Code-Assistant] Image generation returned non-OK status:', imageResponse.status);
    }
  } catch (imageError) {
    if (imageError instanceof Error && imageError.name === 'AbortError') {
      console.warn('[AI-Code-Assistant] Image generation timed out');
    } else {
      console.error('[AI-Code-Assistant] Image generation failed:', imageError);
    }
  }

  return result;
}

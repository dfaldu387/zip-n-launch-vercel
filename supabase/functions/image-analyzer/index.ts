// @ts-nocheck
import { corsHeaders } from "../_shared/cors.ts";
import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1";

// Define a function to get the image buffer from a URL
async function getImageBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get the image buffer
    const imageBuffer = await getImageBuffer(imageUrl);

    // 1. Generate a caption (for alt text)
    const captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
    const captionOutput = await captioner(imageBuffer);
    const altText = captionOutput[0].generated_text;

    // 2. Generate tags using zero-shot image classification
    const classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-large-patch14');
    const candidateLabels = [
        'horse', 'rider', 'arena', 'show jumping', 'dressage', 'reining', 'western', 'english', 
        'outdoor', 'indoor', 'daytime', 'nighttime', 'action shot', 'portrait', 'crowd', 
        'saddle', 'bridle', 'award', 'ribbon', 'trophy', 'logo', 'diagram'
    ];
    const classificationOutput = await classifier(imageBuffer, candidateLabels, { top_k: 5 });
    
    const tags = classificationOutput
        .filter(item => item.score > 0.85) // Filter for high-confidence tags
        .map(item => item.label);

    // Return the results
    return new Response(JSON.stringify({ altText, tags }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
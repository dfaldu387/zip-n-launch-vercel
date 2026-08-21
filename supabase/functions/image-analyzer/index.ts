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

    // ── Only our own images ──────────────────────────────────────────────────
    // getImageBuffer below fetches whatever address the caller sends, from our
    // server. Unrestricted that is two problems at once: it will reach internal
    // addresses on a stranger's behalf, and each call downloads two large models
    // and runs inference, which is free compute for them and cost for us.
    //
    // Nothing in the app calls this function today, so the restriction cannot
    // break anything; it simply stops the door being useful to anyone who finds
    // it.
    const storageOrigin = new URL(Deno.env.get("SUPABASE_URL")).origin;
    let imageOrigin = "";
    try {
      imageOrigin = new URL(String(imageUrl)).origin;
    } catch {
      imageOrigin = "";
    }

    if (imageOrigin !== storageOrigin) {
      return new Response(
        JSON.stringify({ error: "That image is not stored here." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
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
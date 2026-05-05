// @ts-nocheck
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://deno.land/std@0.112.0/uuid/mod.ts";

// --- SIMULATION ENVIRONMENT ---
// This simulates the content of various association websites.
// In a real-world scenario, this would be replaced by actual `fetch` calls
// and HTML parsing logic (e.g., using a library like Cheerio).

const MOCK_WEBSITE_CONTENT = {
  "https://www.pinto.org/en/members/forms-documents": `
    <html><body>
      <h1>Forms & Documents</h1>
      <a href="/files/scoresheets/2025_PtHA_Trail_Scoresheet.pdf">2025 Trail Score Sheet</a>
      <a href="/files/scoresheets/2025_PtHA_Western_Horsemanship_Scoresheet.pdf">Western Horsemanship Score Sheet 2025</a>
      <a href="/files/scoresheets/2025_PtHA_Reining_Scoresheet_v2.pdf">Reining Score Sheet (Updated for 2025)</a>
      <a href="/files/rulebook_2025.pdf">2025 Rulebook</a>
    </body></html>
  `,
  "https://www.aqha.com/forms-and-resources": `
    <html><body>
      <h1>Forms</h1>
      <p>Ranch Riding Pattern 1 Score Sheet: /docs/scoresheets/2025_ranch_riding_p1.pdf</p>
      <p>Ranch Riding Pattern 2 Score Sheet: /docs/scoresheets/2025_ranch_riding_p2.pdf</p>
      <p>Western Riding Score Sheet: /docs/scoresheets/2025_western_riding.pdf</p>
    </body></html>
  `,
  "https://www.apha.com/rule-books/forms/": `
    <html><body>
      <p>This site is structured differently and requires special parsing.</p>
    </body></html>
  `,
  // NSBA will be simulated as a site that is temporarily down.
  "https://www.nsba.com/judges-forms": null, 
};

// --- CRAWLER LOGIC ---

async function logMessage(supabase, runId, status, message, details = {}) {
  const { error } = await supabase.from('crawler_logs').insert({
    run_id: runId,
    status,
    message,
    association_id: details.association_id,
    details,
  });
  if (error) console.error('Failed to log message:', error);
}

async function simulateCrawl(url) {
  await new Promise(resolve => setTimeout(resolve, 250 + Math.random() * 500)); // Simulate network delay
  if (url === null || MOCK_WEBSITE_CONTENT[url] === null) {
    throw new Error(`Site is down or unreachable.`);
  }
  if (MOCK_WEBSITE_CONTENT[url]) {
    return MOCK_WEBSITE_CONTENT[url];
  }
  throw new Error(`404 Not Found`);
}

function parsePintoHtml(html) {
  const found = [];
  const regex = /<a href="([^"]+)">([^<]+)<\/a>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2];
    if (url.toLowerCase().includes('scoresheet')) {
      const yearMatch = text.match(/20\d{2}/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();
      
      let className = 'Unknown';
      if (text.toLowerCase().includes('trail')) className = 'Trail';
      if (text.toLowerCase().includes('horsemanship')) className = 'Western Horsemanship';
      if (text.toLowerCase().includes('reining')) className = 'Reining';

      found.push({
        className,
        year,
        path: url,
        layout: 'default_layout',
      });
    }
  }
  return found;
}

// --- MAIN EDGE FUNCTION ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const runId = uuidv4.generate();
  let supabaseClient;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    // Use the service role key to allow inserts into the log table
    supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    await logMessage(supabaseClient, runId, 'SUCCESS', 'Crawler run started.');

    const { data: associations, error: assocError } = await supabaseClient
      .from('associations')
      .select('id, scoresheet_url_pattern')
      .not('scoresheet_url_pattern', 'is', null);

    if (assocError) throw assocError;

    let totalFound = 0;
    let totalUpserted = 0;

    for (const assoc of associations) {
      try {
        await logMessage(supabaseClient, runId, 'SUCCESS', `Crawling ${assoc.id}...`, { association_id: assoc.id });
        const html = await simulateCrawl(assoc.scoresheet_url_pattern);
        
        // This is where different parsing strategies would be used based on the association.
        // For this simulation, we'll just use the Pinto parser as an example.
        const templatesToUpsert = parsePintoHtml(html);

        if (templatesToUpsert.length === 0) {
          await logMessage(supabaseClient, runId, 'WARNING', `No new score sheets found for ${assoc.id}.`, { association_id: assoc.id });
          continue;
        }

        totalFound += templatesToUpsert.length;

        const upsertPromises = templatesToUpsert.map(template =>
          supabaseClient.rpc('upsert_scoresheet_template', {
            p_association_id: assoc.id,
            p_class_name: template.className,
            p_year: template.year,
            p_file_path: template.path,
            p_layout_type: template.layout,
          })
        );

        const results = await Promise.all(upsertPromises);
        const errors = results.filter(res => res.error);

        if (errors.length > 0) {
          await logMessage(supabaseClient, runId, 'ERROR', `Failed to upsert ${errors.length} templates for ${assoc.id}.`, { association_id: assoc.id, errors });
        }
        
        const successfulUpserts = results.length - errors.length;
        totalUpserted += successfulUpserts;
        if (successfulUpserts > 0) {
            await logMessage(supabaseClient, runId, 'SUCCESS', `Successfully upserted ${successfulUpserts} templates for ${assoc.id}.`, { association_id: assoc.id });
        }

      } catch (error) {
        await logMessage(supabaseClient, runId, 'ERROR', `Failed to crawl ${assoc.id}: ${error.message}`, { association_id: assoc.id });
      }
    }

    await logMessage(supabaseClient, runId, 'SUCCESS', `Crawl complete. Found ${totalFound} potential templates, upserted ${totalUpserted}.`);

    return new Response(JSON.stringify({
      message: `Crawl complete. See logs for details.`,
      runId: runId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    if (supabaseClient) {
        await logMessage(supabaseClient, runId, 'ERROR', `Critical error during crawl: ${error.message}`);
    }
    return new Response(JSON.stringify({ error: error.message, runId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
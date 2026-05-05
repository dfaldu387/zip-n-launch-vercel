// @ts-nocheck
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://deno.land/std@0.112.0/uuid/mod.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

// --- UTILITY FUNCTIONS ---
async function logMessage(supabase, runId, status, message, details = {}) {
  const { error } = await supabase.from('crawler_logs').insert({
    run_id: runId,
    status,
    message,
    association_id: details.association_id,
    details,
    run_type: 'asset_crawler'
  });
  if (error) console.error('Failed to log message:', error.message);
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'EquiPatterns-Asset-Crawler/1.0' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

async function ingestAsset(supabase, runId, asset, config) {
  const { association_id } = config;
  const { className, assetType, year, patternNumber, fileUrl, fileName } = asset;

  // Check if a similar asset already exists and is active
  let query = supabase.from('rulebook_assets').select('id, file_name')
    .eq('association_id', association_id)
    .eq('class_name', className)
    .eq('asset_type', assetType)
    .eq('year', year)
    .eq('is_active', true);
  
  if (patternNumber) {
    query = query.eq('pattern_number', patternNumber);
  } else {
    query = query.is('pattern_number', null);
  }

  const { data: existing, error: checkError } = await query.maybeSingle();
  if (checkError) throw new Error(`DB check failed: ${checkError.message}`);

  if (existing && existing.file_name === fileName) {
    await logMessage(supabase, runId, 'INFO', `Asset already exists and is current, skipping: ${fileName}`, { association_id });
    return { status: 'skipped', reason: 'already_exists' };
  }

  // Download the file
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) throw new Error(`Failed to download file: ${fileUrl}`);
  const fileBuffer = await fileResponse.arrayBuffer();
  const contentType = fileResponse.headers.get('content-type') || 'application/pdf';
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');


  // Upload to storage
  const storagePath = `rulebook_assets/${association_id}/${className}/${year}/${assetType}_${patternNumber || 'base'}_${cleanFileName}`;
  const { error: uploadError } = await supabase.storage
    .from('media_assets')
    .upload(storagePath, fileBuffer, { contentType, upsert: true });
  if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from('media_assets').getPublicUrl(storagePath);

  // Deactivate old asset if it exists
  if (existing) {
    const { error: updateError } = await supabase.from('rulebook_assets').update({ is_active: false }).eq('id', existing.id);
    if (updateError) console.error(`Failed to deactivate old asset ${existing.id}: ${updateError.message}`);
    await logMessage(supabase, runId, 'INFO', `Deactivated old asset: ${existing.file_name}`, { association_id });
  }

  // Insert new asset record
  const { error: dbError } = await supabase.from('rulebook_assets').insert({
    association_id,
    class_name: className,
    pattern_number: patternNumber,
    asset_type: assetType,
    year,
    file_url: urlData.publicUrl,
    file_name: cleanFileName,
    is_active: true,
  });
  if (dbError) throw new Error(`Database insert error: ${dbError.message}`);
  
  await logMessage(supabase, runId, 'SUCCESS', `Successfully ingested asset: ${cleanFileName}`, { association_id, asset });
  return { status: 'ingested' };
}


// --- PARSER FUNCTIONS ---
function genericParser(html, config) {
  const $ = cheerio.load(html);
  const foundAssets = [];
  const { linkSelector, assetTypeIdentifier, classKeywords, classPatternRanges } = config.metadata;
  const currentYear = new Date().getFullYear();

  $(linkSelector).each((_i, el) => {
    const link = $(el);
    const href = link.attr('href');
    const text = link.text().toLowerCase().trim();
    if (!href || !href.endsWith('.pdf')) return;
    
    const fullUrl = new URL(href, config.source_url).toString();
    const fileName = href.split('/').pop();

    // Handle Score Sheets
    if (config.asset_type === 'scoresheet' && classKeywords) {
      for (const [keyword, className] of Object.entries(classKeywords)) {
        if (text.includes(keyword.toLowerCase())) {
          foundAssets.push({
            className,
            assetType: 'scoresheet',
            year: currentYear,
            patternNumber: null,
            fileUrl: fullUrl,
            fileName,
          });
          break; // Move to next link once a match is found
        }
      }
    }

    // Handle Patterns
    if (config.asset_type === 'pattern' && classPatternRanges) {
      for (const [className, details] of Object.entries(classPatternRanges)) {
          const patternRegex = new RegExp(`${details.keyword.toLowerCase()}[ -]?(\\d+|[A-B])`, 'i');
          const match = text.match(patternRegex);

          if(match) {
            const pNum = match[1];
            if(details.range.map(String).includes(pNum)) {
               foundAssets.push({
                className,
                assetType: 'pattern',
                year: currentYear,
                patternNumber: isNaN(parseInt(pNum, 10)) ? pNum : parseInt(pNum, 10),
                fileUrl: fullUrl,
                fileName,
              });
            }
          }
      }
    }
  });

  return foundAssets;
}

const PARSERS = {
  'aqha_generic_parser': genericParser,
  'apha_generic_parser': genericParser,
  'aphc_generic_parser': genericParser,
};

// --- MAIN EDGE FUNCTION ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const runId = uuidv4.generate();
  let supabaseClient;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    await logMessage(supabaseClient, runId, 'INFO', 'Asset crawler run started.');

    const { data: configs, error: configError } = await supabaseClient
      .from('asset_source_configs')
      .select('*')
      .eq('is_active', true);

    if (configError) throw configError;

    for (const config of configs) {
      const { association_id, parser_type, source_url } = config;
      try {
        await logMessage(supabaseClient, runId, 'INFO', `Processing ${association_id} - ${parser_type}`, { association_id });
        const html = await fetchHtml(source_url);
        const parser = PARSERS[parser_type];

        if (!parser) {
          await logMessage(supabaseClient, runId, 'ERROR', `No parser found for type: ${parser_type}`, { association_id });
          continue;
        }

        const assets = parser(html, config);
        await logMessage(supabaseClient, runId, 'INFO', `Found ${assets.length} potential assets for ${association_id}.`, { association_id });

        for (const asset of assets) {
          try {
            await ingestAsset(supabaseClient, runId, asset, config);
          } catch (ingestError) {
            await logMessage(supabaseClient, runId, 'ERROR', `Failed to ingest asset ${asset.fileName}: ${ingestError.message}`, { association_id, asset });
          }
        }
      } catch (error) {
        await logMessage(supabaseClient, runId, 'ERROR', `Failed to process config for ${association_id}: ${error.message}`, { association_id });
      }
    }
    
    // Handle NSBA logic - copy from AQHA/APHA
    await logMessage(supabaseClient, runId, 'INFO', `Processing NSBA asset mapping...`, { association_id: 'NSBA' });
    const { data: nsbaClasses, error: classError } = await supabaseClient.from('class_library').select('name').contains('associations', ['NSBA']);
    
    if (classError) throw new Error(`Failed to fetch NSBA classes: ${classError.message}`);

    if (nsbaClasses) {
        for (const pbbClass of nsbaClasses) {
            const { data: sourceAssets, error: sourceError } = await supabaseClient.from('rulebook_assets').select('*').in('association_id', ['AQHA', 'APHA']).eq('class_name', pbbClass.name).eq('is_active', true);
            if (sourceError) {
                await logMessage(supabaseClient, runId, 'ERROR', `Failed to fetch source assets for ${pbbClass.name}: ${sourceError.message}`, { association_id: 'NSBA' });
                continue;
            }

            if (sourceAssets) {
                for (const sourceAsset of sourceAssets) {
                    try {
                      const nsbaConfig = { association_id: 'NSBA' };
                      const assetToIngest = {
                          className: sourceAsset.class_name,
                          assetType: sourceAsset.asset_type,
                          year: sourceAsset.year,
                          patternNumber: sourceAsset.pattern_number,
                          fileUrl: sourceAsset.file_url,
                          fileName: sourceAsset.file_name,
                      };
                       await ingestAsset(supabaseClient, runId, assetToIngest, nsbaConfig);
                    } catch (ingestError) {
                       await logMessage(supabaseClient, runId, 'ERROR', `Failed to map asset for NSBA class ${pbbClass.name}: ${ingestError.message}`, { association_id: 'NSBA' });
                    }
                }
            }
        }
    }

    await logMessage(supabaseClient, runId, 'SUCCESS', 'Asset crawler run finished.');
    return new Response(JSON.stringify({ message: "Crawl complete.", runId }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  } catch (error) {
    console.error(error);
    if (supabaseClient) {
      await logMessage(supabaseClient, runId, 'ERROR', `Critical error during crawl: ${error.message}`);
    }
    return new Response(JSON.stringify({ error: error.message, runId }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
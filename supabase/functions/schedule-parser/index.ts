// @ts-nocheck
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as pdfjs from "https://esm.sh/pdfjs-dist@3.11.174";
import * as xlsx from "https://esm.sh/xlsx@0.18.5";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const termMappings = {
  "wt": "Walk-Trot", "w/t": "Walk-Trot",
  "l1": "L1", "l2": "L2", "l3": "L3",
  "jr": "Junior", "sr": "Senior",
  "select": "Select",
  "nov": "Novice", "rkie": "Rookie",
  "sup": "Supported", "ind": "Independent",
  "hus": "Hunter Under Saddle", "w/p": "Western Pleasure", "wp": "Western Pleasure",
  "h/s": "Horsemanship",
  "eq": "Equitation",
  "show": "Showmanship",
  "ewd": "EWD"
};

const classKeywords = ["trail", "showmanship", "horsemanship", "pleasure", "hunter under saddle", "halter", "ranch riding", "reining", "equitation", "lead line", "longe line"];
const divisionKeywords = ["youth", "amateur", "open", "select", "small fry", "ewd", "non pro", "non-pro", "walk-trot", "walk trot"];
const levelKeywords = ["l1", "l2", "l3", "novice", "green", "junior", "senior", "rookie", "challenge"];

async function getRawText(fileBuffer, fileType) {
    if (fileType.includes('pdf')) {
        try {
            const loadingTask = pdfjs.getDocument({ data: fileBuffer });
            const pdf = await loadingTask.promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + '\n';
            }
            return fullText;
        } catch (error) {
            throw new Error(`Could not read the provided PDF file. It might be corrupted or in an unsupported format. Details: ${error.message}`);
        }
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
        try {
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            let fullText = "";
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const json = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                json.forEach(row => {
                    fullText += row.join(' ') + '\n';
                });
            });
            return fullText;
        } catch (error) {
            throw new Error(`Could not read the provided Excel file. Details: ${error.message}`);
        }
    }
    throw new Error(`Unsupported file type: ${fileType}`);
}


async function getAssociationKeywords(supabaseClient) {
    const { data, error } = await supabaseClient.from('association_keywords').select('keyword, association_id');
    if (error) {
        console.error("Error fetching association keywords:", error);
        return {};
    }
    const keywordMap = {};
    for (const item of data) {
        keywordMap[item.keyword.toLowerCase()] = item.association_id;
    }
    return keywordMap;
}

function detectAssociations(text, keywordMap) {
    const lowerText = text.toLowerCase();
    const found = new Set();
    for (const keyword in keywordMap) {
        if (lowerText.includes(keyword)) {
            found.add(keywordMap[keyword]);
        }
    }
    return Array.from(found);
}

function normalizeTerm(term) {
    const t = term.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    for (const key in termMappings) {
        if (t === key) return termMappings[key];
    }
    return term.charAt(0).toUpperCase() + term.slice(1);
}

function extractClasses(text) {
    const lines = text.split('\n');
    const classes = [];
    const unrecognized = new Set();

    const classLineRegex = /^(?:class|#)?\s*(\d+)\s*[.\-:]?\s+(.*)/i;

    for (const line of lines) {
        const match = line.match(classLineRegex);
        if (!match) continue;

        const classNumber = match[1];
        let description = match[2].trim();
        
        let className = "Unknown";
        let divisions = new Set();
        let levels = new Set();
        let foundClassName = false;

        for (const keyword of classKeywords) {
            if (description.toLowerCase().includes(keyword)) {
                className = keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                foundClassName = true;
                break;
            }
        }
        
        const parts = description.replace(/[()]/g, '').split(/[\s/]+/);
        parts.forEach(part => {
            const lowerPart = part.toLowerCase().trim();
            if (!lowerPart) return;

            if (divisionKeywords.includes(lowerPart)) {
                divisions.add(normalizeTerm(part));
            } else if (levelKeywords.includes(lowerPart)) {
                levels.add(normalizeTerm(part));
            } else if (termMappings[lowerPart]) {
                 const mapped = termMappings[lowerPart];
                 if (levelKeywords.includes(mapped.toLowerCase())) levels.add(mapped);
                 else if (divisionKeywords.includes(mapped.toLowerCase())) divisions.add(mapped);
            }
        });
        
        if (!foundClassName) {
            unrecognized.add({ type: 'class', term: description });
        }
        
        classes.push({
            classNumber,
            originalDescription: description,
            className,
            divisions: [...divisions],
            levels: [...levels],
        });
    }

    return { classes, unrecognized: Array.from(unrecognized) };
}


async function storeUnrecognized(supabaseClient, entities, fileName) {
    if (entities.length === 0) return;
    const records = entities.map(e => ({
        entity_name: e.term,
        entity_type: e.type,
        source_document_name: fileName,
        review_status: 'pending'
    }));
    const { error } = await supabaseClient.from('unrecognized_entities').insert(records);
    if (error) console.error("Error storing unrecognized entities:", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let uploadId;
  let serviceRoleClient;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header. Please log in.");
    }
    
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
        throw new Error("Authentication error: Could not verify user. Please log in again.");
    }
    
    serviceRoleClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const formData = await req.formData();
    const file = formData.get('schedule');
    
    if (!file || !(file instanceof File)) {
        throw new Error("A valid file must be provided in the 'schedule' field.");
    }

    const { data: uploadData, error: uploadError } = await serviceRoleClient
        .from('showbill_uploads')
        .insert({
            user_id: user.id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            status: 'parsing_initiated',
            raw_text: 'Upload received by function.'
        }).select().single();
    
    if (uploadError) throw new Error(`DB logging failed: ${uploadError.message}. Check table permissions.`);
    uploadId = uploadData.id;

    const logParseStep = async (status, message) => {
        await serviceRoleClient.from('showbill_uploads').update({ status, raw_text: message }).eq('id', uploadId);
    };

    await logParseStep('extracting_text', 'Reading file content.');
    const fileBuffer = await file.arrayBuffer();
    const rawText = await getRawText(new Uint8Array(fileBuffer), file.type);
    
    await logParseStep('detecting_associations', 'Identifying associations from text.');
    const associationKeywordMap = await getAssociationKeywords(serviceRoleClient);
    const associations = detectAssociations(rawText, associationKeywordMap);
    
    await logParseStep('extracting_classes', 'Parsing class list.');
    const { classes, unrecognized } = extractClasses(rawText);
    
    if (unrecognized.length > 0) {
        await logParseStep('logging_unrecognized', `Found ${unrecognized.length} unrecognized terms.`);
        await storeUnrecognized(serviceRoleClient, unrecognized, file.name);
    }
    
    await logParseStep('completed', 'Parsing complete.');

    return new Response(JSON.stringify({
        associations,
        classes,
        unrecognizedCount: unrecognized.length,
        message: "Successfully parsed schedule."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Edge function error:", error);
    if (uploadId && serviceRoleClient) {
        await serviceRoleClient.from('showbill_uploads').update({ status: 'failed', raw_text: error.message }).eq('id', uploadId);
    }
    return new Response(JSON.stringify({ error: `Edge function failed: ${error.message}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
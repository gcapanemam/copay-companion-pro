import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function extractDriveFileId(url: string): string | null {
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

function isDriveUrl(val: unknown): val is string {
  return typeof val === "string" && val.includes("drive.google.com");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const targetCpf: string | undefined = body.cpf;
    const limit: number = body.limit || 50;
    const offset: number = body.offset || 0;

    // Fetch admissoes
    let query = supabase.from("admissoes").select("id, cpf, dados");
    if (targetCpf) {
      query = query.eq("cpf", targetCpf);
    } else {
      query = query.range(offset, offset + limit - 1);
    }
    const { data: admissoes, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const results: Array<{
      cpf: string;
      campo: string;
      status: string;
      error?: string;
    }> = [];

    for (const adm of admissoes || []) {
      const dados = adm.dados as Record<string, unknown> | null;
      if (!dados || typeof dados !== "object") continue;

      for (const [campo, valor] of Object.entries(dados)) {
        if (!isDriveUrl(valor)) continue;

        const fileId = extractDriveFileId(valor);
        if (!fileId) {
          results.push({ cpf: adm.cpf, campo, status: "error", error: "Could not extract file ID" });
          continue;
        }

        // Check if already imported
        const { data: existing } = await supabase
          .from("funcionario_documentos")
          .select("id")
          .eq("cpf", adm.cpf)
          .eq("tipo_documento", campo)
          .eq("drive_url_original", valor)
          .maybeSingle();

        if (existing) {
          results.push({ cpf: adm.cpf, campo, status: "already_imported" });
          continue;
        }

        try {
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          const driveResp = await fetch(downloadUrl, { redirect: "follow" });

          if (!driveResp.ok) {
            results.push({ cpf: adm.cpf, campo, status: "error", error: `Drive returned ${driveResp.status}` });
            continue;
          }

          const contentType = driveResp.headers.get("content-type") || "application/octet-stream";
          const fileBytes = new Uint8Array(await driveResp.arrayBuffer());

          const extMap: Record<string, string> = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "application/pdf": "pdf",
            "image/gif": "gif",
          };
          const ext = extMap[contentType] || "bin";
          const fileName = `${campo}.${ext}`;
          const storagePath = `${adm.cpf}/${fileName}`;

          const { error: uploadErr } = await supabase.storage
            .from("funcionarios-documentos")
            .upload(storagePath, fileBytes, {
              contentType,
              upsert: true,
            });

          if (uploadErr) {
            results.push({ cpf: adm.cpf, campo, status: "error", error: uploadErr.message });
            continue;
          }

          const { error: insertErr } = await supabase
            .from("funcionario_documentos")
            .insert({
              cpf: adm.cpf,
              tipo_documento: campo,
              nome_arquivo: fileName,
              arquivo_url: storagePath,
              drive_url_original: valor,
            });

          if (insertErr) {
            results.push({ cpf: adm.cpf, campo, status: "error", error: insertErr.message });
            continue;
          }

          results.push({ cpf: adm.cpf, campo, status: "success" });
        } catch (err: any) {
          results.push({ cpf: adm.cpf, campo, status: "error", error: err.message });
        }
      }
    }

    const summary = {
      total: results.length,
      success: results.filter((r) => r.status === "success").length,
      already_imported: results.filter((r) => r.status === "already_imported").length,
      errors: results.filter((r) => r.status === "error").length,
      batch: { limit, offset, fetched: admissoes?.length || 0 },
      details: results,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

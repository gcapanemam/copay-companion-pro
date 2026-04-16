import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 50, 100);
    const offset = Number(body.offset) || 0;

    // Get all foto_3x4 documents
    const { data: docs, error: docsError } = await supabase
      .from("funcionario_documentos")
      .select("cpf, arquivo_url, nome_arquivo")
      .eq("tipo_documento", "foto_3x4")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (docsError) throw docsError;

    let success = 0;
    let errors = 0;
    let skipped = 0;
    const errorDetails: string[] = [];
    const processedCpfs = new Set<string>();

    for (const doc of docs || []) {
      const cpf = String(doc.cpf || "").replace(/\D/g, "").padStart(11, "0");
      if (!cpf || processedCpfs.has(cpf)) {
        skipped++;
        continue;
      }
      processedCpfs.add(cpf);

      // Skip .bin files (unknown content-type, won't render)
      const ext = (doc.nome_arquivo || doc.arquivo_url || "").split(".").pop()?.toLowerCase() || "";
      if (!ext || ext === "bin") {
        skipped++;
        continue;
      }

      try {
        // Download from funcionarios-documentos
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("funcionarios-documentos")
          .download(doc.arquivo_url);

        if (downloadError || !fileData) {
          errors++;
          errorDetails.push(`${cpf}: download falhou - ${downloadError?.message || "no data"}`);
          continue;
        }

        // Upload to funcionarios-fotos as {cpf}.{ext}
        const targetPath = `${cpf}.${ext}`;
        const contentType = fileData.type || `image/${ext === "jpg" ? "jpeg" : ext}`;

        const { error: uploadError } = await supabase.storage
          .from("funcionarios-fotos")
          .upload(targetPath, fileData, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          errors++;
          errorDetails.push(`${cpf}: upload falhou - ${uploadError.message}`);
          continue;
        }

        // Update admissoes.foto_url for all rows with matching CPF
        const cpfFormatted = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
        const { error: updateError } = await supabase
          .from("admissoes")
          .update({ foto_url: targetPath })
          .or(`cpf.eq.${cpf},cpf.eq.${cpfFormatted}`);

        if (updateError) {
          errors++;
          errorDetails.push(`${cpf}: update falhou - ${updateError.message}`);
          continue;
        }

        success++;
      } catch (err) {
        errors++;
        errorDetails.push(`${cpf}: ${(err as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        processed: docs?.length || 0,
        success,
        errors,
        skipped,
        errorDetails: errorDetails.slice(0, 10),
        hasMore: (docs?.length || 0) === limit,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

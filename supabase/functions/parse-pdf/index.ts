import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read file as array buffer and extract text using a simple approach
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const text = extractTextFromPdf(bytes);

    console.log("Extracted text length:", text.length);
    console.log("First 2000 chars:", text.substring(0, 2000));

    // Detect type
    const isMensalidade = text.includes("FATURA") || text.includes("VENCIMENTO") || text.includes("Mensalidade");
    const isCoparticipacao = text.includes("COPARTICIPA") || text.includes("Remessa") || text.includes("REMESSA");

    let tipo: string;
    let result: any;

    if (isCoparticipacao) {
      tipo = "coparticipacao";
      result = await parseCoparticipacao(supabase, text);
    } else if (isMensalidade) {
      tipo = "mensalidade";
      result = await parseMensalidade(supabase, text);
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo de PDF não reconhecido. Envie uma fatura mensal ou relatório de coparticipação da Hapvida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record upload
    await supabase.from("uploads").insert({
      tipo,
      nome_arquivo: file.name,
    });

    return new Response(JSON.stringify({ tipo, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractTextFromPdf(bytes: Uint8Array): string {
  // Simple PDF text extraction - finds text between stream markers
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);
  
  const textParts: string[] = [];
  
  // Extract text from PDF streams
  let idx = 0;
  while (idx < raw.length) {
    const streamStart = raw.indexOf("stream\r\n", idx);
    if (streamStart === -1) {
      const streamStart2 = raw.indexOf("stream\n", idx);
      if (streamStart2 === -1) break;
      idx = streamStart2 + 7;
    } else {
      idx = streamStart + 8;
    }
    
    const streamEnd = raw.indexOf("endstream", idx);
    if (streamEnd === -1) break;
    
    const content = raw.substring(idx, streamEnd);
    idx = streamEnd + 9;
    
    // Extract text operators: Tj, TJ, '
    const tjMatches = content.matchAll(/\(([^)]*)\)\s*Tj/g);
    for (const m of tjMatches) {
      textParts.push(m[1]);
    }
    
    const tjArrayMatches = content.matchAll(/\[([^\]]*)\]\s*TJ/g);
    for (const m of tjArrayMatches) {
      const inner = m[1];
      const strings = inner.matchAll(/\(([^)]*)\)/g);
      let line = "";
      for (const s of strings) {
        line += s[1];
      }
      if (line.trim()) textParts.push(line);
    }
  }
  
  // Also try to find raw text patterns
  const rawTextMatches = raw.matchAll(/BT\s*([\s\S]*?)ET/g);
  for (const m of rawTextMatches) {
    const block = m[1];
    const strings = block.matchAll(/\(([^)]*)\)/g);
    for (const s of strings) {
      if (s[1].trim() && !textParts.includes(s[1])) {
        textParts.push(s[1]);
      }
    }
  }
  
  return textParts.join("\n");
}

async function getOrCreateTitular(supabase: any, nome: string, matricula?: string, cpf?: string) {
  // Try to find by name first
  const { data: existing } = await supabase
    .from("titulares")
    .select("id")
    .eq("nome", nome.trim().toUpperCase())
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("titulares")
    .insert({ nome: nome.trim().toUpperCase(), matricula, cpf })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

async function getOrCreateDependente(supabase: any, titularId: string, nome: string, matricula?: string) {
  const { data: existing } = await supabase
    .from("dependentes")
    .select("id")
    .eq("titular_id", titularId)
    .eq("nome", nome.trim().toUpperCase())
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("dependentes")
    .insert({ titular_id: titularId, nome: nome.trim().toUpperCase(), matricula })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

async function parseMensalidade(supabase: any, text: string) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // Try to extract vencimento (month/year)
  let mes = 0, ano = 0;
  for (const line of lines) {
    const vencMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (vencMatch) {
      mes = parseInt(vencMatch[1]) || parseInt(vencMatch[2]);
      ano = parseInt(vencMatch[3]);
      if (ano > 0 && mes > 0 && mes <= 12) break;
    }
  }
  
  // If no date found, try month names
  if (mes === 0) {
    const meses: Record<string, number> = {
      "JANEIRO": 1, "FEVEREIRO": 2, "MARCO": 3, "MARÇO": 3, "ABRIL": 4,
      "MAIO": 5, "JUNHO": 6, "JULHO": 7, "AGOSTO": 8, "SETEMBRO": 9,
      "OUTUBRO": 10, "NOVEMBRO": 11, "DEZEMBRO": 12
    };
    for (const line of lines) {
      for (const [mName, mNum] of Object.entries(meses)) {
        if (line.toUpperCase().includes(mName)) {
          mes = mNum;
          const yearMatch = line.match(/(\d{4})/);
          if (yearMatch) ano = parseInt(yearMatch[1]);
          break;
        }
      }
      if (mes > 0) break;
    }
  }

  if (mes === 0 || ano === 0) {
    // Default to current date if can't parse
    const now = new Date();
    if (mes === 0) mes = now.getMonth() + 1;
    if (ano === 0) ano = now.getFullYear();
  }

  // Parse beneficiaries and values
  // Look for patterns like: NAME ... VALUE
  const beneficiarios: Array<{ nome: string; valor: number; tipo: "titular" | "dependente" }> = [];
  
  for (const line of lines) {
    // Match lines with name and monetary value
    const match = line.match(/^([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]+)\s+.*?(\d+[.,]\d{2})\s*$/);
    if (match) {
      const nome = match[1].trim();
      const valor = parseFloat(match[2].replace(",", "."));
      if (nome.length > 3 && valor > 0) {
        beneficiarios.push({ nome, valor, tipo: beneficiarios.length === 0 ? "titular" : "dependente" });
      }
    }
  }

  let titularesProcessados = 0;
  let dependentesProcessados = 0;

  if (beneficiarios.length > 0) {
    const titularNome = beneficiarios[0].nome;
    const titularId = await getOrCreateTitular(supabase, titularNome);

    // Upsert mensalidade for titular
    await supabase.from("mensalidades").upsert(
      { titular_id: titularId, dependente_id: null, mes, ano, valor: beneficiarios[0].valor },
      { onConflict: "titular_id,dependente_id,mes,ano" }
    );
    titularesProcessados = 1;

    // Process dependentes
    for (let i = 1; i < beneficiarios.length; i++) {
      const dep = beneficiarios[i];
      const depId = await getOrCreateDependente(supabase, titularId, dep.nome);
      await supabase.from("mensalidades").upsert(
        { titular_id: titularId, dependente_id: depId, mes, ano, valor: dep.valor },
        { onConflict: "titular_id,dependente_id,mes,ano" }
      );
      dependentesProcessados++;
    }
  }

  return {
    mes,
    ano,
    titulares_processados: titularesProcessados,
    dependentes_processados: dependentesProcessados,
    beneficiarios_encontrados: beneficiarios.length,
  };
}

async function parseCoparticipacao(supabase: any, text: string) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // Try to find period (month/year)
  let mes = 0, ano = 0;
  for (const line of lines) {
    const periodMatch = line.match(/(\d{2})\/(\d{4})/);
    if (periodMatch) {
      mes = parseInt(periodMatch[1]);
      ano = parseInt(periodMatch[2]);
      if (mes > 0 && mes <= 12) break;
    }
    const dateMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateMatch && mes === 0) {
      mes = parseInt(dateMatch[2]);
      ano = parseInt(dateMatch[3]);
    }
  }

  if (mes === 0 || ano === 0) {
    const now = new Date();
    if (mes === 0) mes = now.getMonth() + 1;
    if (ano === 0) ano = now.getFullYear();
  }

  // Parse coparticipacao entries
  // Look for: name, date, procedure, location, value patterns
  const entries: Array<{
    nome_usuario: string;
    data_utilizacao: string | null;
    procedimento: string;
    local: string;
    valor: number;
  }> = [];

  let currentName = "";
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for date pattern at start of line (dd/mm/yyyy)
    const dateLineMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (dateLineMatch) {
      // This line likely has procedure info
      const data = dateLineMatch[1];
      const rest = line.substring(data.length).trim();
      
      // Try to extract value from end
      const valMatch = rest.match(/(\d+[.,]\d{2})\s*$/);
      if (valMatch) {
        const valor = parseFloat(valMatch[1].replace(",", "."));
        const procedimentoLocal = rest.substring(0, rest.length - valMatch[0].length).trim();
        
        entries.push({
          nome_usuario: currentName || "DESCONHECIDO",
          data_utilizacao: data.split("/").reverse().join("-"), // Convert to YYYY-MM-DD
          procedimento: procedimentoLocal,
          local: "",
          valor,
        });
      }
    } else if (line.match(/^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]{5,}$/) && !line.match(/HAPVIDA|COPARTICIPA|REMESSA|EMPRESA|TOTAL|SUBTOTAL/i)) {
      // Likely a name
      currentName = line.trim();
    }
  }

  // Group by name and save
  const nameGroups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const arr = nameGroups.get(entry.nome_usuario) || [];
    arr.push(entry);
    nameGroups.set(entry.nome_usuario, arr);
  }

  let coparticipacoesCriadas = 0;
  let itensCriados = 0;

  // For each user, find or create titular/dependente and save coparticipacao
  for (const [nomeUsuario, userEntries] of nameGroups) {
    // Try to find as titular first
    const { data: titular } = await supabase
      .from("titulares")
      .select("id")
      .eq("nome", nomeUsuario.toUpperCase())
      .maybeSingle();

    let titularId: string;
    let dependenteId: string | null = null;

    if (titular) {
      titularId = titular.id;
    } else {
      // Check if dependente
      const { data: dep } = await supabase
        .from("dependentes")
        .select("id, titular_id")
        .eq("nome", nomeUsuario.toUpperCase())
        .maybeSingle();

      if (dep) {
        titularId = dep.titular_id;
        dependenteId = dep.id;
      } else {
        // Create as new titular
        titularId = await getOrCreateTitular(supabase, nomeUsuario);
      }
    }

    // Create coparticipacao record
    const { data: copart, error: copartError } = await supabase
      .from("coparticipacoes")
      .insert({
        titular_id: titularId,
        dependente_id: dependenteId,
        nome_usuario: nomeUsuario.toUpperCase(),
        data_utilizacao: userEntries[0]?.data_utilizacao || null,
        mes,
        ano,
      })
      .select("id")
      .single();

    if (copartError) {
      console.error("Error creating coparticipacao:", copartError);
      continue;
    }

    coparticipacoesCriadas++;

    // Insert items
    const items = userEntries.map((e) => ({
      coparticipacao_id: copart.id,
      procedimento: e.procedimento || "Procedimento não identificado",
      local: e.local || null,
      quantidade: 1,
      valor: e.valor,
    }));

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("coparticipacao_itens").insert(items);
      if (itemsError) console.error("Error inserting items:", itemsError);
      else itensCriados += items.length;
    }
  }

  return {
    mes,
    ano,
    coparticipacoes_criadas: coparticipacoesCriadas,
    itens_criados: itensCriados,
    usuarios_encontrados: nameGroups.size,
  };
}

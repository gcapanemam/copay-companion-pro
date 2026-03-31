import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { text, filename } = await req.json();
    if (!text || !filename) {
      return new Response(JSON.stringify({ error: "text and filename are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Received text length:", text.length);
    console.log("First 500 chars:", text.substring(0, 500));

    // Detect type based on content
    const upperText = text.toUpperCase();
    const isMensalidade = upperText.includes("FATURA MENSAL") || upperText.includes("ANALÍTICO FATURA");
    const isCoparticipacao = upperText.includes("CO-PARTICIPAÇÃO") || upperText.includes("COPARTICIPA") || upperText.includes("REMESSA");

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

    await supabase.from("uploads").insert({ tipo, nome_arquivo: filename });

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

async function getOrCreateTitular(supabase: any, nome: string, cpf?: string) {
  const cleanName = nome.trim().toUpperCase().replace(/\s+/g, " ");
  const { data: existing } = await supabase
    .from("titulares")
    .select("id")
    .eq("nome", cleanName)
    .maybeSingle();
  if (existing) return existing.id;

  const insertData: any = { nome: cleanName };
  if (cpf) insertData.cpf = cpf.replace(/[^0-9]/g, "");
  const { data: created, error } = await supabase
    .from("titulares")
    .insert(insertData)
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

async function getOrCreateDependente(supabase: any, titularId: string, nome: string, cpf?: string) {
  const cleanName = nome.trim().toUpperCase().replace(/\s+/g, " ");
  const { data: existing } = await supabase
    .from("dependentes")
    .select("id")
    .eq("titular_id", titularId)
    .eq("nome", cleanName)
    .maybeSingle();
  if (existing) return existing.id;

  const insertData: any = { titular_id: titularId, nome: cleanName };
  if (cpf) insertData.cpf = cpf.replace(/[^0-9]/g, "");
  const { data: created, error } = await supabase
    .from("dependentes")
    .insert(insertData)
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

async function parseMensalidade(supabase: any, text: string) {
  const lines = text.split("\n");

  // Extract vencimento
  let mes = 0, ano = 0;
  for (const line of lines) {
    const vencMatch = line.match(/Vencimento\s+(\d{2})\/(\d{2})\/(\d{2,4})/i);
    if (vencMatch) {
      const day = parseInt(vencMatch[1]);
      mes = parseInt(vencMatch[2]);
      ano = parseInt(vencMatch[3]);
      if (ano < 100) ano += 2000;
      break;
    }
  }

  if (mes === 0) {
    const now = new Date();
    mes = now.getMonth() + 1;
    ano = now.getFullYear();
  }

  // Parse titulares and their beneficiaries
  // Pattern: "Titular      NAME                    CPF   XXXX"
  // Then credential lines with: CREDENTIAL CPF BENEFICIARIO PAREN. ... Mensalidade ... Cobrado
  
  interface Beneficiario {
    nome: string;
    cpf: string;
    parentesco: string;
    mensalidade: number;
    cobrado: number;
    titularNome: string;
    titularCpf: string;
  }

  const beneficiarios: Beneficiario[] = [];
  let currentTitular = "";
  let currentTitularCpf = "";
  const processedTitulares = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match titular line: "Titular      NAME       CPF   XXXXX"
    const titularMatch = line.match(/^Titular\s+(.+?)\s{2,}CPF\s+(\d+)/i);
    if (titularMatch) {
      currentTitular = titularMatch[1].trim();
      currentTitularCpf = titularMatch[2].trim();
      continue;
    }

    // Match credential line with values
    // Pattern: CREDENTIAL CPF BENEFICIARIO PARENTESCO ... MENSALIDADE ... COBRADO
    const credMatch = line.match(
      /^\S+\.\d+-\d+\s+\d+\s+[\d-]+\s+(.+?)\s+(TITULAR|FILHO\(A\)|CONJUGE|COMPANHEIRO)\s+.+?\s+(\d+[.,]\d{2})\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)\s*$/
    );
    if (credMatch && currentTitular) {
      const benefNome = credMatch[1].trim();
      const parentesco = credMatch[2];
      const mensalidade = parseFloat(credMatch[3].replace(",", "."));
      const cobrado = parseFloat(credMatch[4].replace(",", "."));

      // Skip zero-value entries (like odonto plans with 0.00)
      if (cobrado > 0) {
        beneficiarios.push({
          nome: benefNome,
          cpf: "",
          parentesco,
          mensalidade,
          cobrado,
          titularNome: currentTitular,
          titularCpf: currentTitularCpf,
        });
      }
      continue;
    }

    // Simpler match for lines that may have different spacing
    if (currentTitular && line.match(/^\S+\.\d+-\d+/)) {
      // Try to extract the last numeric value as cobrado
      const nums = [...line.matchAll(/([\d]+[.,]\d{2})/g)].map(m => parseFloat(m[1].replace(",", ".")));
      if (nums.length >= 2) {
        const cobrado = nums[nums.length - 1];
        const mensalidade = nums.find(n => n > 0) || 0;
        
        // Extract name - it's after the CPF field
        const nameMatch = line.match(/[\d-]+\s+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]+?)\s+(TITULAR|FILHO\(A\)|CONJUGE)/);
        if (nameMatch && cobrado > 0) {
          beneficiarios.push({
            nome: nameMatch[1].trim(),
            cpf: "",
            parentesco: nameMatch[2],
            mensalidade: cobrado,
            cobrado,
            titularNome: currentTitular,
            titularCpf: currentTitularCpf,
          });
        }
      }
    }
  }

  // Now save to database
  let titularesProcessados = 0;
  let dependentesProcessados = 0;

  // Group by titular
  const titularGroups = new Map<string, Beneficiario[]>();
  for (const b of beneficiarios) {
    const key = b.titularNome;
    const arr = titularGroups.get(key) || [];
    arr.push(b);
    titularGroups.set(key, arr);
  }

  for (const [titularNome, members] of titularGroups) {
    if (processedTitulares.has(titularNome)) continue;
    processedTitulares.add(titularNome);

    const titularCpf = members[0]?.titularCpf;
    const titularId = await getOrCreateTitular(supabase, titularNome, titularCpf);

    for (const member of members) {
      if (member.parentesco === "TITULAR") {
        // Upsert titular mensalidade
        await supabase.from("mensalidades").upsert(
          { titular_id: titularId, dependente_id: null, mes, ano, valor: member.cobrado },
          { onConflict: "titular_id,dependente_id,mes,ano" }
        );
        titularesProcessados++;
      } else {
        // Create dependente and upsert mensalidade
        const depId = await getOrCreateDependente(supabase, titularId, member.nome);
        await supabase.from("mensalidades").upsert(
          { titular_id: titularId, dependente_id: depId, mes, ano, valor: member.cobrado },
          { onConflict: "titular_id,dependente_id,mes,ano" }
        );
        dependentesProcessados++;
      }
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
  const lines = text.split("\n");

  // Extract period from header line like: "1010568516705 15/08/2025  128,20"
  let mes = 0, ano = 0;
  for (const line of lines) {
    const periodMatch = line.match(/\d{10,}\s+\d{2}\/(\d{2})\/(\d{4})/);
    if (periodMatch) {
      mes = parseInt(periodMatch[1]);
      ano = parseInt(periodMatch[2]);
      break;
    }
  }

  if (mes === 0) {
    // Try date format in procedure lines
    for (const line of lines) {
      const dateMatch = line.match(/\d{2}\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        mes = parseInt(dateMatch[1]);
        ano = parseInt(dateMatch[2]);
        break;
      }
    }
  }

  if (mes === 0 || ano === 0) {
    const now = new Date();
    if (mes === 0) mes = now.getMonth() + 1;
    if (ano === 0) ano = now.getFullYear();
  }

  // Parse structure:
  // "0CC21000004-ADRIANE NASCIMENTO DE BRITO" => titular block
  // "Cod. Usuario  Matricula  Cpf  Nome"
  // "0CC21000004022   6677952606  DANIEL MORAES DE BRITO" => user who used
  // "T99883893   15/07/2025   15/07/2025   00010014 - CONSULTA...   TELECONSULTA   1   25,64" => procedure

  interface CopartEntry {
    titularCode: string;
    titularNome: string;
    nomeUsuario: string;
    cpfUsuario: string;
    procedimento: string;
    local: string;
    dataUtilizacao: string;
    quantidade: number;
    valor: number;
  }

  const entries: CopartEntry[] = [];
  let currentTitularCode = "";
  let currentTitularNome = "";
  let currentUserNome = "";
  let currentUserCpf = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Match titular block: "0CC21000004-ADRIANE NASCIMENTO DE BRITO"
    const titularBlockMatch = line.match(/^(\w+\d+)-([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]+)$/);
    if (titularBlockMatch) {
      currentTitularCode = titularBlockMatch[1];
      currentTitularNome = titularBlockMatch[2].trim();
      currentUserNome = "";
      currentUserCpf = "";
      continue;
    }

    // Match user line (after "Cod. Usuario" header): "0CC21000004022    6677952606   DANIEL MORAES DE BRITO"
    const userMatch = line.match(/^\w+\d{3,}\s+(\d{10,})\s+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]+)$/);
    if (userMatch && currentTitularNome) {
      currentUserCpf = userMatch[1];
      currentUserNome = userMatch[2].trim();
      continue;
    }

    // Match procedure line: "T99883893   15/07/2025   15/07/2025   00010014 - CONSULTA EM CONSULTORIO   TELECONSULTA   1   25,64"
    const procMatch = line.match(
      /^[A-Z]\d+\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+\d+\s*-\s*(.+?)\s{2,}(.+?)\s+(\d+)\s+([\d.,]+)\s*$/
    );
    if (procMatch && currentTitularNome) {
      const dataStr = procMatch[1];
      const procedimento = procMatch[2].trim();
      const local = procMatch[3].trim();
      const quantidade = parseInt(procMatch[4]);
      const valor = parseFloat(procMatch[5].replace(".", "").replace(",", "."));

      entries.push({
        titularCode: currentTitularCode,
        titularNome: currentTitularNome,
        nomeUsuario: currentUserNome || currentTitularNome,
        cpfUsuario: currentUserCpf,
        procedimento,
        local,
        dataUtilizacao: dataStr.split("/").reverse().join("-"),
        quantidade,
        valor,
      });
    }
  }

  console.log("Parsed coparticipacao entries:", entries.length);

  // Group by user and save
  const userGroups = new Map<string, CopartEntry[]>();
  for (const e of entries) {
    const key = `${e.titularNome}|${e.nomeUsuario}`;
    const arr = userGroups.get(key) || [];
    arr.push(e);
    userGroups.set(key, arr);
  }

  let coparticipacoesCriadas = 0;
  let itensCriados = 0;

  for (const [key, userEntries] of userGroups) {
    const titularNome = userEntries[0].titularNome;
    const nomeUsuario = userEntries[0].nomeUsuario;

    // Get or create titular
    const titularId = await getOrCreateTitular(supabase, titularNome);

    // Determine if user is titular or dependente
    let dependenteId: string | null = null;
    if (nomeUsuario.toUpperCase() !== titularNome.toUpperCase()) {
      dependenteId = await getOrCreateDependente(supabase, titularId, nomeUsuario, userEntries[0].cpfUsuario);
    }

    // Create coparticipacao
    const { data: copart, error: copartError } = await supabase
      .from("coparticipacoes")
      .insert({
        titular_id: titularId,
        dependente_id: dependenteId,
        nome_usuario: nomeUsuario.toUpperCase(),
        data_utilizacao: userEntries[0].dataUtilizacao,
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

    const items = userEntries.map((e) => ({
      coparticipacao_id: copart.id,
      procedimento: e.procedimento,
      local: e.local,
      quantidade: e.quantidade,
      valor: e.valor,
    }));

    const { error: itemsError } = await supabase.from("coparticipacao_itens").insert(items);
    if (itemsError) console.error("Error inserting items:", itemsError);
    else itensCriados += items.length;
  }

  return {
    mes,
    ano,
    coparticipacoes_criadas: coparticipacoesCriadas,
    itens_criados: itensCriados,
    usuarios_encontrados: userGroups.size,
  };
}

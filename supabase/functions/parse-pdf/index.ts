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

    // Normalize: collapse multiple spaces into single space per line
    const normalizedText = text.split("\n").map((l: string) => l.replace(/\s+/g, " ").trim()).join("\n");

    console.log("Received text length:", text.length);
    console.log("Normalized first 500:", normalizedText.substring(0, 500));

    const upperText = normalizedText.toUpperCase();
    const isMensalidade = upperText.includes("FATURA MENSAL") || upperText.includes("ANALÍTICO FATURA");
    const isCoparticipacao = upperText.includes("CO-PARTICIPAÇÃO") || upperText.includes("COPARTICIPA") || upperText.includes("REMESSA");

    let tipo: string;
    let result: any;

    if (isCoparticipacao) {
      tipo = "coparticipacao";
      result = await parseCoparticipacao(supabase, normalizedText);
    } else if (isMensalidade) {
      tipo = "mensalidade";
      result = await parseMensalidade(supabase, normalizedText);
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo de PDF não reconhecido." }),
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
  const lines = text.split("\n").filter((l: string) => l.trim());

  // Extract vencimento from line like: "Obrigação 3025610467 Controle 1010516565640 Vencimento 15/03/25"
  let mes = 0, ano = 0;
  for (const line of lines) {
    const vencMatch = line.match(/Vencimento\s+(\d{2})\/(\d{2})\/(\d{2,4})/i);
    if (vencMatch) {
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

  interface Beneficiario {
    nome: string;
    cpf: string;
    parentesco: string;
    cobrado: number;
    titularNome: string;
    titularCpf: string;
  }

  const beneficiarios: Beneficiario[] = [];
  let currentTitular = "";
  let currentTitularCpf = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match: "Titular ELIANE RIBEIRO MARTINS CPF 55965547668"
    const titularMatch = line.match(/^Titular\s+(.+?)\s+CPF\s+(\d+)/i);
    if (titularMatch) {
      currentTitular = titularMatch[1].trim().replace(/\s+/g, " ");
      currentTitularCpf = titularMatch[2].trim();
      continue;
    }

    // Match credential lines - they start with something like "0CBNA.000001-00" or "0CC21.000001-00"
    // After normalization, format: "0CBNA.000001-00 7 559655476-68 ELIANE RIBEIRO MARTINS TITULAR DADY RIBEIRO MARTINS 29/12/63 61 10/12/21 1753 0.00 1 269.85 0.00 0.00 0.00 269.85"
    const credLineMatch = line.match(/^\w+\.\d+-\d+\s/);
    if (credLineMatch && currentTitular) {
      // Extract parentesco (TITULAR, FILHO(A), CONJUGE, etc.)
      const parentescoMatch = line.match(/(TITULAR|FILHO\(A\)|CONJUGE|COMPANHEIRO\(A\)?)/);
      if (!parentescoMatch) continue;
      
      const parentesco = parentescoMatch[1];
      const parentescoIdx = line.indexOf(parentescoMatch[0]);
      
      // Extract all decimal numbers from the line
      const allNums = [...line.matchAll(/(\d+[.,]\d{2})/g)].map(m => parseFloat(m[1].replace(",", ".")));
      
      if (allNums.length < 1) continue;
      const cobrado = allNums[allNums.length - 1];
      
      if (cobrado <= 0) continue;
      
      // Extract beneficiary name: between CPF (format XXX-XX) and parentesco
      const beforeParentesco = line.substring(0, parentescoIdx).trim();
      // Find the CPF pattern (XXX-XX) and get everything after it
      const cpfEndMatch = beforeParentesco.match(/\d{3}-\d{2}\s+(.+)$/);
      if (cpfEndMatch) {
        const nome = cpfEndMatch[1].trim().replace(/\s+/g, " ");
        if (nome.length > 2) {
          beneficiarios.push({
            nome,
            cpf: "",
            parentesco,
            cobrado,
            titularNome: currentTitular,
            titularCpf: currentTitularCpf,
          });
        }
      }
    }
  }

  console.log(`Found ${beneficiarios.length} beneficiarios for ${mes}/${ano}`);

  // Save to database
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
    const titularCpf = members[0]?.titularCpf;
    const titularId = await getOrCreateTitular(supabase, titularNome, titularCpf);

    for (const member of members) {
      if (member.parentesco === "TITULAR") {
        await supabase.from("mensalidades").upsert(
          { titular_id: titularId, dependente_id: null, mes, ano, valor: member.cobrado },
          { onConflict: "titular_id,dependente_id,mes,ano" }
        );
        titularesProcessados++;
      } else {
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
  const lines = text.split("\n").filter((l: string) => l.trim());

  // Extract period
  let mes = 0, ano = 0;
  for (const line of lines) {
    // Match: "1010568516705 15/08/2025 128,20"
    const periodMatch = line.match(/\d{10,}\s+\d{2}\/(\d{2})\/(\d{4})/);
    if (periodMatch) {
      mes = parseInt(periodMatch[1]);
      ano = parseInt(periodMatch[2]);
      break;
    }
  }

  if (mes === 0) {
    // Try from procedure dates
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

  interface CopartEntry {
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
  let currentTitularNome = "";
  let currentUserNome = "";
  let currentUserCpf = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Match titular block: "0CC21000004-ADRIANE NASCIMENTO DE BRITO"
    const titularBlockMatch = line.match(/^(\w+\d+)-([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]+)$/);
    if (titularBlockMatch) {
      currentTitularNome = titularBlockMatch[2].trim().replace(/\s+/g, " ");
      currentUserNome = "";
      currentUserCpf = "";
      continue;
    }

    // Match user line: "0CC21000004022 6677952606 DANIEL MORAES DE BRITO"
    const userMatch = line.match(/^\w+\d{3,}\s+(\d{10,})\s+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]+)$/);
    if (userMatch && currentTitularNome) {
      currentUserCpf = userMatch[1];
      currentUserNome = userMatch[2].trim().replace(/\s+/g, " ");
      continue;
    }

    // Match procedure: "T99883893 15/07/2025 15/07/2025 00010014 - CONSULTA EM CONSULTORIO TELECONSULTA - DIGITAL 1 25,64"
    const procMatch = line.match(
      /^[A-Z]\d+\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+\d+\s*-\s*(.+?)\s{2,}(.+?)\s+(\d+)\s+([\d.,]+)\s*$/
    );
    if (procMatch && currentTitularNome) {
      const dataStr = procMatch[1];
      const procedimento = procMatch[2].trim();
      const local = procMatch[3].trim();
      const quantidade = parseInt(procMatch[4]);
      const valorStr = procMatch[5].replace(".", "").replace(",", ".");
      const valor = parseFloat(valorStr);

      entries.push({
        titularNome: currentTitularNome,
        nomeUsuario: currentUserNome || currentTitularNome,
        cpfUsuario: currentUserCpf,
        procedimento,
        local,
        dataUtilizacao: dataStr.split("/").reverse().join("-"),
        quantidade,
        valor,
      });
      continue;
    }

    // Simpler proc match (single space between fields after normalization)
    // "T99883893 15/07/2025 15/07/2025 00010014 - CONSULTA EM CONSULTORIO TELECONSULTA - DIGITAL 1 25,64"
    const simpleProcMatch = line.match(
      /^[A-Z]\d+\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+(\d+)\s*-\s*(.+)/
    );
    if (simpleProcMatch && currentTitularNome) {
      const dataStr = simpleProcMatch[1];
      const rest = simpleProcMatch[3];
      
      // Extract value from end
      const valMatch = rest.match(/(\d+)\s+([\d.,]+)\s*$/);
      if (valMatch) {
        const quantidade = parseInt(valMatch[1]);
        const valorStr = valMatch[2].replace(".", "").replace(",", ".");
        const valor = parseFloat(valorStr);
        const procLocal = rest.substring(0, rest.length - valMatch[0].length).trim();

        entries.push({
          titularNome: currentTitularNome,
          nomeUsuario: currentUserNome || currentTitularNome,
          cpfUsuario: currentUserCpf,
          procedimento: procLocal,
          local: "",
          dataUtilizacao: dataStr.split("/").reverse().join("-"),
          quantidade,
          valor,
        });
      }
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

  for (const [, userEntries] of userGroups) {
    const titularNome = userEntries[0].titularNome;
    const nomeUsuario = userEntries[0].nomeUsuario;

    const titularId = await getOrCreateTitular(supabase, titularNome);

    let dependenteId: string | null = null;
    if (nomeUsuario.toUpperCase() !== titularNome.toUpperCase()) {
      dependenteId = await getOrCreateDependente(supabase, titularId, nomeUsuario, userEntries[0].cpfUsuario);
    }

    const { data: copart, error: copartError } = await supabase
      .from("coparticipacoes")
      .insert({
        titular_id: titularId,
        dependente_id: dependenteId,
        nome_usuario: nomeUsuario.toUpperCase().replace(/\s+/g, " "),
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
      local: e.local || null,
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

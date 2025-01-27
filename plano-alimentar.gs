/**
 * Processa submissões de formulário, calcula métricas nutricionais e coordena o fluxo principal
 * @param {Object} e - Objeto de evento do Google Forms contendo dados da submissão
 */
function onFormSubmit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // Previne execuções paralelas
  
  try {
    let data, row;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Respostas do Formulário");
    const resultSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Resultados Gerados");

    // Modo manual (execução sem trigger)
    if (!e || !e.range) {
      // Encontra a última linha com email válido
      const emailColumn = sheet.getRange("B:B").getValues().flat();
      let lastValidRow = emailColumn.lastIndexOf(emailColumn.filter(x => x.toString().includes("@")).pop()) + 1;
      
      if(lastValidRow < 2) throw "Nenhum formulário válido encontrado";
      
      data = sheet.getRange(lastValidRow, 1, 1, sheet.getLastColumn()).getValues()[0];
      row = lastValidRow;
    } 
    // Modo trigger (execução normal)
    else {
      data = e.values;
      row = e.range.getRow();
    }
    
    var timestamp = data[0];
    var email = data[1].trim();
    var nome = data[2].trim();
    var objetivo = data[3].trim();
    var genero = data[5].trim();
    var atividade = data[8].trim();
    var restricao = data[9].trim();
    var whatsapp = (data[10]?.toString() || "").replace(/\D/g, "").slice(0, 11);
    var culinaria = data[11].trim();
    var idade = parseInt((data[4]?.toString() || "0").replace(/\D/g, "")) || 0;
    var altura = parseInt((data[6]?.toString() || "0").replace(/\D/g, "")) || 0;
    var peso = parseFloat((data[7]?.toString() || "0").replace(/[^0-9.]/g, "")) || 0;

    Logger.log("Conteúdo obtido das colunas:");
    Logger.log("email: " + email);
    Logger.log("nome: " + nome);
    Logger.log("objetivo: " + objetivo);
    Logger.log("idade: " + idade);
    Logger.log("genero: " + genero);
    Logger.log("altura: " + altura);
    Logger.log("peso: " + peso);
    Logger.log("atividade: " + atividade);
    Logger.log("restricao: " + restricao);
    Logger.log("whatsapp: " + whatsapp);
    Logger.log("culinaria: " + culinaria);

    // Após obter todas as variáveis (antes do cálculo do TMB)
    if (!email.includes("@")) throw "E-mail inválido";
    if (peso < 30 || peso > 300) throw "Peso inválido (30-300kg)";
    if (altura < 100 || altura > 250) throw "Altura inválida (100-250cm)";
    if (isNaN(idade) || idade < 1) throw "Idade inválida";
    
    var tmb = calcularTMB(peso, altura, idade, genero);
    var calorias = calcularNecessidadeCalorica(tmb, atividade, objetivo);
    var macros = calcularMacronutrientes(calorias, objetivo);
    var agua = calcularAguaDiaria(peso);

    Logger.log("TMB: " + tmb);
    Logger.log("Calorias: " + calorias);
    Logger.log("Proteínas: " + macros.proteinas + ", Carboidratos: " + macros.carboidratos + ", Gorduras: " + macros.gorduras);
    Logger.log("Água: " + agua);

    const targetRow = row; // Usa a mesma linha do formulário
    resultSheet.getRange(targetRow, 1, 1, 10).setValues([
      [nome, email, calorias, macros.proteinas, macros.carboidratos, macros.gorduras, restricao, culinaria, whatsapp, agua]
    ]);
    
    var planoAlimentar = gerarPlanoAlimentarGPT(nome, idade, peso, altura, objetivo, calorias, macros, restricao, culinaria);

    console.log("Tipo do plano:", typeof planoAlimentar);
    console.log("Conteúdo:", planoAlimentar.slice(0, 500) + "...");
    console.log("Última linha:", row);

    // Escreve na coluna K (11) antes de enviar o e-mail
    resultSheet.getRange(row, 11).setValue(planoAlimentar);
    resultSheet.getRange(row, 11).setWrap(true);

    // Envia o e-mail apenas se o plano for gerado
    if (planoAlimentar) {
      enviarEmailUsuario(email, nome, calorias, macros, agua, planoAlimentar);
    }

    lock.releaseLock();
  } catch (error) {
    lock.releaseLock();
    const errorMsg = `Erro: ${error.stack || error}`; 
    Logger.log(errorMsg);
    enviarErroAdmin(errorMsg);
  }
}

/**
 * Calcula a Taxa Metabólica Basal (TMB) usando a equação de Harris-Benedict revisada
 * @param {number} peso - Peso em quilogramas
 * @param {number} altura - Altura em centímetros
 * @param {number} idade - Idade em anos completos
 * @param {string} genero - Gênero biológico ('masculino' ou 'feminino')
 * @returns {number} Valor da TMB em kcal/dia
 */
function calcularTMB(peso, altura, idade, genero) {
  if (isNaN(peso) || isNaN(altura) || isNaN(idade)) {
    throw "Valores numéricos inválidos para peso, altura ou idade";
  }
  
  genero = genero.toLowerCase().trim();
  return (genero === "masculino") 
    ? (10 * peso) + (6.25 * altura) - (5 * idade) + 5
    : (10 * peso) + (6.25 * altura) - (5 * idade) - 161;
}

/**
 * Calcula a necessidade calórica diária com base no nível de atividade física e objetivo
 * @param {number} tmb - Taxa Metabólica Basal calculada
 * @param {string} atividade - Nível de atividade física (Sedentário a Atleta)
 * @param {string} objetivo - Objetivo do usuário (Manter, Ganhar ou Perder peso)
 * @returns {number} Calorias diárias ajustadas
 */
function calcularNecessidadeCalorica(tmb, atividade, objetivo) {
  var fatores = { "Sedentário": 1.2, "Leve": 1.375, "Moderado": 1.55, "Intenso": 1.725, "Atleta": 1.9 };
  var fatorAtividade = fatores[atividade.toLowerCase()] || 1.2;
  var calorias = tmb * fatorAtividade;
  if (objetivo.toLowerCase() === "Ganhar massa muscular") calorias += 500;
  if (objetivo.toLowerCase() === "Perder gordura") calorias -= 500;
  return Math.round(calorias);
}

/**
 * Distribui as calorias totais em macronutrientes seguindo proporções específicas
 * @param {number} calorias - Total de calorias diárias
 * @param {string} objetivo - Usado para ajustes futuros na distribuição
 * @returns {Object} Objeto com quantidades em gramas de proteínas, carboidratos e gorduras
 */
function calcularMacronutrientes(calorias, objetivo) {
  var proteinas = Math.round((calorias * 0.3) / 4);
  var carboidratos = Math.round((calorias * 0.5) / 4);
  var gorduras = Math.round((calorias * 0.2) / 9);
  return { proteinas, carboidratos, gorduras };
}

/**
 * Calcula a recomendação de ingestão diária de água baseada no peso
 * @param {number} peso - Peso em quilogramas
 * @returns {string} Quantidade de água em ml com sufixo unitário
 */
function calcularAguaDiaria(peso) {
  return (peso * 35) + " ml";
}

/**
 * Gera plano alimentar personalizado usando API da OpenAI (GPT-4o)
 * @param {string} nome - Nome do usuário para personalização
 * @param {number} idade - Idade para ajustes nutricionais
 * @param {number} peso - Peso atual em kg
 * @param {number} altura - Altura em cm
 * @param {string} objetivo - Meta específica do usuário
 * @param {number} calorias - Meta calórica diária
 * @param {Object} macros - Distribuição de macronutrientes
 * @param {string} restricao - Restrições alimentares ou alergias
 * @param {string} culinaria - Preferências culinárias
 * @returns {string} Plano alimentar formatado com refeições e quantidades
 */
function gerarPlanoAlimentarGPT(nome, idade, peso, altura, objetivo, calorias, macros, restricao, culinaria) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  var url = "https://api.openai.com/v1/chat/completions";
  var prompt = `Crie um plano alimentar para ${nome}, ${idade} anos, ${peso}kg, ${altura}cm. Objetivo: ${objetivo}. Calorias: ${calorias}. Proteínas: ${macros.proteinas}g, Carboidratos: ${macros.carboidratos}g, Gorduras: ${macros.gorduras}g. Restrições: ${restricao}. Culinária preferida: ${culinaria}. Inclua café da manhã, lanche da manhã, almoço, lanche da tarde, jantar e ceia.`;
  
  var options = {
    method: "post",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    payload: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: "Você é um nutricionista especializado em planos alimentares. Sempre inclua quantidades precisas em gramas e medidas caseiras. Exemplo: '100g (1 xícara)'" }, { role: "user", content: prompt }, temperature: 0.5,] })
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var json = JSON.parse(response.getContentText());
  return json.choices[0].message.content;
}

/**
 * Envia e-mail ao usuário com os resultados do plano alimentar
 * @param {string} email - Endereço de e-mail do destinatário
 * @param {string} nome - Nome do usuário para personalização
 * @param {number} calorias - Meta calórica diária
 * @param {Object} macros - Distribuição de macronutrientes
 * @param {string} agua - Recomendação de ingestão hídrica
 * @param {string} plano - Plano alimentar completo formatado em HTML
 */
function enviarEmailUsuario(email, nome, calorias, macros, agua, plano) {
  var assunto = "🥗 Seu Plano Alimentar Personalizado";
  var corpo = `<h2>Olá ${nome}, aqui está seu plano alimentar!</h2>
  <p><b>Calorias:</b> ${calorias} kcal</p>
  <p><b>Proteínas:</b> ${macros.proteinas}gr</p>
  <p><b>Carboidratos:</b> ${macros.carboidratos}gr</p>
  <p><b>Gorduras:</b> ${macros.gorduras}gr</p>
  <p><b>Água diária:</b> ${agua}ml</p>
  <h3>Plano Alimentar:</h3>
  <p>${plano.replace(/\n/g, "<br>")}</p>`;
  
  MailApp.sendEmail({ to: email, subject: assunto, htmlBody: corpo });
}

/**
 * Notifica administradores sobre erros ocorridos no sistema
 * @param {string} erro - Mensagem de erro detalhada
 */
function enviarErroAdmin(erro) {
  MailApp.sendEmail("marcos.tolosa@owasp.org", "Erro no Script", "Erro ocorrido: " + erro);
}

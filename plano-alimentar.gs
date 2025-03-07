/**
 * Função principal que orquestra todo o fluxo:
 * - Obtém os dados da última linha preenchida na aba "Respostas do Formulário"
 * - Calcula os valores nutricionais
 * - Gera o plano alimentar no formato JSON padronizado (com marcadores)
 * - Atualiza a aba "Resultados Gerados" na primeira linha em branco:
 *     - Colunas A a J com os dados principais
 *     - Coluna K com a descrição das refeições (de Café da Manhã a Ceia)
 *     - Adiciona o plano completo como comentário na mesma célula
 * - Envia o e-mail com o plano alimentar em HTML
 */
function onFormSubmit(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(5000)) return;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const formSheet = ss.getSheetByName("Respostas do Formulário");
    const resultSheet = ss.getSheetByName("Resultados Gerados");
    let data;
    
    // Se acionado por trigger, usa os dados do evento; caso contrário, pega a última linha preenchida
    if (e && e.range) {
      data = e.values;
      Logger.log("Dados recebidos via trigger: " + JSON.stringify(data));
    } else {
      const lastRow = formSheet.getLastRow();
      data = formSheet.getRange(lastRow, 1, 1, formSheet.getLastColumn()).getValues()[0];
      Logger.log("Dados obtidos da última linha: " + JSON.stringify(data));
    }
    
    // Extração dos dados (ajuste os índices conforme seu formulário)
    const formData = {
      email: data[1].trim(),
      nome: data[2].trim(),
      objetivo: data[3].trim(),
      idade: parseInt((data[4] || "").toString().replace(/\D/g, "")) || 0,
      genero: data[5].trim(),
      altura: parseInt((data[6] || "").toString().replace(/\D/g, "")) || 0,
      peso: parseFloat((data[7] || "").toString().replace(/[^0-9.]/g, "")) || 0,
      atividade: data[8].trim(),
      restricao: data[9].trim(),
      whatsapp: (data[10] ? data[10].toString().replace(/\D/g, "").slice(0, 11) : ""),
      culinaria: data[11].trim()
    };
    Logger.log("Form Data: " + JSON.stringify(formData));
    
    // Validação dos dados essenciais
    validateData(formData);
    
    // Cálculos nutricionais
    const nutritionalData = calculateNutritionalValues(formData);
    Logger.log("Nutritional Data: " + JSON.stringify(nutritionalData));
    
    // Determina a primeira linha em branco na aba "Resultados Gerados"
    const targetRow = getFirstBlankRow(resultSheet, 1);
    Logger.log("Linha alvo para salvar resultados: " + targetRow);
    
    // Atualiza as colunas A a J com os dados calculados
    resultSheet.getRange(targetRow, 1, 1, 10).setValues([[
      formData.nome,
      formData.email,
      nutritionalData.calorias,
      nutritionalData.macros.proteinas,
      nutritionalData.macros.carboidratos,
      nutritionalData.macros.gorduras,
      formData.restricao,
      formData.culinaria,
      formData.whatsapp,
      nutritionalData.agua
    ]]);
    
    // Gera o plano alimentar (em formato JSON padronizado)
    let mealPlan = generateMealPlan(formData, nutritionalData);
    if (typeof mealPlan !== 'string') {
      mealPlan = JSON.stringify(mealPlan);
    }
    Logger.log("Plano Alimentar Completo (primeiros 500 caracteres): " + mealPlan.slice(0, 500));
    
    // Extrai a descrição das refeições (apenas o conteúdo das 6 refeições)
    const mealPlanDescription = extractMealPlanDescription(mealPlan);
    Logger.log("Descrição extraída das refeições: " + mealPlanDescription);
    
    // Atualiza a coluna K com a descrição e adiciona o plano completo como comentário
    resultSheet.getRange(targetRow, 11).setValue(mealPlanDescription);
    resultSheet.getRange(targetRow, 11).setWrap(true);
    resultSheet.getRange(targetRow, 11).setComment(mealPlan);
    
    // Envia o e-mail com o plano alimentar em HTML
    sendMealPlanEmail(formData.email, formData.nome, nutritionalData, mealPlan);
    
  } catch (error) {
    const errorMsg = `Erro: ${error.stack || error}`;
    Logger.log(errorMsg);
    sendErrorEmail(errorMsg);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Função auxiliar para encontrar a primeira linha em branco na coluna especificada.
 */
function getFirstBlankRow(sheet, column) {
  const data = sheet.getRange(1, column, sheet.getLastRow(), 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "") {
      return i + 1;
    }
  }
  return sheet.getLastRow() + 1;
}

/**
 * Valida os dados essenciais do formulário.
 */
function validateData(data) {
  if (!data.email.includes("@")) throw "E-mail inválido";
  if (data.peso < 30 || data.peso > 300) throw "Peso inválido (30-300kg)";
  if (data.altura < 100 || data.altura > 250) throw "Altura inválida (100-250cm)";
  if (isNaN(data.idade) || data.idade < 1) throw "Idade inválida";
}

/**
 * Calcula os valores nutricionais: TMB, calorias, macronutrientes e ingestão de água.
 */
function calculateNutritionalValues(data) {
  const tmb = calcularTMB(data.peso, data.altura, data.idade, data.genero);
  const calorias = calcularNecessidadeCalorica(tmb, data.atividade, data.objetivo);
  const macros = calcularMacronutrientes(calorias, data.objetivo);
  const agua = calcularIngestaoDiariaAgua(data.idade, data.peso);
  return { tmb, calorias, macros, agua };
}

/**
 * Calcula a TMB usando a fórmula de Harris-Benedict.
 */
function calcularTMB(peso, altura, idade, genero) {
  genero = genero.toLowerCase().trim();
  return (genero === "masculino")
    ? (10 * peso) + (6.25 * altura) - (5 * idade) + 5
    : (10 * peso) + (6.25 * altura) - (5 * idade) - 161;
}

/**
 * Calcula as calorias necessárias com base na TMB, atividade e objetivo.
 */
function calcularNecessidadeCalorica(tmb, atividade, objetivo) {
  const fatores = { "sedentário": 1.2, "leve": 1.375, "moderado": 1.55, "intenso": 1.725, "atleta": 1.9 };
  const fatorAtividade = fatores[atividade.toLowerCase()] || 1.2;
  let calorias = tmb * fatorAtividade;
  if (objetivo.toLowerCase() === "ganhar massa muscular") calorias += 500;
  if (objetivo.toLowerCase() === "perder gordura") calorias -= 500;
  return Math.round(calorias);
}

/**
 * Calcula os macronutrientes com a divisão: 30% proteínas, 50% carboidratos, 20% gorduras.
 */
function calcularMacronutrientes(calorias, objetivo) {
  const proteinas = Math.round((calorias * 0.3) / 4);
  const carboidratos = Math.round((calorias * 0.5) / 4);
  const gorduras = Math.round((calorias * 0.2) / 9);
  return { proteinas, carboidratos, gorduras };
}

/**
 * Calcula a ingestão diária de água com base na idade e no peso.
 *
 * @param {number} idade - Idade da pessoa em anos.
 * @param {number} peso - Peso da pessoa em quilogramas.
 * @return {number} - Ingestão diária recomendada de água em mililitros.
 */
function calcularIngestaoDiariaAgua(idade, peso) {
  if (idade <= 0 || peso <= 0) {
    throw new Error('Idade e peso devem ser maiores que zero.');
  }

  let mlPorKg;

  if (idade <= 17) {
    mlPorKg = 40;
  } else if (idade <= 55) {
    mlPorKg = 35;
  } else if (idade <= 65) {
    mlPorKg = 30;
  } else {
    mlPorKg = 25;
  }

  return mlPorKg * peso;
}

/**
 * Solicita à API do ChatGPT a geração do plano alimentar, retornando uma resposta
 * no formato JSON padronizado com os marcadores:
 *   ##CAFE##, ##LANCHE_MANHA##, ##ALMOCO##, ##LANCHE_TARDE##, ##JANTAR##, ##CEIA##, ##DESCRICAO##
 */
function generateMealPlan(formData, nutritionalData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  
  const url = "https://api.openai.com/v1/chat/completions";
  const prompt = `Crie um plano alimentar para ${formData.nome}, ${formData.idade} anos, ${formData.peso}kg, ${formData.altura}cm.
Objetivo: ${formData.objetivo}.
Calorias: ${nutritionalData.calorias}.
Proteínas: ${nutritionalData.macros.proteinas}g, Carboidratos: ${nutritionalData.macros.carboidratos}g, Gorduras: ${nutritionalData.macros.gorduras}g.
Restrições: ${formData.restricao}.
Culinária preferida: ${formData.culinaria}.
Por favor, retorne a resposta estritamente no seguinte formato JSON (sem textos adicionais):
{
  "description": "Breve descrição de como seguir a dieta.",
  "meals": {
    "cafe_da_manha": "Detalhes do café da manhã",
    "lanche_da_manha": "Detalhes do lanche da manhã",
    "almoco": "Detalhes do almoço",
    "lanche_da_tarde": "Detalhes do lanche da tarde",
    "jantar": "Detalhes do jantar",
    "ceia": "Detalhes da ceia"
  }
}`;
  
  const options = {
    method: "post",
    headers: { 
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Você é um nutricionista especializado em planos alimentares." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5
    })
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  let planText = json.choices[0].message.content;
  
  // Remove code fences se existirem
  if (planText.startsWith("```json")) {
    planText = planText.replace(/^```json\s*/, "").replace(/```$/, "").trim();
  } else if (planText.startsWith("```")) {
    planText = planText.replace(/^```\s*/, "").replace(/```$/, "").trim();
  }
  Logger.log("Resposta da API limpa: " + planText);
  return planText;
}

/**
 * Extrai a descrição do plano alimentar (a partir do marcador ##DESCRICAO##) do JSON retornado.
 */
function extractMealPlanDescription(mealPlan) {
  let data;
  try {
    data = JSON.parse(mealPlan);
  } catch (e) {
    Logger.log("Erro ao parsear JSON em extractMealPlanDescription: " + e);
    return "";
  }
  return data.description || "";
}

/**
 * Envia o e-mail com o plano alimentar em HTML.
 * O plain text é definido como string vazia para forçar a exibição do HTML.
 */
function sendMealPlanEmail(email, nome, nutritionalData, mealPlan) {
  // Extrai a descrição e os dados do plano alimentar do JSON
  const planData = JSON.parse(mealPlan);
  Logger.log("Plan Data extraída: " + JSON.stringify(planData));
  
  // Gera a tabela HTML para as refeições
  let mealsHtml = "";
  const mealOrder = ["cafe_da_manha", "lanche_da_manha", "almoco", "lanche_da_tarde", "jantar", "ceia"];
  mealOrder.forEach(key => {
    if (planData.meals && planData.meals[key]) {
      const title = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      mealsHtml += `<tr><td>${title}</td><td>${planData.meals[key]}</td></tr>`;
    }
  });
  if (mealsHtml !== "") {
    mealsHtml = `<table>${mealsHtml}</table>`;
  }
  Logger.log("Tabela HTML gerada: " + mealsHtml);
  
  const assunto = `Plano Alimentar Personalizado para ${nome} | IA Secrets`;
  const corpo = `
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
      h1 { color: #27ae60; text-align: center; }
      .section { margin-bottom: 20px; padding: 15px; border-radius: 8px; background: #f9f9f9; }
      .title { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
      th { background-color: #27ae60; color: white; }
      .footer { text-align: center; font-size: 14px; color: #555; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Seu Plano Alimentar Personalizado</h1>
      <p>Olá, <strong>${nome}</strong>! Aqui está o seu plano alimentar criado especialmente para você.</p>
      
      <div class="section">
        <div class="title">Como seguir este plano?</div>
        <p>${planData.description}</p>
      </div>
  
      <div class="section">
        <div class="title">Informações Nutricionais:</div>
        <table>
          <tr>
            <th>Calorias</th>
            <th>Proteínas</th>
            <th>Carboidratos</th>
            <th>Gorduras</th>
          </tr>
          <tr>
            <td>${nutritionalData.calorias} kcal</td>
            <td>${nutritionalData.macros.proteinas} g</td>
            <td>${nutritionalData.macros.carboidratos} g</td>
            <td>${nutritionalData.macros.gorduras} g</td>
          </tr>
        </table>
      </div>
  
      <div class="section">
        <div class="title">Plano Alimentar:</div>
        ${mealsHtml}
      </div>
  
      <div class="section">
        <div class="title">Ingestão de Água Recomendada:</div>
        <p>${nutritionalData.agua} ml por dia</p>
      </div>
  
      <p>Continue firme no seu objetivo! Se precisar de ajustes, estamos à disposição.</p>
      
      <div class="footer">
        <p><strong>Equipe MindSecurity AI @ 2025</strong></p>
      </div>
    </div>
  </body>
</html>
  `;
  Logger.log("Corpo do e-mail HTML (primeiros 500 caracteres): " + corpo.slice(0, 500));
  GmailApp.sendEmail(email, assunto, "", { htmlBody: corpo });
}

/**
 * Envia um e-mail de erro para o administrador.
 */
function sendErrorEmail(error) {
  GmailApp.sendEmail("marcos.tolosa@owasp.org", "Erro no Script de Nutrição", "Erro ocorrido: " + error);
}

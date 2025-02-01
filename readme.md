# 🥗 Dieta Personalizada com IA

Este projeto utiliza o **Google Apps Script** para processar respostas de um formulário do google, calcular as necessidades nutricionais (macros, ingestão de água...) e gerar um plano alimentar totalmente personalizado baseado nos macros e objetivo. 

## 🌟 Funcionalidades

- 📋 **Processamento de Respostas**: Coleta dados do Formulário.
- 🔢 **Cálculo Nutricional**: Calcula Taxa Metabólica Basal (TMB) e necessidades calóricas diárias (macros, água).
- 🥘 **Geração de Plano Alimentar**: Cria um plano alimentar personalizado feito por IA em formato JSON.
- 💾 **Armazenamento de Resultados**: Salva os resultados na planilha.
- 📧 **Envio por E-mail**: Envia o plano alimentar em formato HTML por e-mail.

## 🛠️ Estrutura do Projeto

- **Código Principal**: Função `onFormSubmit(e)` que orquestra todo o fluxo.
- **Funções Auxiliares**:
  - `getFirstBlankRow(sheet, column)`: Encontra a primeira linha em branco em uma coluna especificada.
  - `validateData(data)`: Valida os dados essenciais do formulário.
  - `calculateNutritionalValues(data)`: Calcula TMB, calorias, macronutrientes e ingestão de água.
  - `calcularTMB(peso, altura, idade, genero)`: Calcula a TMB usando a fórmula de Harris-Benedict.
  - `calcularNecessidadeCalorica(tmb, atividade, objetivo)`: Calcula as calorias necessárias com base na TMB, atividade e objetivo.
  - `calcularMacronutrientes(calorias, objetivo)`: Calcula a distribuição de macronutrientes.
  - `calcularIngestaoDiariaAgua(idade, peso)`: Calcula a ingestão diária recomendada de água.
  - `generateMealPlan(formData, nutritionalData)`: Gera o plano alimentar solicitando à API do ChatGPT-4o.
  - `extractMealPlanDescription(mealPlan)`: Extrai a descrição do plano alimentar do JSON retornado.
  - `sendMealPlanEmail(email, nome, nutritionalData, mealPlan)`: Envia o plano alimentar por e-mail em formato HTML.
  - `sendErrorEmail(error)`: Envia um e-mail para o administrador em casos de erros.

## 📋 Pré-requisitos

- **Planilha do Google**: Deve conter as abas "Respostas do Formulário" e "Resultados Gerados".
- **Formulário do Google**: Configurado para salvar respostas na aba "Respostas do Formulário".
- **API Key do OpenAI**: Necessária para a função `generateMealPlan` que utiliza a API do ChatGPT.

## ⚙️ Configuração

1. **Planilha**: Crie uma planilha com as abas mencionadas acima.
2. **Formulário**: Configure um formulário para coletar os dados necessários e salvar as respostas na planilha.
3. **Google Apps Script**: No editor de script da planilha, adicione o código fornecido.
4. **Propriedades do Script**: Adicione a chave da API do OpenAI nas propriedades do script com o nome 'OPENAI_API_KEY'.
5. **Triggers**: Configure um trigger para a função `onFormSubmit` ser executada ao enviar o formulário.

## 🚀 Uso

Após a configuração, sempre que uma nova resposta for submetida através do formulário:

1. A função `onFormSubmit` é acionada.
2. Os dados são processados e validados.
3. As necessidades nutricionais são calculadas.
4. Um plano alimentar personalizado é gerado utilizando a API do ChatGPT.
5. Os resultados são armazenados na aba "Resultados Gerados" da planilha.
6. O plano alimentar é enviado por e-mail ao usuário.

## 📞 Contato

Para dúvidas ou sugestões, sinta-se à vontade para entrar em contato:

- **Email**: [marcos.tolosa@owasp.org](mailto:marcos.tolosa@owasp.org)
- **LinkedIn**: [https://www.linkedin.com/in/marcos-tolosa](https://www.linkedin.com/in/marcos-tolosa)
- **GitHub**: [https://github.com/marcostolosa](https://github.com/marcostolosa)

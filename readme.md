# 📌 Google Apps Script - Plano Alimentar com IA

Este repositório contém um **Google Apps Script** que automatiza a geração de planos alimentares personalizados com base em respostas de um formulário do Google Forms. O script utiliza Inteligência Artificial - **OpenAI GPT-4o** - para criar dietas específicas e envia os resultados diretamente para os usuários via e-mail.

## 🚀 Funcionalidades
- Captura e valida os dados enviados pelo Google Forms
- Calcula **TMB** (Taxa Metabólica Basal) e necessidades calóricas
- Gera um plano alimentar baseado no objetivo do usuário
- Formata e armazena os dados na planilha "Resultados Gerados"
- Envia um e-mail ao usuário com o plano alimentar detalhado
- Registra logs e notifica erros ao administrador

## 🛠️ Como funciona
1. **Gatilho Automático**: O script é acionado sempre que um formulário for enviado.
2. **Processamento de Dados**: Ele valida os dados e realiza os cálculos necessários.
3. **Geração de Dieta**: O GPT-4o gera um plano alimentar com refeições detalhadas.
4. **Armazenamento**: Os dados são salvos na planilha "Resultados Gerados".
5. **Envio de E-mail**: O usuário recebe um e-mail com seu plano alimentar.

## 📋 Cálculos Utilizados

### 🎯 Taxa Metabólica Basal (TMB)
Usa a equação de **Mifflin-St Jeor**:
- **Homens**: `TMB = (10 × peso) + (6.25 × altura) - (5 × idade) + 5`
- **Mulheres**: `TMB = (10 × peso) + (6.25 × altura) - (5 × idade) - 161`

### 🔥 Necessidade Calórica Total
Baseado no nível de atividade:
- **Sedentário**: `TMB × 1.2`
- **Leve**: `TMB × 1.375`
- **Moderado**: `TMB × 1.55`
- **Intenso**: `TMB × 1.725`
- **Muito intenso**: `TMB × 1.9`

Dependendo do objetivo:
- **Ganhar Massa Muscular**: +500 kcal
- **Perder Gordura**: -500 kcal

### 🍽️ Macronutrientes
- **Proteínas**: `30% das calorias ÷ 4`
- **Carboidratos**: `50% das calorias ÷ 4`
- **Gorduras**: `20% das calorias ÷ 9`

### 💧 Recomendação de Água
`Peso (kg) × 35 ml`

## 🏗️ Configuração
1. Acesse o **Google Apps Script** no Google Sheets associado ao formulário.
2. Cole o código do repositório no editor de scripts.
3. Configure um **gatilho** para acionar `onFormSubmit` na submissão do formulário.
4. Adicione sua **OpenAI API Key** em **Propriedades do Script** (`OPENAI_API_KEY`).
5. Salve e execute para testar.

## 📩 Envio de E-mail
O usuário recebe um e-mail formatado com:
- Dados personalizados
- Informações calóricas e de macronutrientes
- Plano alimentar detalhado

## 🛠️ Personalizações
- Alterar o modelo do OpenAI para um diferente (ex: `gpt-4` em vez de `gpt-4o`)
- Modificar a lógica de cálculos conforme necessidade
- Customizar o e-mail enviado para melhor apresentação

## ⚠️ Logs e Erros
- Todas as falhas são registradas no **Logger do Apps Script**.
- Em caso de erro crítico, um e-mail é enviado para o administrador.

---

📌 **Criado por**: [Marcos Tolosa] | 📧 Contato: [marcos.tolosa@mindsecurity.org]

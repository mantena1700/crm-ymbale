# 📘 Documentação Técnica e Funcional - CRM Ymbale

## 1. Visão Geral do Sistema
O **CRM Ymbale** é uma plataforma de gestão de relacionamento com clientes especializada para executivos de vendas que atendem restaurantes. O objetivo central é transformar "listas frias" de leads (planilhas Excel) em uma **agenda de visitas otimizada e inteligente**, maximizando o tempo do vendedor em campo.

### Diferenciais Chave:
*   **Geografia como Core:** Toda a lógica de distribuição e agendamento gira em torno de localização (Latitude/Longitude).
*   **Agendamento Inteligente (V9):** Um algoritmo proprietário que otimiza a semana inteira de uma vez, garantindo a rota mais curta e eficiente, evitando o método tradicional de preenchimento dia-a-dia.
*   **Ancoragem:** Utiliza "Clientes Fixos" (visitas recorrentes obrigatórias) como âncoras para preencher os "buracos" na agenda com prospecções próximas, maximizando a densidade de visitas.

---

## 2. Arquitetura Técnica
O sistema é construído como uma aplicação web moderna, utilizando Server-Side Rendering (SSR) e Server Actions para alta performance e segurança.

### Tech Stack
*   **Frontend & Backend:** Next.js 14+ (App Router). Todo o backend é executado via *Server Actions* (`'use server'`), eliminando a necessidade de uma API REST separada.
*   **Linguagem:** TypeScript (para tipagem estática rigorosa e segurança de código).
*   **Banco de Dados:** PostgreSQL, gerenciado via **Prisma ORM**.
*   **Estilização:** CSS Puro (Modules) e TailwindCSS (em módulos mais recentes).
*   **Gestão de Processos:** PM2 (para execução em produção na VPS).

### Integrações Externas
*   **Google Maps Platform:**
    *   *Distance Matrix API:* Para cálculo de tempos de viagem reais (driving mode).
    *   *Geocoding API:* Para transformar endereços de texto em coordenadas (Lat/Lng).
*   **Inteligência Artificial:**
    *   *OpenAI / Google Gemini:* Para análise de dados não estruturados, geração de scores de lead e insights automáticos.
*   **Autenticação:**
    *   *Auth.js (NextAuth v5):* Gestão completa de sessões e segurança.

---

## 3. Estrutura do Banco de Dados (Prisma)
O banco de dados é relacional e centrado na conexão entre Vendedores e Restaurantes.

### Principais Entidades

#### 1. Seller (Executivo)
Representa o vendedor ou gerente de conta.
*   **Função:** É o "dono" de uma carteira de clientes.
*   **Território:** Define a área de atuação geográfica, podendo ser configurada de duas formas:
    *   **Raio:** Um ponto central (Lat/Lng) e uma distância em Km.
    *   **Polígono:** Uma área desenhada no mapa (array de coordenadas) para precisão máxima.

#### 2. Restaurant (Lead/Cliente)
A unidade central de informação.
*   **Dados Chave:**
    *   `salesPotential`: Potencial de venda (ALTÍSSIMO, ALTO, MÉDIO, BAIXO).
    *   `status`: Estágio no funil (A Analisar, Qualificado, Contatado, Fechado).
    *   `latitude`/`longitude`: Coordenadas vitais para o algoritmo V9.
    *   `codigoCliente`: ID único para sincronização com ERPs legado.

#### 3. FixedClient (Cliente Fixo)
Define as obrigações fixas da agenda do vendedor.
*   **Propósito:** Serve como "Âncora Geográfica". O algoritmo sabe que o vendedor *precisa* estar aqui em determinado dia.
*   **Recorrência:** Configurável (ex: "Toda segunda-feira" ou "Dias 5 e 20 do mês").

#### 4. FollowUp (Agendamento) e Visit (Histórico)
*   **FollowUp:** Representa o futuro (o que está marcado).
*   **Visit:** Representa o passado (o que foi realizado, feedback e resultado).

---

## 4. Lógica de Planilhas (Importação e Exportação)

### 4.1. Importação Inteligente (Fuzzy Matching)
Arquivo de referência: `src/app/actions-import-helper.ts`

O sistema aceita planilhas de leads "sujas" ou despadronizadas. Ele utiliza uma lógica de correspondência aproximada para mapear colunas:
1.  **Varredura:** Lê a primeira linha (cabeçalho).
2.  **Detecção:** Procura palavras-chave flexíveis (ex: para encontrar o nome, busca por "cliente", "razão", "nome fantasia").
3.  **Normalização:** Padroniza automaticamente valores de status (ex: converte "Cliente Top" ou "A+" para `ALTÍSSIMO`).

### 4.2. Exportação de Agenda (`actions.ts`)
Para uso em campo ou relatórios administrativos.
1.  **Template:** O sistema carrega um arquivo base (`template_agendamento.xlsx`) que contém formatação, logos e fórmulas da empresa.
2.  **Injeção:** Os dados da agenda gerada são inseridos nas células específicas deste template, preservando o layout visual.
3.  **Resultado:** O usuário baixa um Excel profissional pronto para impressão ou envio por e-mail.

---

## 5. Lógica de Negócio Central

### 5.1. Atribuição Geográfica Automática
Arquivo de referência: `src/lib/geographic-attribution.ts`

Quando um lead é importado, ele não fica "órfão". O sistema decide quem é o dono:
1.  **Geocodificação:** Converte o endereço em coordenadas.
2.  **Ray Casting (Matemática):** Verifica se o ponto está dentro de algum Polígono de vendedor.
3.  **Proximidade:** Se não houver polígono, calcula a distância linear até a base de cada vendedor. O mais próximo assume o lead.

### 5.2. O Algoritmo "Smart Filling V9" (Global Match)
Arquivo de referência: `src/app/carteira/actions-intelligent.ts`

Este é o diferencial competitivo do sistema. Ele resolve o problema da ineficiência logística.

**Funcionamento:**
1.  **Setup da Semana:** O sistema planta os "Clientes Fixos" (âncoras) nos dias da semana corretos.
2.  **Cálculo da Matriz Global:**
    *   Identifica todos os leads disponíveis num raio de 20km das âncoras.
    *   Calcula o tempo de deslocamento real (via Google Maps) de *todas* as âncoras para *todos* os candidatos.
3.  **Otimização Global (Greedy):**
    *   O algoritmo não preenche a Segunda-feira primeiro. Ele procura o **melhor casamento** da semana inteira (menor tempo de deslocamento).
    *   *Exemplo:* Se o restaurante R1 fica a 2 minutos da âncora de Terça e a 15 minutos da âncora de Segunda, o sistema força o agendamento para Terça, preservando a eficiência global.
4.  **Round Robin (Fallback):**
    *   Após alocar os leads perfeitos, se sobrarem candidatos e vagas, o sistema distribui um para cada dia sequencialmente, garantindo equilíbrio de carga de trabalho.

---

## 6. Funcionalidades da Interface

### 6.1. Aba Carteira
*   **Funil Visual:** Cards em estilo Kanban ou lista, filtráveis por status e potencial.
*   **Ações Rápidas:** Botões para "Análise IA" (score automático) e "Smart Fill" (geração de agenda).

### 6.2. Aba Relatórios e Dashboard
*   **Métricas em Tempo Real:** Total de leads, projeção financeira e conversão.
*   **Heatmaps:** Visualização das cidades e bairros com maior concentração de oportunidades.

### 6.3. Aba Metas
*   **Gestão de Performance:** Definição de objetivos numéricos (vendas/visitas) e acompanhamento visual do progresso do vendedor.

---

## 7. Fluxo de Dados (Data Flow)
1.  **Entrada:** Upload de Excel -> Parser Fuzzy -> Banco de Dados.
2.  **Processamento:** Trigger de Atribuição Geográfica -> Define Vendedor (`sellerId`).
3.  **Planejamento:** Vendedor define Clientes Fixos (Recorrência).
4.  **Otimização:** Execução do Algoritmo V9 -> Gera sugestão de agenda.
5.  **Ação:** Vendedor aprova agenda -> Grava `FollowUps`.
6.  **Execução:** Visita realizada -> Vendedor preenche Feedback -> Grava `Visit` -> Retroalimenta Estatísticas.

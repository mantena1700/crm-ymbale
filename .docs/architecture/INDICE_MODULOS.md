# 📚 ÍNDICE DE MÓDULOS - CRM YMBALE

Este documento serve como índice e guia de navegação para todos os módulos de implementação do sistema.

## 📋 Documentos Principais

1. **[INSTRUCOES_COMPLETAS_SISTEMA.md](./INSTRUCOES_COMPLETAS_SISTEMA.md)**
   - Documento principal com visão geral completa
   - Todas as funcionalidades documentadas
   - Fluxos principais do sistema
   - Arquitetura e estrutura

## 🔧 Módulos de Implementação

### MÓDULO 1: Banco de Dados
📄 **[MODULO_1_BANCO_DADOS.md](./MODULO_1_BANCO_DADOS.md)**
- Configuração do Prisma
- Criação de modelos
- Relacionamentos
- Índices de performance
- Migrações e seed

**Ordem de Implementação:** 1º

---

### MÓDULO 2: Autenticação e Segurança
📄 **[MODULO_2_AUTENTICACAO.md](./MODULO_2_AUTENTICACAO.md)**
- Sistema de autenticação
- Hash de senhas (bcrypt)
- Sessões e cookies
- Middleware de proteção
- Sistema de permissões

**Ordem de Implementação:** 2º

**Dependências:** Módulo 1

---

### MÓDULO 3: Importação de Dados
📄 **[MODULO_3_IMPORTACAO.md](./MODULO_3_IMPORTACAO.md)**
- Importação de Excel/TXT
- Parser de arquivos
- Normalização de dados
- Atribuição automática
- Tratamento de erros

**Ordem de Implementação:** 3º

**Dependências:** Módulo 1, Módulo 2, Módulo 4 (parcial)

---

### MÓDULO 4: Atribuição Geográfica
📄 **[MODULO_4_ATRIBUICAO_GEOGRAFICA.md](./MODULO_4_ATRIBUICAO_GEOGRAFICA.md)**
- Cálculo de distância (Haversine)
- Geocoding (Google Maps)
- Verificação de polígono (Ray Casting)
- Atribuição automática
- Sistema de zonas (legado)

**Ordem de Implementação:** 4º

**Dependências:** Módulo 1

**APIs Necessárias:** Google Maps API Key

---

### MÓDULO 5: Pipeline e Status
📄 **[MODULO_5_PIPELINE.md](./MODULO_5_PIPELINE.md)**
- Gestão de status
- Visualização Kanban
- Drag & Drop
- Priorização automática
- Métricas do pipeline

**Ordem de Implementação:** 5º

**Dependências:** Módulo 1, Módulo 2

---

### MÓDULO 6: Carteira e Executivos
📄 **[MODULO_6_CARTEIRA.md](./MODULO_6_CARTEIRA.md)**
- Carteira padrão
- Carteira por executivo
- Planejamento semanal
- Mapa tecnológico
- Clientes fixos
- Exportações

**Ordem de Implementação:** 6º

**Dependências:** Módulo 1, Módulo 2, Módulo 4

---

### MÓDULO 7: Dashboard e Relatórios
📄 **[MODULO_7_DASHBOARD.md](./MODULO_7_DASHBOARD.md)**
- Dashboard principal
- Métricas e KPIs
- Gráficos (Pie, Bar, Line)
- Relatórios por executivo
- Relatórios por período
- Exportação de relatórios

**Ordem de Implementação:** 7º

**Dependências:** Módulo 1, Módulo 2

**Bibliotecas:** recharts ou chart.js

---

### MÓDULO 8: Campanhas e Workflows
📄 **[MODULO_8_CAMPANHAS.md](./MODULO_8_CAMPANHAS.md)**
- Sistema de campanhas
- Segmentação de destinatários
- Templates de email
- Execução de campanhas
- Workflows de automação
- Triggers e condições

**Ordem de Implementação:** 8º

**Dependências:** Módulo 1, Módulo 2

**Integrações:** Serviço de email (SendGrid, Mailgun, etc.)

---

## 📊 Ordem Recomendada de Implementação

```
1. Módulo 1 (Banco de Dados)
   ↓
2. Módulo 2 (Autenticação)
   ↓
3. Módulo 4 (Atribuição Geográfica) - Parcial
   ↓
4. Módulo 3 (Importação)
   ↓
5. Módulo 5 (Pipeline)
   ↓
6. Módulo 6 (Carteira)
   ↓
7. Módulo 7 (Dashboard)
   ↓
8. Módulo 8 (Campanhas)
```

## 🔗 Dependências entre Módulos

```
Módulo 1 (BD)
  ├─→ Módulo 2 (Auth)
  ├─→ Módulo 4 (Geo)
  ├─→ Módulo 5 (Pipeline)
  ├─→ Módulo 6 (Carteira)
  ├─→ Módulo 7 (Dashboard)
  └─→ Módulo 8 (Campanhas)

Módulo 2 (Auth)
  ├─→ Módulo 3 (Importação)
  ├─→ Módulo 5 (Pipeline)
  ├─→ Módulo 6 (Carteira)
  ├─→ Módulo 7 (Dashboard)
  └─→ Módulo 8 (Campanhas)

Módulo 4 (Geo)
  └─→ Módulo 3 (Importação)
      └─→ Módulo 6 (Carteira)
```

## 📝 Notas Importantes

1. **Módulo 1 é obrigatório primeiro** - Todos os outros dependem do banco de dados
2. **Módulo 2 deve vir em seguida** - Proteção de rotas é essencial
3. **Módulo 4 pode ser parcial** - Apenas funções básicas necessárias para importação
4. **Módulos 5-8 são independentes** - Podem ser implementados em paralelo após base

## 🧪 Testes

Cada módulo deve ser testado individualmente antes de prosseguir:
- Testes unitários das funções
- Testes de integração com banco
- Testes de UI (se aplicável)

## 🚀 Deploy

Após concluir todos os módulos:
1. Testes finais
2. Build de produção
3. Configuração de variáveis de ambiente
4. Deploy na VPS/servidor
5. Configuração de SSL/HTTPS
6. Monitoramento

---

**Última atualização:** Dezembro 2025

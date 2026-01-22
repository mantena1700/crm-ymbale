# 🎯 CRM Ymbale

Sistema de CRM completo para gestão de vendas, pipeline de leads, carteira de clientes e campanhas de marketing.

## 📋 Funcionalidades Principais

- **Pipeline de Vendas**: Gestão completa do funil de vendas com Kanban
- **Carteira de Clientes**: Organização e agendamento inteligente de visitas
- **Campanhas**: Automação de marketing com workflows e templates
- **Análise IA**: Análise inteligente de leads e sugestões de estratégia
- **Atribuição Geográfica**: Distribuição automática de clientes por região
- **Relatórios**: Dashboards e relatórios de performance

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 18+
- PostgreSQL
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Executar migrações do banco
npx prisma migrate dev

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: `http://localhost:3000`

## 📚 Documentação

A documentação completa está organizada em `.docs/`:

- **[Arquitetura](.docs/architecture/)** - Estrutura do sistema e módulos
- **[Deployment](.docs/deployment/)** - Guias de deploy e troubleshooting
- **[Guias](.docs/guides/)** - Manuais de usuário e desenvolvedor
- **[Changelog](.docs/changelog/)** - Histórico de mudanças

## 🔧 Scripts Disponíveis

### Desenvolvimento
```bash
npm run dev              # Servidor de desenvolvimento
npm run build            # Build de produção
npm run start            # Iniciar produção
```

### Banco de Dados
```bash
npm run ensure-fixed-clients    # Garantir tabela de clientes fixos
npm run populate-coords         # Popular coordenadas
npm run setup-geographic        # Configurar atribuição geográfica
```

### Utilitários
```bash
npm run diagnostico      # Diagnóstico do sistema
npm run reatribuir       # Reatribuir restaurantes
```

## 🛠️ Scripts de Manutenção

Scripts de deploy e manutenção estão em `.scripts/`:

- **Deployment**: `.scripts/deployment/` - Deploy e atualizações
- **Maintenance**: `.scripts/maintenance/` - Limpeza e diagnósticos
- **Development**: `.scripts/development/` - Ferramentas de dev

## 🏗️ Estrutura do Projeto

```
crm-ymbale/
├── .docs/              # Documentação
├── .scripts/           # Scripts de automação
├── src/
│   ├── app/           # Páginas e rotas Next.js
│   ├── components/    # Componentes React
│   ├── lib/           # Bibliotecas e utilitários
│   └── styles/        # Estilos globais
├── prisma/            # Schema e migrações
└── public/            # Arquivos estáticos
```

## 🔐 Segurança

Consulte [SECURITY.md](.docs/SECURITY.md) para informações sobre segurança e boas práticas.

## 📝 Licença

Propriedade de Ymbale - Todos os direitos reservados.

## 🤝 Suporte

Para dúvidas ou problemas:
1. Consulte a [documentação](.docs/)
2. Verifique o [troubleshooting](.docs/deployment/troubleshooting.md)
3. Entre em contato com a equipe de desenvolvimento

# 🚀 Guia de Migração para Supabase - CRM Ymbale

## ✅ O que foi configurado:

### 1. **Banco de Dados Supabase**
- ✅ Schema completo criado (restaurants, comments, analyses, notes, follow_ups, goals, etc.)
- ✅ Tabela de vendedores (sellers) adicionada
- ✅ Sistema de direcionamento automático por região

### 2. **Prisma ORM**
- ✅ Schema configurado
- ✅ Cliente Prisma gerado
- ✅ Conexão com banco estabelecida

### 3. **Sistema de Importação**
- ✅ Script de migração criado (`scripts/migrate-excel-to-db.ts`)
- ✅ Interface de upload de planilhas
- ✅ Direcionamento automático para vendedores

## 📋 Próximos Passos:

### Passo 1: Adicionar tabela de vendedores no Supabase

1. Acesse o Supabase → SQL Editor
2. Execute o arquivo `scripts/add-sellers-table.sql`
3. Isso criará a tabela `sellers` e adicionará as colunas necessárias em `restaurants`

### Passo 2: Migrar dados existentes (OPCIONAL)

Se você quiser migrar os dados que já estão nas planilhas:

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-excel-to-db.ts
```

Este script irá:
- Criar 5 vendedores padrão
- Importar todos os restaurantes das planilhas Excel
- Atribuir vendedores automaticamente baseado na cidade
- Evitar duplicatas

### Passo 3: Usar a interface de importação

1. Acesse `/settings` no CRM
2. Use a seção "📤 Importar Planilha Excel"
3. Faça upload de uma planilha .xlsx
4. O sistema irá:
   - Importar todos os restaurantes
   - Atribuir vendedores automaticamente
   - Ignorar duplicatas
   - Mostrar estatísticas da importação

## 👥 Configurar Vendedores

### Via SQL (Recomendado):
Execute no Supabase SQL Editor:

```sql
-- Atualizar vendedores com suas regiões reais
UPDATE sellers SET 
  name = 'Nome do Vendedor 1',
  email = 'email@exemplo.com',
  phone = '(11) 99999-9999',
  regions = '["Sorocaba", "Votorantim", "Piedade"]'::jsonb
WHERE id = (SELECT id FROM sellers LIMIT 1 OFFSET 0);

-- Repita para os outros 4 vendedores (OFFSET 1, 2, 3, 4)
```

### Ou criar novos vendedores:

```sql
INSERT INTO sellers (name, email, phone, regions, active) VALUES
('João Silva', 'joao@ymbale.com', '(11) 99999-9999', '["Sorocaba", "Votorantim"]'::jsonb, TRUE),
('Maria Santos', 'maria@ymbale.com', '(11) 88888-8888', '["São Paulo", "Guarulhos"]'::jsonb, TRUE);
```

## 🔄 Fluxo de Trabalho Recomendado:

1. **Scraping coleta dados** → Salva em planilhas Excel
2. **Você faz upload** → Via interface em `/settings`
3. **Sistema importa** → Direciona automaticamente para vendedores
4. **Vendedores trabalham** → Cada um vê apenas seus leads

## 📊 Estrutura de Vendedores:

Cada vendedor tem:
- **Nome** e **Contato** (email, telefone)
- **Regiões**: Array de cidades que ele atende
- **Status**: Ativo/Inativo

O sistema atribui automaticamente um restaurante ao vendedor se a cidade do restaurante estiver nas regiões do vendedor.

## 🎯 Próximas Melhorias Sugeridas:

1. Página de gerenciamento de vendedores (`/sellers`)
2. Dashboard por vendedor
3. Relatórios por vendedor
4. Notificações quando novos leads são atribuídos

## ⚠️ Importante:

- **Backup**: O Supabase faz backup automático
- **Duplicatas**: O sistema evita importar restaurantes duplicados (mesmo nome + cidade)
- **Performance**: Importações grandes podem levar alguns minutos
- **Regiões**: Configure as regiões dos vendedores corretamente para o direcionamento funcionar

## 🆘 Suporte:

Se tiver problemas:
1. Verifique se a tabela `sellers` existe no banco
2. Verifique se os vendedores estão cadastrados
3. Verifique se as regiões estão configuradas corretamente
4. Veja os logs no console do servidor


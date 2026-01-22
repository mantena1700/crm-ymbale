# ✅ Checklist de Atualização - VPS

Use este checklist antes de fazer deploy na VPS.

---

## 📋 Pré-Deploy

### Backup
- [ ] Backup do banco de dados criado
- [ ] Backup armazenado em local seguro
- [ ] Data/hora do backup anotada

### Código
- [ ] Código atualizado do GitHub (`git pull`)
- [ ] Sem conflitos de merge
- [ ] Branch correto (main/master)
- [ ] Último commit verificado

### Dependências
- [ ] `package.json` verificado
- [ ] `package-lock.json` atualizado
- [ ] Dependências instaladas (`npm install`)
- [ ] Sem vulnerabilidades críticas

### Banco de Dados
- [ ] `prisma/schema.prisma` verificado
- [ ] Prisma Client gerado (`npx prisma generate`)
- [ ] Schema aplicado (`npx prisma db push`)
- [ ] Tabelas novas criadas (se houver)
- [ ] Colunas novas adicionadas (se houver)

### Configuração
- [ ] `.env` atualizado (se necessário)
- [ ] Variáveis de ambiente verificadas
- [ ] `DATABASE_URL` correto
- [ ] `NODE_ENV=production`

---

## 🚀 Deploy

### Build
- [ ] Build executado (`npm run build`)
- [ ] Build sem erros
- [ ] Warnings verificados (se houver)

### Aplicação
- [ ] Aplicação reiniciada (`pm2 restart`)
- [ ] Status verificado (`pm2 status`)
- [ ] Logs verificados (`pm2 logs`)

### Serviços
- [ ] PostgreSQL rodando
- [ ] Nginx rodando
- [ ] Porta 3000 acessível

---

## ✅ Pós-Deploy

### Testes Funcionais
- [ ] Login funcionando
- [ ] Dashboard carregando
- [ ] Página de zonas acessível (`/admin/zonas`)
- [ ] Página de executivos funcionando (`/sellers`)
- [ ] Página de carteira funcionando (`/carteira`)
- [ ] Criação de zona funcionando
- [ ] Atribuição de zona ao executivo funcionando
- [ ] Sincronização de restaurantes funcionando

### Verificações de Banco
- [ ] Tabela `zonas_cep` existe
- [ ] Tabela `seller_zonas` existe
- [ ] Coluna `zona_id` em `restaurants` existe
- [ ] Dados preservados

### Performance
- [ ] Tempo de resposta adequado
- [ ] Sem erros no console
- [ ] Logs sem erros críticos

---

## 🔧 Se Algo Der Errado

### Rollback
- [ ] Código revertido (`git revert` ou `git reset`)
- [ ] Build anterior restaurado
- [ ] Banco de dados restaurado do backup (se necessário)
- [ ] Aplicação reiniciada

### Debug
- [ ] Logs verificados (`pm2 logs`)
- [ ] Erros identificados
- [ ] Solução documentada

---

## 📝 Notas

Adicione notas sobre o deploy:

- Data: ___________
- Versão: ___________
- Responsável: ___________
- Observações: ___________

---

**Última atualização:** Dezembro 2025

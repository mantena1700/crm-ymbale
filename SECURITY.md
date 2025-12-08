# 🔒 Segurança do CRM Ymbale

Este documento descreve as medidas de segurança implementadas e recomendações.

## ✅ Medidas Implementadas

### Autenticação
- ✅ Senhas hasheadas com bcrypt (salt de 12 rounds)
- ✅ Bloqueio de conta após 3 tentativas de login incorretas
- ✅ Tokens de sessão gerados com `crypto.getRandomValues()` (criptograficamente seguros)
- ✅ Sessões com expiração de 24 horas
- ✅ Validação de sessão em cada requisição

### Proteção de Dados
- ✅ Variáveis sensíveis em arquivos `.env` (não commitados)
- ✅ Senhas nunca expostas em logs ou respostas de API
- ✅ Cookies HttpOnly para tokens de sessão

### Controle de Acesso
- ✅ Sistema de roles (admin/user)
- ✅ Middleware de autenticação em rotas protegidas
- ✅ Notificação para admins quando conta é bloqueada

---

## ⚠️ Vulnerabilidades Conhecidas

### Pacote `xlsx` (High Severity)
- **Descrição**: Vulnerabilidade de "zip slip" em versões antigas
- **Risco**: Baixo em uso normal (apenas leitura de Excel enviado pelo usuário)
- **Mitigação**: 
  - Não processar arquivos de fontes não confiáveis
  - Validar arquivos antes do processamento
- **Status**: Monitorando atualizações do pacote

---

## 🔧 Configurações Recomendadas

### Produção com HTTPS

1. Configure um proxy reverso (Nginx) com SSL
2. Altere o cookie para `secure: true`:

```typescript
// src/app/api/auth/login/route.ts
cookieStore.set('session_token', token, {
    httpOnly: true,
    secure: true, // Habilitar após configurar HTTPS
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/'
});
```

### Senhas Fortes

- Mínimo 8 caracteres
- Combinar letras, números e símbolos
- Trocar senha padrão do admin imediatamente

### Backup Regular

```bash
# Backup diário do banco
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup_$(date +%Y%m%d).sql
```

---

## 📋 Checklist de Segurança para Deploy

- [ ] Trocar senha do admin padrão
- [ ] Configurar HTTPS
- [ ] Alterar `secure: true` nos cookies
- [ ] Configurar firewall (apenas portas 80, 443, 22)
- [ ] Configurar backups automáticos
- [ ] Monitorar logs de acesso
- [ ] Manter dependências atualizadas

---

## 🚨 Em Caso de Incidente

1. Bloquear usuários afetados
2. Revogar todas as sessões: `DELETE FROM sessions;`
3. Forçar reset de senhas
4. Analisar logs de acesso
5. Notificar administradores

---

## 📞 Contato

Para reportar vulnerabilidades, entre em contato com o administrador do sistema.

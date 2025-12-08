# 🚀 Deploy do CRM Ymbale na Hostinger VPS

## 📋 Requisitos da VPS

| Requisito | Mínimo |
|-----------|--------|
| **RAM** | 2 GB |
| **CPU** | 1 vCPU |
| **Disco** | 20 GB |
| **Sistema** | Ubuntu 22.04 ou 24.04 |

---

## 🔧 INSTALAÇÃO RÁPIDA (5 minutos)

### 1️⃣ Conectar na VPS via SSH

```bash
ssh root@SEU_IP_DA_HOSTINGER
```

### 2️⃣ Clonar o repositório

```bash
cd /root
git clone https://github.com/mantena1700/crm-ymbale.git
cd crm-ymbale
```

### 3️⃣ Executar instalação automática

```bash
chmod +x install.sh
./install.sh
```

**Pronto!** O script faz tudo automaticamente:
- ✅ Instala Docker
- ✅ Configura Firewall
- ✅ Constrói a aplicação
- ✅ Cria o banco de dados
- ✅ Cria o usuário admin

---

## 🌐 Acessar o Sistema

```
http://SEU_IP_DA_VPS
```

**Credenciais:**
- Usuário: `admin`
- Senha: `admin`

⚠️ **Troque a senha no primeiro acesso!**

---

## 📊 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `docker compose ps` | Ver status |
| `docker compose logs -f` | Ver logs |
| `docker compose restart` | Reiniciar |
| `docker compose down` | Parar |
| `docker compose up -d` | Iniciar |

---

## 🔄 Atualizar o Sistema

```bash
cd /root/crm-ymbale
git pull
docker compose down
docker compose up -d --build
```

---

## 💾 Backup do Banco

```bash
docker compose exec postgres pg_dump -U crm_user crm_ymbale > backup.sql
```

---

## 🆘 Problemas Comuns

### Porta não abre
```bash
ufw allow 80/tcp
ufw reload
```

### Container não inicia
```bash
docker compose logs crm
```

### Reiniciar tudo do zero
```bash
docker compose down -v
docker compose up -d --build
docker compose exec crm prisma db push --skip-generate
docker compose exec crm tsx scripts/create-admin.ts
```

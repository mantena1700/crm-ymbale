# 🚀 Guia Rápido - Como Usar o Sistema de Atribuição Geográfica

## ✅ Status Atual do Sistema

- ✅ **159 restaurantes** já têm executivo atribuído
- ✅ **Google Maps API Key** configurada
- ✅ **8 executivos** configurados geograficamente
- ✅ Sistema funcionando 100% com Google Maps (sem zonas CEP)

## 📍 Onde Ver os Restaurantes Atribuídos

### 1. Página de Clientes (`/clients`)

Acesse: **http://localhost:3000/clients**

Aqui você verá:
- Todos os restaurantes cadastrados
- Filtro por executivo (seller)
- Status de cada restaurante
- Informações completas

**Como filtrar por executivo:**
1. Na página de Clientes, use o filtro de "Executivo"
2. Selecione o executivo desejado
3. Verá apenas os restaurantes atribuídos a ele

### 2. Dashboard (`/`)

Acesse: **http://localhost:3000**

O dashboard mostra:
- Estatísticas gerais
- Restaurantes recentes
- Leads qualificados
- Distribuição por potencial

### 3. Página de Executivos (`/sellers`)

Acesse: **http://localhost:3000/sellers**

Aqui você pode:
- Ver todos os executivos
- Ver quantos restaurantes cada um tem
- Editar configurações de território

## 🔄 Como Funciona a Atribuição Automática

### Ao Importar uma Planilha:

1. **Você importa** uma planilha Excel com restaurantes
2. **Sistema automaticamente:**
   - Obtém coordenadas via Google Maps API
   - Calcula distância para cada executivo
   - Atribui ao executivo mais próximo dentro do raio
3. **Resultado:** Restaurante aparece na lista do executivo

### Distribuição Atual:

- **Celio Fernando**: 107 restaurantes (Sorocaba - raio 100km)
- **João Santana**: 43 restaurantes (SP Centro - raio 35km)
- **Cicero**: 9 restaurantes (Santo André - raio 15km)
- **Glauber**: 0 restaurantes (Campinas - raio 70km)
- **Reginaldo**: 0 restaurantes (SP Zona Leste - raio 140km)

## 🎯 Como Atribuir Manualmente (Se Necessário)

### Opção 1: Via Página de Clientes

1. Acesse `/clients`
2. Clique no restaurante
3. Edite o campo "Executivo"
4. Salve

### Opção 2: Re-atribuir Todos

Execute o script de re-atribuição:

```bash
npm run reatribuir
```

Isso vai:
- Recalcular distâncias usando Google Maps
- Re-atribuir restaurantes aos executivos mais próximos
- Atualizar automaticamente

## 🔍 Verificar se Está Funcionando

Execute o diagnóstico:

```bash
npm run diagnostico
```

Isso mostra:
- Quantos executivos estão configurados
- Quantos restaurantes têm coordenadas
- Quantos estão atribuídos
- Se a API Key está configurada

## ⚙️ Configurar Território de um Executivo

### Via Script (Automático):

```bash
npm run setup-geographic
```

### Via Banco de Dados (Manual):

```sql
UPDATE sellers SET 
  territorio_tipo = 'raio',
  base_cidade = 'Sua Cidade, SP',
  base_latitude = -23.5505,
  base_longitude = -46.6333,
  raio_km = 50,
  territorio_ativo = TRUE
WHERE name = 'Nome do Executivo';
```

## 📊 Entendendo os Resultados

### Se um restaurante não foi atribuído:

**Possíveis causas:**
1. Endereço inválido ou incompleto
2. Restaurante fora do raio de todos os executivos
3. Erro na API do Google Maps

**Solução:**
- Verifique o endereço do restaurante
- Expanda o raio de algum executivo
- Execute `npm run diagnostico` para ver detalhes

### Se muitos restaurantes estão com um executivo:

**Normal!** O sistema atribui ao executivo mais próximo dentro do raio.

**Para redistribuir:**
- Ajuste os raios dos executivos
- Ou execute `npm run reatribuir`

## 🆘 Problemas Comuns

### "Dashboard vazio"

**Causa:** Pode ser cache do navegador ou dados não carregados

**Solução:**
1. Recarregue a página (Ctrl+F5)
2. Verifique se há restaurantes: `npm run diagnostico`
3. Acesse `/clients` diretamente

### "Restaurantes não aparecem atribuídos"

**Causa:** Podem estar sem executivo atribuído

**Solução:**
1. Execute: `npm run reatribuir`
2. Verifique: `npm run diagnostico`
3. Importe novamente a planilha

### "Erro ao obter coordenadas"

**Causa:** API Key inválida ou endereço incorreto

**Solução:**
1. Verifique se `GOOGLE_MAPS_API_KEY` está no `.env`
2. Verifique se a API Key está ativa no Google Cloud Console
3. Verifique se o endereço do restaurante está completo

## 📝 Checklist Rápido

- [ ] API Key do Google Maps configurada no `.env`
- [ ] Executivos configurados (execute `npm run setup-geographic`)
- [ ] Restaurantes importados
- [ ] Restaurantes atribuídos (execute `npm run reatribuir` se necessário)
- [ ] Dashboard acessível em `http://localhost:3000`
- [ ] Página de Clientes acessível em `http://localhost:3000/clients`

## 🎉 Pronto!

O sistema está funcionando. Os restaurantes são atribuídos **automaticamente** quando você importa uma planilha. Não precisa fazer nada manualmente!

---

**Dúvidas?** Execute `npm run diagnostico` para ver o status completo do sistema.


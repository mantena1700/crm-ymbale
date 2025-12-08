# 📦 Configurar Supabase Storage para Fotos de Vendedores

## Passo 1: Criar o Bucket no Supabase

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Storage** (no menu lateral)
4. Clique em **"New bucket"** ou **"Criar bucket"**
5. Configure:
   - **Name**: `seller-photos`
   - **Public bucket**: ✅ **MARQUE COMO PÚBLICO** (para que as imagens sejam acessíveis via URL pública)
   - **File size limit**: 5 MB (ou o valor que preferir)
   - **Allowed MIME types**: `image/*` (ou deixe vazio para aceitar todos)

6. Clique em **"Create bucket"**

## Passo 2: Configurar Políticas de Acesso (RLS)

1. Ainda na página de **Storage**, clique no bucket `seller-photos`
2. Vá na aba **"Policies"** ou **"Políticas"**
3. Clique em **"New Policy"** ou **"Nova Política"**
4. Selecione **"For full customization"** ou **"Para personalização completa"**

### Política de Upload (INSERT):
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'seller-photos');
```

### Política de Leitura (SELECT):
```sql
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'seller-photos');
```

### Política de Atualização (UPDATE):
```sql
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'seller-photos');
```

### Política de Exclusão (DELETE):
```sql
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'seller-photos');
```

**OU**, se preferir uma política mais simples que permite tudo para usuários autenticados:

```sql
CREATE POLICY "Allow all operations for authenticated users"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'seller-photos')
WITH CHECK (bucket_id = 'seller-photos');
```

## Passo 3: Verificar Variáveis de Ambiente

Certifique-se de que o arquivo `.env.local` contém:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

## Passo 4: Testar o Upload

1. Acesse `/sellers` no CRM
2. Edite um vendedor
3. Faça upload de uma foto
4. Salve

Se tudo estiver configurado corretamente, a foto será salva no Supabase Storage e a URL será armazenada no banco de dados.

## 🔍 Verificar se Funcionou

1. No Supabase Dashboard, vá em **Storage** → **seller-photos**
2. Você deve ver a foto que foi enviada
3. A URL da foto deve estar salva no campo `photo_url` da tabela `sellers`

## ⚠️ Troubleshooting

### Erro: "Bucket not found"
- Certifique-se de que o bucket `seller-photos` foi criado
- Verifique se o nome está exatamente como `seller-photos` (sem espaços, minúsculas)

### Erro: "Permission denied"
- Verifique se as políticas RLS foram criadas corretamente
- Certifique-se de que o bucket está marcado como público (se quiser URLs públicas)

### Erro: "Failed to fetch"
- Verifique se as variáveis de ambiente estão corretas
- Verifique se o `SUPABASE_SERVICE_ROLE_KEY` está correto (não use a anon key)


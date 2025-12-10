import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // Verificar autenticação
        const authResult = await verifyAuth(request);
        if (!authResult.authenticated || authResult.user?.role !== 'admin') {
            return NextResponse.json(
                { error: 'Acesso negado. Apenas administradores podem fazer upload de logo.' },
                { status: 403 }
            );
        }

        if (!supabase) {
            return NextResponse.json(
                { error: 'Supabase não está configurado. Configure as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY' },
                { status: 500 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('logo') as File;
        const type = formData.get('type') as string; // 'crmLogo', 'crmFavicon' ou 'loginLogo'
        
        if (!file || file.size === 0) {
            return NextResponse.json(
                { error: 'Nenhum arquivo enviado' },
                { status: 400 }
            );
        }

        // Validar tipo de arquivo
        if (!file.type.startsWith('image/')) {
            return NextResponse.json(
                { error: 'Apenas imagens são permitidas (JPG, PNG, SVG, ICO, etc.)' },
                { status: 400 }
            );
        }

        // Validar tamanho (5MB para logo, 1MB para favicon)
        const maxSize = type === 'crmFavicon' ? 1 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `Arquivo muito grande. Máximo ${type === 'crmFavicon' ? '1MB' : '5MB'}` },
                { status: 400 }
            );
        }

        console.log(`📤 Iniciando upload de ${type} para Supabase Storage...`, file.name, file.size);

        // Verificar se o bucket existe, se não existir, criar
        const BUCKET_NAME = 'system-assets';
        
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
        
        if (!bucketExists) {
            console.log('📦 Bucket não existe, criando...');
            const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
            });
            
            if (createError) {
                console.error('❌ Erro ao criar bucket:', createError);
                return NextResponse.json(
                    { error: `Erro ao criar bucket: ${createError.message}` },
                    { status: 500 }
                );
            }
            console.log('✅ Bucket criado com sucesso!');
        }

        // Converter File para ArrayBuffer e depois para Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const extension = sanitizedName.split('.').pop() || 'png';
        const filename = `${type}_${timestamp}_${randomStr}.${extension}`;

        // Fazer upload para Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filename, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (uploadError) {
            console.error('❌ Erro no upload para Supabase:', uploadError);
            return NextResponse.json(
                { error: `Erro ao fazer upload: ${uploadError.message}` },
                { status: 500 }
            );
        }

        console.log('✅ Upload concluído:', uploadData);

        // Obter URL pública da imagem
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filename);

        const logoUrl = urlData.publicUrl;
        console.log('✅ URL pública gerada:', logoUrl);

        // Retornar URL - o componente cliente irá salvar via API normal
        return NextResponse.json({ success: true, logoUrl, type });
    } catch (error: any) {
        console.error('❌ Erro completo no upload:', error);
        return NextResponse.json(
            { error: error.message || 'Erro desconhecido ao fazer upload da logo' },
            { status: 500 }
        );
    }
}


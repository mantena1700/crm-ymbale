'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    department: string;
    photoUrl?: string;
    bio?: string;
    preferences: {
        notifications: boolean;
        emailAlerts: boolean;
        theme: 'dark' | 'light';
    };
    createdAt: string;
}

// Por enquanto, usando um perfil padrão já que não temos sistema de autenticação
const DEFAULT_PROFILE: UserProfile = {
    id: 'default-user',
    name: 'Admin',
    email: 'admin@ymbale.com.br',
    phone: '(11) 99999-9999',
    role: 'Gerente Comercial',
    department: 'Vendas',
    bio: 'Gerente responsável pela equipe comercial e prospecção de novos clientes.',
    preferences: {
        notifications: true,
        emailAlerts: true,
        theme: 'dark'
    },
    createdAt: new Date().toISOString()
};

// Buscar perfil do localStorage via cookie ou criar um novo
export async function getProfile(): Promise<UserProfile> {
    try {
        // Tentar buscar do banco se existir tabela de users
        const user = await prisma.$queryRaw`SELECT * FROM users WHERE id = 'default-user' LIMIT 1` as any[];
        
        if (user && user.length > 0) {
            return {
                id: user[0].id,
                name: user[0].name,
                email: user[0].email,
                phone: user[0].phone || '',
                role: user[0].role || 'Usuário',
                department: user[0].department || '',
                photoUrl: user[0].photo_url,
                bio: user[0].bio,
                preferences: user[0].preferences || DEFAULT_PROFILE.preferences,
                createdAt: user[0].created_at?.toISOString() || new Date().toISOString()
            };
        }
    } catch (error) {
        // Tabela não existe, usar perfil padrão
        console.log('Tabela users não existe, usando perfil padrão');
    }
    
    return DEFAULT_PROFILE;
}

export async function updateProfile(data: Partial<UserProfile>) {
    try {
        // Tentar criar ou atualizar no banco
        await prisma.$executeRaw`
            INSERT INTO users (id, name, email, phone, role, department, bio, photo_url, preferences, created_at, updated_at)
            VALUES (
                'default-user', 
                ${data.name || 'Admin'}, 
                ${data.email || 'admin@ymbale.com.br'},
                ${data.phone || ''},
                ${data.role || 'Gerente Comercial'},
                ${data.department || 'Vendas'},
                ${data.bio || ''},
                ${data.photoUrl || null},
                ${JSON.stringify(data.preferences || DEFAULT_PROFILE.preferences)}::jsonb,
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                role = EXCLUDED.role,
                department = EXCLUDED.department,
                bio = EXCLUDED.bio,
                photo_url = EXCLUDED.photo_url,
                preferences = EXCLUDED.preferences,
                updated_at = NOW()
        `;
        
        // Revalidar todos os caminhos onde o perfil pode aparecer
        revalidatePath('/profile');
        revalidatePath('/'); // Dashboard
        revalidatePath('/dashboard');
        // Forçar atualização do cache do navegador também
        return { success: true, photoUrl: data.photoUrl };
    } catch (error: any) {
        console.error('Erro ao atualizar perfil:', error);
        
        // Se a tabela não existir, criar ela
        if (error.message?.includes('relation "users" does not exist')) {
            try {
                await createUsersTable();
                return updateProfile(data); // Tentar novamente
            } catch (createError) {
                console.error('Erro ao criar tabela users:', createError);
            }
        }
        
        return { success: false, error: error.message };
    }
}

async function createUsersTable() {
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            role VARCHAR(100),
            department VARCHAR(100),
            bio TEXT,
            photo_url VARCHAR(500),
            preferences JSONB DEFAULT '{"notifications": true, "emailAlerts": true, "theme": "dark"}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;
}

export async function uploadProfilePhoto(formData: FormData) {
    try {
        const { supabase } = await import('@/lib/supabase');
        
        if (!supabase) {
            throw new Error('Supabase não configurado');
        }

        const file = formData.get('photo') as File;
        if (!file || file.size === 0) {
            throw new Error('Nenhum arquivo enviado');
        }

        // Validar
        if (!file.type.startsWith('image/')) {
            throw new Error('Apenas imagens são permitidas');
        }

        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Arquivo muito grande. Máximo 5MB');
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const BUCKET_NAME = 'profile-photos';
        
        // Verificar/criar bucket
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
        
        if (!bucketExists) {
            await supabase.storage.createBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: 5242880
            });
        }

        const timestamp = Date.now();
        const filename = `profile_${timestamp}.${file.name.split('.').pop()}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filename, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (uploadError) {
            throw new Error(uploadError.message);
        }

        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filename);

        return { success: true, photoUrl: urlData.publicUrl };
    } catch (error: any) {
        console.error('Erro no upload:', error);
        throw new Error(error.message || 'Erro ao fazer upload');
    }
}


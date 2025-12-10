import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

// Função para garantir que as colunas de login existem
async function ensureLoginColumnsExist() {
    try {
        // Verificar quais colunas existem
        const existingColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'system_settings'
        `;
        
        const columnNames = existingColumns.map(c => c.column_name);
        
        // Adicionar colunas que não existem
        const columnsToAdd = [
            { name: 'login_title', type: 'VARCHAR(100)', exists: columnNames.includes('login_title') },
            { name: 'login_subtitle', type: 'VARCHAR(255)', exists: columnNames.includes('login_subtitle') },
            { name: 'login_message', type: 'TEXT', exists: columnNames.includes('login_message') },
            { name: 'login_show_message', type: 'BOOLEAN DEFAULT false', exists: columnNames.includes('login_show_message') },
            { name: 'login_background_color', type: 'VARCHAR(7)', exists: columnNames.includes('login_background_color') },
            { name: 'login_logo', type: 'VARCHAR(500)', exists: columnNames.includes('login_logo') },
        ];
        
        for (const col of columnsToAdd) {
            if (!col.exists) {
                try {
                    await prisma.$executeRawUnsafe(
                        `ALTER TABLE system_settings ADD COLUMN ${col.name} ${col.type}`
                    );
                    console.log(`✅ Coluna ${col.name} adicionada com sucesso!`);
                } catch (error: any) {
                    // Ignorar erro se a coluna já existir
                    if (!error.message?.includes('duplicate column') && !error.message?.includes('already exists')) {
                        console.warn(`⚠️ Erro ao adicionar coluna ${col.name}:`, error.message);
                    }
                }
            }
        }
    } catch (error: any) {
        console.warn('⚠️ Erro ao verificar/criar colunas de login:', error.message);
    }
}

// Função helper para converter snake_case para camelCase
function convertToCamelCase(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const converted: any = {};
    for (const [key, value] of Object.entries(data)) {
        // Converter snake_case para camelCase
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        
        // Tratar valores especiais
        let convertedValue = value;
        
        // Converter booleanos (PostgreSQL pode retornar como string ou boolean)
        if (key === 'login_show_message') {
            convertedValue = value === true || value === 'true' || value === 't' || value === 1;
        }
        
        // Converter datas para ISO string se necessário
        if (value instanceof Date) {
            convertedValue = value.toISOString();
        }
        
        converted[camelKey] = convertedValue;
    }
    return converted;
}

// GET - Buscar configurações do sistema
export async function GET(request: NextRequest) {
    try {
        // Garantir que as colunas de login existem
        await ensureLoginColumnsExist();
        
        // Tentar usar Prisma primeiro
        try {
            let settings = await prisma.systemSettings.findUnique({
                where: { id: 'system' }
            });

            if (!settings) {
                // Criar configurações padrão se não existirem
                settings = await prisma.systemSettings.create({
                    data: {
                        id: 'system',
                        crmName: 'Ymbale',
                        primaryColor: '#6366f1',
                        secondaryColor: '#8b5cf6',
                        accentColor: '#10b981',
                    }
                });
            }

            console.log('📤 GET - Configurações retornadas (Prisma):', settings);
            return NextResponse.json(settings);
        } catch (prismaError: any) {
            // Se o Prisma falhar (campos não reconhecidos), usar SQL direto
            if (prismaError.message?.includes('Unknown argument') || 
                prismaError.message?.includes('does not exist') ||
                prismaError.code === 'P2009') {
                
                console.log('⚠️ Prisma Client desatualizado no GET, usando SQL direto...');
                
                const result = await prisma.$queryRawUnsafe(`
                    SELECT * FROM system_settings WHERE id = 'system'
                `) as any[];
                
                if (result && result.length > 0) {
                    const settings = convertToCamelCase(result[0]);
                    console.log('📤 GET - Configurações retornadas (SQL direto):', settings);
                    return NextResponse.json(settings);
                } else {
                    // Criar configurações padrão
                    await prisma.$executeRawUnsafe(`
                        INSERT INTO system_settings (id, crm_name, primary_color, secondary_color, accent_color)
                        VALUES ('system', 'Ymbale', '#6366f1', '#8b5cf6', '#10b981')
                        ON CONFLICT (id) DO NOTHING
                    `);
                    
                    const newResult = await prisma.$queryRawUnsafe(`
                        SELECT * FROM system_settings WHERE id = 'system'
                    `) as any[];
                    
                    if (newResult && newResult.length > 0) {
                        const settings = convertToCamelCase(newResult[0]);
                        return NextResponse.json(settings);
                    }
                }
            }
            
            throw prismaError;
        }
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        return NextResponse.json(
            { error: 'Erro ao buscar configurações' },
            { status: 500 }
        );
    }
}

// PUT - Atualizar configurações do sistema
export async function PUT(request: NextRequest) {
    try {
        // Garantir que as colunas de login existem no banco
        await ensureLoginColumnsExist();
        
        // Verificar autenticação (permitir se não houver autenticação configurada)
        let authResult: { authenticated: boolean; user?: any } = { authenticated: false };
        try {
            authResult = await verifyAuth(request);
        } catch (authError) {
            console.warn('Aviso: Erro ao verificar autenticação, continuando sem autenticação:', authError);
            authResult = { authenticated: false };
        }
        
        // Se houver autenticação configurada, verificar se é admin
        if (authResult.authenticated && authResult.user && authResult.user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Acesso negado. Apenas administradores podem alterar configurações.' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            crmName,
            crmLogo,
            crmFavicon,
            primaryColor,
            secondaryColor,
            accentColor,
            companyName,
            companyEmail,
            companyPhone,
            loginTitle,
            loginSubtitle,
            loginMessage,
            loginShowMessage,
            loginMessageEnabled, // Aceitar ambos os nomes
            loginBackgroundColor,
            loginLogo,
        } = body;

        // Função helper para converter string vazia em null
        const emptyToNull = (value: any): any => {
            if (typeof value === 'string' && value.trim() === '') {
                return null;
            }
            return value;
        };

        // Atualizar ou criar configurações
        // Usar loginShowMessage ou loginMessageEnabled (compatibilidade)
        const showMessage = loginShowMessage !== undefined ? loginShowMessage : (loginMessageEnabled !== undefined ? loginMessageEnabled : false);
        
        // Construir objeto de update apenas com campos fornecidos
        // Buscar configurações existentes primeiro para preservar valores não enviados
        const existingSettings = await prisma.systemSettings.findUnique({
            where: { id: 'system' }
        });
        
        const updateData: any = {
            updatedBy: authResult.user?.id || null,
        };
        
        console.log('📝 Atualizando configurações:', {
            camposFornecidos: Object.keys(body),
            existingSettings: existingSettings ? 'existe' : 'não existe'
        });
        
        // Atualizar apenas campos que foram fornecidos no body
        if (crmName !== undefined) updateData.crmName = emptyToNull(crmName);
        if (crmLogo !== undefined) updateData.crmLogo = emptyToNull(crmLogo);
        if (crmFavicon !== undefined) updateData.crmFavicon = emptyToNull(crmFavicon);
        if (primaryColor !== undefined) updateData.primaryColor = emptyToNull(primaryColor);
        if (secondaryColor !== undefined) updateData.secondaryColor = emptyToNull(secondaryColor);
        if (accentColor !== undefined) updateData.accentColor = emptyToNull(accentColor);
        if (companyName !== undefined) updateData.companyName = emptyToNull(companyName);
        if (companyEmail !== undefined) updateData.companyEmail = emptyToNull(companyEmail);
        if (companyPhone !== undefined) updateData.companyPhone = emptyToNull(companyPhone);
        if (loginTitle !== undefined) updateData.loginTitle = emptyToNull(loginTitle);
        if (loginSubtitle !== undefined) updateData.loginSubtitle = emptyToNull(loginSubtitle);
        if (loginMessage !== undefined) updateData.loginMessage = emptyToNull(loginMessage);
        if (loginShowMessage !== undefined || loginMessageEnabled !== undefined) {
            updateData.loginShowMessage = showMessage;
        }
        if (loginBackgroundColor !== undefined) updateData.loginBackgroundColor = emptyToNull(loginBackgroundColor);
        if (loginLogo !== undefined) updateData.loginLogo = emptyToNull(loginLogo);
        
        // Se não existir, criar com valores padrão
        if (!existingSettings) {
            const createData: any = {
                id: 'system',
                crmName: emptyToNull(crmName) || 'Ymbale',
                crmLogo: emptyToNull(crmLogo),
                crmFavicon: emptyToNull(crmFavicon),
                primaryColor: emptyToNull(primaryColor) || '#6366f1',
                secondaryColor: emptyToNull(secondaryColor) || '#8b5cf6',
                accentColor: emptyToNull(accentColor) || '#10b981',
                companyName: emptyToNull(companyName),
                companyEmail: emptyToNull(companyEmail),
                companyPhone: emptyToNull(companyPhone),
                loginTitle: emptyToNull(loginTitle),
                loginSubtitle: emptyToNull(loginSubtitle),
                loginMessage: emptyToNull(loginMessage),
                loginShowMessage: showMessage,
                loginBackgroundColor: emptyToNull(loginBackgroundColor),
                loginLogo: emptyToNull(loginLogo),
                updatedBy: authResult.user?.id || null,
            };
            
            const settings = await prisma.systemSettings.create({
                data: createData
            });
            
            return NextResponse.json({
                success: true,
                settings
            });
        }
        
        // Se existir, atualizar apenas os campos fornecidos
        // Verificar se há campos para atualizar
        const fieldsToUpdate = Object.keys(updateData).filter(key => key !== 'updatedBy' || updateData[key] !== null);
        
        if (fieldsToUpdate.length === 0) {
            // Se não há campos para atualizar além de updatedBy, retornar configurações existentes
            return NextResponse.json({
                success: true,
                settings: existingSettings
            });
        }

        // Tentar usar Prisma primeiro
        try {
            const settings = await prisma.systemSettings.update({
                where: { id: 'system' },
                data: updateData
            });

            return NextResponse.json({
                success: true,
                settings
            });
        } catch (prismaError: any) {
            // Se o erro for sobre campos desconhecidos, usar SQL direto
            if (prismaError.message?.includes('Unknown argument') || 
                prismaError.message?.includes('does not exist') ||
                prismaError.code === 'P2009') {
                
                console.log('⚠️ Prisma Client desatualizado, usando SQL direto...');
                
                // Mapear campos do Prisma para nomes de colunas do banco
                const fieldMapping: Record<string, string> = {
                    crmName: 'crm_name',
                    crmLogo: 'crm_logo',
                    crmFavicon: 'crm_favicon',
                    primaryColor: 'primary_color',
                    secondaryColor: 'secondary_color',
                    accentColor: 'accent_color',
                    companyName: 'company_name',
                    companyEmail: 'company_email',
                    companyPhone: 'company_phone',
                    loginTitle: 'login_title',
                    loginSubtitle: 'login_subtitle',
                    loginMessage: 'login_message',
                    loginShowMessage: 'login_show_message',
                    loginBackgroundColor: 'login_background_color',
                    loginLogo: 'login_logo',
                    updatedBy: 'updated_by',
                };
                
                // Construir query SQL usando template literals do Prisma
                const setParts: string[] = [];
                
                for (const [key, value] of Object.entries(updateData)) {
                    if (key === 'updatedBy' && value === null) continue;
                    
                    const columnName = fieldMapping[key] || key;
                    if (value === null) {
                        setParts.push(`${columnName} = NULL`);
                    } else if (typeof value === 'boolean') {
                        setParts.push(`${columnName} = ${value}`);
                    } else if (typeof value === 'string') {
                        // Escapar aspas simples
                        const escapedValue = value.replace(/'/g, "''");
                        setParts.push(`${columnName} = '${escapedValue}'`);
                    } else {
                        setParts.push(`${columnName} = '${String(value)}'`);
                    }
                }
                
                if (setParts.length > 0) {
                    // Adicionar updated_at
                    setParts.push(`updated_at = NOW()`);
                    
                    const sql = `
                        UPDATE system_settings 
                        SET ${setParts.join(', ')}
                        WHERE id = 'system'
                        RETURNING *
                    `;
                    
                    const result = await prisma.$queryRawUnsafe(sql) as any[];
                    const settings = Array.isArray(result) && result.length > 0 ? result[0] : existingSettings;
                    
                    // Converter nomes de colunas do banco para camelCase
                    const convertedSettings = convertToCamelCase(settings);
                    
                    return NextResponse.json({
                        success: true,
                        settings: convertedSettings
                    });
                }
            }
            
            // Se não for erro de campo desconhecido, relançar o erro
            throw prismaError;
        }
    } catch (error: any) {
        console.error('❌ Erro ao atualizar configurações:', error);
        console.error('📋 Detalhes do erro:', {
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
            stack: error?.stack
        });
        
        // Mensagem de erro mais amigável
        let errorMessage = 'Erro ao atualizar configurações';
        if (error?.message?.includes('Unique constraint')) {
            errorMessage = 'Já existe uma configuração com este ID. Tente novamente.';
        } else if (error?.message?.includes('Foreign key')) {
            errorMessage = 'Erro de referência no banco de dados. Verifique os dados.';
        } else if (error?.message) {
            errorMessage = error.message;
        }
        
        return NextResponse.json(
            { 
                error: errorMessage,
                details: process.env.NODE_ENV === 'development' ? {
                    message: error?.message,
                    code: error?.code,
                    meta: error?.meta
                } : undefined
            },
            { status: 500 }
        );
    }
}



import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

// GET - Buscar configurações do sistema
export async function GET(request: NextRequest) {
    try {
        // Buscar ou criar configurações padrão
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

        return NextResponse.json(settings);
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

        const settings = await prisma.systemSettings.update({
            where: { id: 'system' },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            settings
        });
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



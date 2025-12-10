import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();

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
        // Verificar autenticação
        const authResult = await verifyAuth(request);
        if (!authResult.authenticated || authResult.user?.role !== 'admin') {
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

        // Atualizar ou criar configurações
        // Usar loginShowMessage ou loginMessageEnabled (compatibilidade)
        const showMessage = loginShowMessage !== undefined ? loginShowMessage : (loginMessageEnabled !== undefined ? loginMessageEnabled : false);
        
        // Construir objeto de update apenas com campos fornecidos
        const updateData: any = {
            updatedBy: authResult.user.id,
        };
        
        if (crmName !== undefined) updateData.crmName = crmName;
        if (crmLogo !== undefined) updateData.crmLogo = crmLogo;
        if (crmFavicon !== undefined) updateData.crmFavicon = crmFavicon;
        if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
        if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;
        if (accentColor !== undefined) updateData.accentColor = accentColor;
        if (companyName !== undefined) updateData.companyName = companyName;
        if (companyEmail !== undefined) updateData.companyEmail = companyEmail;
        if (companyPhone !== undefined) updateData.companyPhone = companyPhone;
        if (loginTitle !== undefined) updateData.loginTitle = loginTitle;
        if (loginSubtitle !== undefined) updateData.loginSubtitle = loginSubtitle;
        if (loginMessage !== undefined) updateData.loginMessage = loginMessage;
        updateData.loginShowMessage = showMessage;
        if (loginBackgroundColor !== undefined) updateData.loginBackgroundColor = loginBackgroundColor;
        if (loginLogo !== undefined) updateData.loginLogo = loginLogo;
        
        const settings = await prisma.systemSettings.upsert({
            where: { id: 'system' },
            update: updateData,
            create: {
                id: 'system',
                crmName: crmName || 'Ymbale',
                crmLogo: crmLogo || null,
                crmFavicon: crmFavicon || null,
                primaryColor: primaryColor || '#6366f1',
                secondaryColor: secondaryColor || '#8b5cf6',
                accentColor: accentColor || '#10b981',
                companyName: companyName || null,
                companyEmail: companyEmail || null,
                companyPhone: companyPhone || null,
                loginTitle: loginTitle || null,
                loginSubtitle: loginSubtitle || null,
                loginMessage: loginMessage || null,
                loginShowMessage: showMessage,
                loginBackgroundColor: loginBackgroundColor || null,
                loginLogo: loginLogo || null,
                updatedBy: authResult.user.id,
            }
        });

        return NextResponse.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        return NextResponse.json(
            { error: 'Erro ao atualizar configurações' },
            { status: 500 }
        );
    }
}



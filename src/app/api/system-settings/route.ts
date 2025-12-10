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
            loginBackgroundColor,
            loginLogo,
        } = body;

        // Atualizar ou criar configurações
        const settings = await prisma.systemSettings.upsert({
            where: { id: 'system' },
            update: {
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
                loginBackgroundColor,
                loginLogo,
                updatedBy: authResult.user.id,
            },
            create: {
                id: 'system',
                crmName: crmName || 'Ymbale',
                crmLogo,
                crmFavicon,
                primaryColor: primaryColor || '#6366f1',
                secondaryColor: secondaryColor || '#8b5cf6',
                accentColor: accentColor || '#10b981',
                companyName,
                companyEmail,
                companyPhone,
                loginTitle,
                loginSubtitle,
                loginMessage,
                loginShowMessage: loginShowMessage || false,
                loginBackgroundColor,
                loginLogo,
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



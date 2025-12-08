import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        
        // Debug info
        const envVars = Object.keys(process.env).filter(k => k.includes('OPENAI'));
        
        return NextResponse.json({
            success: true,
            hasKey: !!apiKey,
            keyLength: apiKey?.length || 0,
            keyPreview: apiKey ? apiKey.substring(0, 10) + '...' : 'N/A',
            envVarsFound: envVars,
            message: apiKey 
                ? `✅ Chave encontrada! Tamanho: ${apiKey.length} caracteres`
                : '❌ Chave NÃO encontrada! Verifique o arquivo .env.local'
        });
    } catch (error: any) {
        console.error('Error in test-ai route:', error);
        return NextResponse.json({
            success: false,
            error: error?.message || 'Erro desconhecido',
            stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
        }, { status: 500 });
    }
}


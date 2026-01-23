import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const { name, phone, email, address, category, notes, status, salesPotential } = body;

        if (!name) {
            return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
        }

        // Generate a unique ID
        const id = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Include phone/email in the address object if provided
        const fullAddress = {
            ...address,
            phone: phone || null,
            email: email || null
        };

        const restaurant = await prisma.restaurant.create({
            data: {
                id,
                name,
                address: fullAddress,
                category: category || 'Restaurante',
                status: status || 'A Analisar',
                salesPotential: salesPotential || 'MEDIO',
                rating: 0,
                reviewCount: 0,
                projectedDeliveries: 0,
                source: 'manual'
            }
        });

        // Create a note if provided
        if (notes) {
            await prisma.note.create({
                data: {
                    restaurantId: restaurant.id,
                    content: notes
                }
            });
        }

        return NextResponse.json({
            success: true,
            restaurant
        });
    } catch (error: any) {
        console.error('Error creating client:', error);
        return NextResponse.json({
            error: error.message || 'Erro ao criar cliente'
        }, { status: 500 });
    }
}

export async function GET() {
    try {
        const restaurants = await prisma.restaurant.findMany({
            include: {
                seller: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100
        });

        return NextResponse.json(restaurants);
    } catch (error: any) {
        console.error('Error fetching clients:', error);
        return NextResponse.json({
            error: error.message || 'Erro ao buscar clientes'
        }, { status: 500 });
    }
}

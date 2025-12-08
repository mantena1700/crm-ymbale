// scripts/clear-mock-data.ts
// Script para limpar dados mockados/fake do banco de dados
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearMockData() {
    console.log('🧹 Iniciando limpeza de dados mockados...\n');

    try {
        // 1. Limpar restaurantes de teste/mock
        console.log('📊 Verificando restaurantes...');
        const allRestaurants = await prisma.restaurant.findMany();
        console.log(`   Total de restaurantes: ${allRestaurants.length}`);

        // Identificar restaurantes mockados (exemplo: nomes genéricos, sem dados reais)
        const mockPatterns = [
            'Unknown',
            'Test',
            'Mock',
            'Exemplo',
            'Sample',
            'Demo'
        ];

        const mockRestaurants = allRestaurants.filter(r => 
            mockPatterns.some(pattern => r.name.toLowerCase().includes(pattern.toLowerCase()))
        );

        if (mockRestaurants.length > 0) {
            console.log(`   🗑️  Encontrados ${mockRestaurants.length} restaurantes mockados`);
            
            // Deletar comentários, análises, notas e follow-ups relacionados
            for (const restaurant of mockRestaurants) {
                await prisma.comment.deleteMany({ where: { restaurantId: restaurant.id } });
                await prisma.analysis.deleteMany({ where: { restaurantId: restaurant.id } });
                await prisma.note.deleteMany({ where: { restaurantId: restaurant.id } });
                await prisma.followUp.deleteMany({ where: { restaurantId: restaurant.id } });
                await prisma.activityLog.deleteMany({ where: { restaurantId: restaurant.id } });
            }
            
            // Deletar restaurantes
            await prisma.restaurant.deleteMany({
                where: {
                    id: { in: mockRestaurants.map(r => r.id) }
                }
            });
            
            console.log(`   ✅ ${mockRestaurants.length} restaurantes mockados removidos`);
        } else {
            console.log('   ✅ Nenhum restaurante mockado encontrado');
        }

        // 2. Limpar análises sem restaurante válido
        console.log('\n🤖 Verificando análises...');
        const allAnalyses = await prisma.analysis.findMany({
            include: { restaurant: true }
        });
        
        const orphanAnalyses = allAnalyses.filter(a => !a.restaurant);
        if (orphanAnalyses.length > 0) {
            await prisma.analysis.deleteMany({
                where: {
                    id: { in: orphanAnalyses.map(a => a.id) }
                }
            });
            console.log(`   ✅ ${orphanAnalyses.length} análises órfãs removidas`);
        } else {
            console.log('   ✅ Nenhuma análise órfã encontrada');
        }

        // 3. Limpar follow-ups sem restaurante válido
        console.log('\n📅 Verificando follow-ups...');
        const allFollowUps = await prisma.followUp.findMany({
            include: { restaurant: true }
        });
        
        const orphanFollowUps = allFollowUps.filter(f => !f.restaurant);
        if (orphanFollowUps.length > 0) {
            await prisma.followUp.deleteMany({
                where: {
                    id: { in: orphanFollowUps.map(f => f.id) }
                }
            });
            console.log(`   ✅ ${orphanFollowUps.length} follow-ups órfãos removidos`);
        } else {
            console.log('   ✅ Nenhum follow-up órfão encontrado');
        }

        // 4. Limpar notificações antigas (opcional - manter últimas 100)
        console.log('\n🔔 Verificando notificações...');
        const allNotifications = await prisma.notification.findMany({
            orderBy: { createdAt: 'desc' }
        });
        
        if (allNotifications.length > 100) {
            const toDelete = allNotifications.slice(100);
            await prisma.notification.deleteMany({
                where: {
                    id: { in: toDelete.map(n => n.id) }
                }
            });
            console.log(`   ✅ ${toDelete.length} notificações antigas removidas (mantidas últimas 100)`);
        } else {
            console.log(`   ✅ ${allNotifications.length} notificações (todas mantidas)`);
        }

        // 5. Limpar activity log antigo (opcional - manter últimos 1000)
        console.log('\n📋 Verificando log de atividades...');
        const allActivities = await prisma.activityLog.findMany({
            orderBy: { createdAt: 'desc' }
        });
        
        if (allActivities.length > 1000) {
            const toDelete = allActivities.slice(1000);
            await prisma.activityLog.deleteMany({
                where: {
                    id: { in: toDelete.map(a => a.id) }
                }
            });
            console.log(`   ✅ ${toDelete.length} atividades antigas removidas (mantidas últimas 1000)`);
        } else {
            console.log(`   ✅ ${allActivities.length} atividades (todas mantidas)`);
        }

        // 6. Estatísticas finais
        console.log('\n' + '='.repeat(50));
        console.log('📊 ESTATÍSTICAS FINAIS:');
        const finalStats = {
            restaurants: await prisma.restaurant.count(),
            comments: await prisma.comment.count(),
            analyses: await prisma.analysis.count(),
            followUps: await prisma.followUp.count(),
            notes: await prisma.note.count(),
            sellers: await prisma.seller.count(),
            goals: await prisma.goal.count(),
        };
        
        console.log(`   📊 Restaurantes: ${finalStats.restaurants}`);
        console.log(`   💬 Comentários: ${finalStats.comments}`);
        console.log(`   🤖 Análises: ${finalStats.analyses}`);
        console.log(`   📅 Follow-ups: ${finalStats.followUps}`);
        console.log(`   📝 Notas: ${finalStats.notes}`);
        console.log(`   👥 Vendedores: ${finalStats.sellers}`);
        console.log(`   🎯 Metas: ${finalStats.goals}`);
        console.log('='.repeat(50));

        console.log('\n✅ Limpeza concluída com sucesso!');
        console.log('💡 Agora você pode começar a importar seus dados reais das planilhas.');

    } catch (error) {
        console.error('❌ Erro durante a limpeza:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Executar
clearMockData();


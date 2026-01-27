import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import styles from './page.module.css';

// Funções de Backfill para popular histórico
async function backfillLegacyData() {
    try {
        const count = await prisma.systemAuditLog.count();
        if (count > 50) return; // Se já tem dados (mais que o básico), não faz nada

        console.log("Iniciando backfill de dados históricos...");

        // 1. Log de Criação de Usuários
        const users = await prisma.user.findMany();
        for (const u of users) {
            // Evitar duplicatas (check simples)
            const exists = await prisma.systemAuditLog.findFirst({
                where: { userId: u.id, action: 'USER_CREATED' }
            });

            if (!exists) {
                await prisma.systemAuditLog.create({
                    data: {
                        userId: u.id,
                        action: 'USER_CREATED',
                        resourceType: 'User',
                        resourceId: u.id,
                        details: `Usuário ${u.name} criado no sistema`,
                        ipAddress: 'System-Migration',
                        createdAt: u.createdAt
                    }
                });
            }

            // Last Login Log (se ainda não existir)
            // @ts-ignore
            if (u.lastLogin) {
                const loginExists = await prisma.systemAuditLog.findFirst({
                    where: { userId: u.id, action: 'LOGIN', createdAt: u.lastLogin }
                });

                if (!loginExists) {
                    await prisma.systemAuditLog.create({
                        data: {
                            userId: u.id,
                            action: 'LOGIN',
                            resourceType: 'AUTH',
                            details: 'Último login registrado (Histórico recuperado)',
                            ipAddress: 'System',
                            // @ts-ignore
                            createdAt: u.lastLogin
                        }
                    });
                }
            }
        }

        // 2. Mapear Vendedores para Usuários (para atribuir visitas/leads)
        const sellers = await prisma.seller.findMany({
            where: { user: { isNot: null } },
            include: { user: true }
        });

        const sellerUserMap = new Map();
        sellers.forEach(s => {
            if (s.user) sellerUserMap.set(s.id, s.user.id);
        });

        // 3. Importar Visitas Recentes (Limitado para não demorar)
        const recentVisits = await prisma.visit.findMany({
            take: 200,
            orderBy: { visitDate: 'desc' },
            include: { restaurant: true }
        });

        for (const visit of recentVisits) {
            const userId = sellerUserMap.get(visit.sellerId);
            if (!userId) continue;

            const exists = await prisma.systemAuditLog.findFirst({
                where: { resourceId: visit.id, resourceType: 'Visit' }
            });

            if (!exists) {
                await prisma.systemAuditLog.create({
                    data: {
                        userId: userId,
                        action: 'VISIT_LOGGED',
                        resourceType: 'Visit',
                        resourceId: visit.id,
                        details: `Visita registrada em ${visit.restaurant.name} (${visit.outcome || 'Sem desfecho'})`,
                        createdAt: visit.createdAt || visit.visitDate || new Date()
                    }
                });
            }
        }

        // 4. Importar Leads Criados (Limitado)
        const recentLeads = await prisma.restaurant.findMany({
            take: 200,
            orderBy: { createdAt: 'desc' },
            where: { sellerId: { not: null } }
        });

        for (const lead of recentLeads) {
            if (!lead.sellerId) continue;
            const userId = sellerUserMap.get(lead.sellerId);
            if (!userId) continue;

            const exists = await prisma.systemAuditLog.findFirst({
                where: { resourceId: lead.id, resourceType: 'Restaurant', action: 'LEAD_CREATED' }
            });

            if (!exists && lead.createdAt) {
                await prisma.systemAuditLog.create({
                    data: {
                        userId: userId,
                        action: 'LEAD_CREATED',
                        resourceType: 'Restaurant',
                        resourceId: lead.id,
                        details: `Novo lead cadastrado: ${lead.name}`,
                        createdAt: lead.createdAt
                    }
                });
            }
        }

    } catch (e) {
        console.warn('Erro parcial no backfill de histórico:', e);
    }
}

async function getAuditLogs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    try {
        await backfillLegacyData();

        const [logs, total] = await Promise.all([
            prisma.systemAuditLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip,
                include: {
                    user: {
                        select: {
                            name: true,
                            username: true,
                            role: true
                        }
                    }
                }
            }),
            prisma.systemAuditLog.count()
        ]);

        return { logs, total, totalPages: Math.ceil(total / limit) };
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        return { logs: [], total: 0, totalPages: 0, error: String(error) };
    }
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) redirect('/login');

    const user = await validateSession(token);
    if (!user) redirect('/login');
    if (user.role !== 'root') redirect('/');

    const { page: pageParam } = await searchParams;
    const page = Number(pageParam) || 1;
    const { logs, total, totalPages, error } = await getAuditLogs(page);

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.errorBox}>
                    <p>⚠️ Erro ao carregar dados. {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>
                    🛡️ Registro de Auditoria do Sistema
                </h1>
                <div className={styles.subtitle}>
                    Total de registros: {total}
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Usuário</th>
                                <th>Ação</th>
                                <th>Recurso</th>
                                <th>IP / Agente</th>
                                <th style={{ width: '30%' }}>Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id}>
                                    <td suppressHydrationWarning>
                                        {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : '-'}
                                    </td>
                                    <td>
                                        <div className={styles.userCell}>
                                            <span className={styles.userName}>{log.user.name}</span>
                                            <span className={styles.userRole}>@{log.user.username} ({log.user.role})</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${log.action === 'LOGIN' ? styles.badgeLogin :
                                                log.action === 'USER_CREATED' ? styles.badgeDefault :
                                                    log.action.includes('EXPORT') ? styles.badgeExport :
                                                        log.action === 'LEAD_CREATED' || log.action === 'VISIT_LOGGED' ? styles.badgeCreate :
                                                            styles.badgeDefault
                                            }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td>
                                        {log.resourceType && (
                                            <>
                                                <div style={{ fontWeight: 500 }}>{log.resourceType}</div>
                                                {log.resourceId && <div style={{ fontSize: '0.7em', opacity: 0.7, fontFamily: 'monospace' }}>{log.resourceId.substring(0, 8)}...</div>}
                                            </>
                                        )}
                                    </td>
                                    <td>
                                        {log.ipAddress && <span className={styles.ipTag}>{log.ipAddress}</span>}
                                        <div style={{ fontSize: '0.75em', marginTop: '4px', opacity: 0.7, maxWidth: '150px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={log.userAgent || ''}>
                                            {log.userAgent}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{log.details}</div>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', opacity: 0.6 }}>
                                        Nenhum registro de auditoria encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={styles.pagination}>
                <a
                    href={page > 1 ? `/admin/audit?page=${page - 1}` : '#'}
                    className={`${styles.paginationBtn} ${page <= 1 ? styles.disabled : ''}`}
                >
                    Anterior
                </a>
                <span className={styles.subtitle}>
                    Página {page} de {totalPages || 1}
                </span>
                <a
                    href={page < totalPages ? `/admin/audit?page=${page + 1}` : '#'}
                    className={`${styles.paginationBtn} ${page >= totalPages ? styles.disabled : ''}`}
                >
                    Próxima
                </a>
            </div>
        </div>
    );
}

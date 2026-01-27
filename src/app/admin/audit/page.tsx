import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import styles from './page.module.css';

async function backfillLegacyData() {
    try {
        // Check if we have logs
        const count = await prisma.systemAuditLog.count();
        if (count > 0) return;

        // If empty, find users with access logs or create from basic user data if available
        // Note: Prisma model might not have lastLogin if not defined in schema.
        // We will try safe access or skip if field doesn't exist to prevent crash.

        // Dynamic check for lastLogin field existence is hard with strong typing, 
        // so we trust the schema has it or we wrap in try-catch.
        // If lastLogin is not in schema, this query might fail at runtime if not caught.

        // Let's try to fetch users. If Schema doesn't match, this will throw.
        // casting to any to avoid TS error if field is missing in generated client but present in DB
        const users = await prisma.user.findMany();

        for (const u of users) {
            // @ts-ignore - Check if lastLogin exists dynamically
            if (u.lastLogin) {
                await prisma.systemAuditLog.create({
                    data: {
                        userId: u.id,
                        action: 'LOGIN',
                        resourceType: 'AUTH',
                        details: 'Login registrado antes da ativação da auditoria (Histórico recuperado)',
                        ipAddress: 'Sistema',
                        userAgent: 'Migration-Script',
                        // @ts-ignore
                        createdAt: u.lastLogin
                    }
                });
            }
        }
    } catch (e) {
        console.warn('Backfill skipped due to error (schema mismatch?):', e);
    }
}

async function getAuditLogs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    try {
        // Tentar backfill se estiver vazio
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
        console.error('Erro ao buscar logs de auditoria:', error);
        return { logs: [], total: 0, totalPages: 0, error: String(error) };
    }
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    // 1. Verify Authentication & Root Role
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) redirect('/login');

    const user = await validateSession(token);
    if (!user) redirect('/login');

    if (user.role !== 'root') {
        redirect('/');
    }

    const { page: pageParam } = await searchParams;
    const page = Number(pageParam) || 1;
    const { logs, total, totalPages, error } = await getAuditLogs(page);

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.errorBox}>
                    <p>
                        ⚠️ Erro ao carregar registros de auditoria.<br />
                        <span style={{ fontSize: '0.8em', marginTop: '0.5rem', display: 'block' }}>{error}</span>
                    </p>
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
                                <th>Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id}>
                                    <td suppressHydrationWarning>
                                        {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : '-'}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{log.user.name}</div>
                                        <div style={{ fontSize: '0.8em', color: '#64748b' }}>
                                            @{log.user.username} ({log.user.role})
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${log.action === 'LOGIN' ? styles.badgeLogin :
                                                log.action.includes('EXPORT') ? styles.badgeExport :
                                                    styles.badgeDefault
                                            }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td>
                                        {log.resourceType && (
                                            <>
                                                <div>{log.resourceType}</div>
                                                {log.resourceId && <div style={{ fontSize: '0.75em', color: '#94a3b8' }}>{log.resourceId}</div>}
                                            </>
                                        )}
                                    </td>
                                    <td style={{ maxWidth: '200px' }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.ipAddress || ''}>{log.ipAddress}</div>
                                        <div style={{ fontSize: '0.75em', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.userAgent || ''}>
                                            {log.userAgent}
                                        </div>
                                    </td>
                                    <td style={{ maxWidth: '300px' }}>
                                        <div style={{ whiteSpace: 'normal' }}>{log.details}</div>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
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

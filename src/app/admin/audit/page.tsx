import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import styles from './page.module.css'; // We'll need to create this or use inline styles for now

async function getAuditLogs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    // We can add filtering logic here later based on search params

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
}

export default async function AuditLogPage({ searchParams }: { searchParams: { page?: string } }) {
    // 1. Verify Authentication & Root Role
    const token = cookies().get('session_token')?.value;
    if (!token) redirect('/login');

    const user = await validateSession(token);
    if (!user) redirect('/login'); // Session invalid

    // STRICT CHECK: Only root can see this
    if (user.role !== 'root') {
        redirect('/'); // Or show a 403 Access Denied component
    }

    const page = Number(searchParams.page) || 1;
    const { logs, total, totalPages } = await getAuditLogs(page);

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    🛡️ Registro de Auditoria do Sistema
                </h1>
                <div className="text-sm text-gray-500">
                    Total de registros: {total}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usuário</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ação</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recurso</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IP / Agente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Detalhes</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {log.user.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        @{log.user.username} ({log.user.role})
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${log.action === 'LOGIN' ? 'bg-green-100 text-green-800' :
                                            log.action.includes('EXPORT') ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'}`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {log.resourceType && (
                                        <>
                                            <span className="font-medium">{log.resourceType}</span>
                                            {log.resourceId && <span className="text-xs text-gray-400 block">{log.resourceId}</span>}
                                        </>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-500 dark:text-gray-400" style={{ maxWidth: '200px' }}>
                                    <div className="truncate" title={log.ipAddress || ''}>{log.ipAddress}</div>
                                    <div className="truncate text-xs text-gray-400" title={log.userAgent || ''}>{log.userAgent?.substring(0, 30)}...</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={log.details || ''}>
                                    {log.details}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                    Nenhum registro de auditoria encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Simple Pagination */}
            <div className="mt-4 flex justify-between items-center">
                <a
                    href={page > 1 ? `/admin/audit?page=${page - 1}` : '#'}
                    className={`px-4 py-2 border rounded text-sm ${page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                    Anterior
                </a>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    Página {page} de {totalPages || 1}
                </span>
                <a
                    href={page < totalPages ? `/admin/audit?page=${page + 1}` : '#'}
                    className={`px-4 py-2 border rounded text-sm ${page >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                    Próxima
                </a>
            </div>
        </div>
    );
}

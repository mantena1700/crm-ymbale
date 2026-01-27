// Sistema de Permissões do CRM
import { prisma } from './db';

// Lista de todas as permissões disponíveis
export const ALL_PERMISSIONS = {
    // Dashboard
    'dashboard.view': { name: 'Ver Dashboard', module: 'dashboard', action: 'view' },

    // Clientes
    'clients.view': { name: 'Ver Clientes', module: 'clients', action: 'view' },
    'clients.create': { name: 'Criar Clientes', module: 'clients', action: 'create' },
    'clients.edit': { name: 'Editar Clientes', module: 'clients', action: 'edit' },
    'clients.delete': { name: 'Excluir Clientes', module: 'clients', action: 'delete' },

    // Pipeline
    'pipeline.view': { name: 'Ver Pipeline', module: 'pipeline', action: 'view' },
    'pipeline.edit': { name: 'Editar Pipeline', module: 'pipeline', action: 'edit' },

    // Agenda
    'agenda.view': { name: 'Ver Agenda', module: 'agenda', action: 'view' },
    'agenda.create': { name: 'Criar Eventos', module: 'agenda', action: 'create' },
    'agenda.edit': { name: 'Editar Eventos', module: 'agenda', action: 'edit' },
    'agenda.delete': { name: 'Excluir Eventos', module: 'agenda', action: 'delete' },

    // Executivos
    'sellers.view': { name: 'Ver Executivos', module: 'sellers', action: 'view' },
    'sellers.create': { name: 'Criar Executivos', module: 'sellers', action: 'create' },
    'sellers.edit': { name: 'Editar Executivos', module: 'sellers', action: 'edit' },
    'sellers.delete': { name: 'Excluir Executivos', module: 'sellers', action: 'delete' },

    // Campanhas
    'campaigns.view': { name: 'Ver Campanhas', module: 'campaigns', action: 'view' },
    'campaigns.create': { name: 'Criar Campanhas', module: 'campaigns', action: 'create' },
    'campaigns.edit': { name: 'Editar Campanhas', module: 'campaigns', action: 'edit' },
    'campaigns.delete': { name: 'Excluir Campanhas', module: 'campaigns', action: 'delete' },

    // Relatórios
    'reports.view': { name: 'Ver Relatórios', module: 'reports', action: 'view' },

    // Análise IA
    'analysis.view': { name: 'Ver Análises', module: 'analysis', action: 'view' },
    'analysis.execute': { name: 'Executar Análise IA', module: 'analysis', action: 'execute' },

    // Metas
    'goals.view': { name: 'Ver Metas', module: 'goals', action: 'view' },
    'goals.create': { name: 'Criar Metas', module: 'goals', action: 'create' },
    'goals.edit': { name: 'Editar Metas', module: 'goals', action: 'edit' },

    // Configurações
    'settings.view': { name: 'Ver Configurações', module: 'settings', action: 'view' },
    'settings.edit': { name: 'Editar Configurações', module: 'settings', action: 'edit' },

    // Usuários
    'users.view': { name: 'Ver Usuários', module: 'users', action: 'view' },
    'users.create': { name: 'Criar Usuários', module: 'users', action: 'create' },
    'users.edit': { name: 'Editar Usuários', module: 'users', action: 'edit' },
    'users.delete': { name: 'Excluir Usuários', module: 'users', action: 'delete' },

    // Carteira
    'carteira.view': { name: 'Ver Carteira', module: 'carteira', action: 'view' },
    'carteira.edit': { name: 'Editar Carteira', module: 'carteira', action: 'edit' },
} as const;

export type PermissionCode = keyof typeof ALL_PERMISSIONS;

// Permissões padrão para cada role
export const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
    admin: Object.keys(ALL_PERMISSIONS) as PermissionCode[], // Admin tem tudo
    root: Object.keys(ALL_PERMISSIONS) as PermissionCode[], // Root tem tudo
    user: [
        'dashboard.view',
        'clients.view',
        'clients.create',
        'clients.edit',
        'pipeline.view',
        'pipeline.edit',
        'agenda.view',
        'agenda.create',
        'agenda.edit',
        'sellers.view',
        'campaigns.view',
        'reports.view',
        'analysis.view',
        'analysis.execute',
        'analysis.execute',
        'goals.view',
        'carteira.view',
    ],
};

// Verificar se usuário tem permissão
export async function hasPermission(userId: string, permissionCode: PermissionCode): Promise<boolean> {
    try {
        // Buscar usuário com role
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (!user) return false;

        // Admin/Root tem todas as permissões
        if (user.role === 'admin' || user.role === 'root') return true;

        // Verificar permissão específica no banco
        const userPermission = await prisma.userPermission.findFirst({
            where: {
                userId,
                permission: { code: permissionCode }
            }
        });

        if (userPermission) return true;

        // Se não tem permissão específica, usa permissões do role
        const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
        return rolePermissions.includes(permissionCode);
    } catch (error) {
        console.error('Erro ao verificar permissão:', error);
        return false;
    }
}

// Buscar todas as permissões do usuário
export async function getUserPermissions(userId: string): Promise<PermissionCode[]> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                role: true,
                userPermissions: {
                    include: { permission: true }
                }
            }
        });

        if (!user) return [];

        // Admin/Root tem todas
        if (user.role === 'admin' || user.role === 'root') {
            return Object.keys(ALL_PERMISSIONS) as PermissionCode[];
        }

        // Combina permissões do role + específicas
        const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
        const specificPermissions = user.userPermissions.map(up => up.permission.code as PermissionCode);

        return [...new Set([...rolePermissions, ...specificPermissions])];
    } catch (error) {
        console.error('Erro ao buscar permissões:', error);
        return [];
    }
}

// Conceder permissão a usuário
export async function grantPermission(userId: string, permissionCode: PermissionCode, grantedBy?: string): Promise<boolean> {
    try {
        // Buscar ou criar a permissão
        let permission = await prisma.permission.findUnique({
            where: { code: permissionCode }
        });

        if (!permission) {
            const permDef = ALL_PERMISSIONS[permissionCode];
            permission = await prisma.permission.create({
                data: {
                    code: permissionCode,
                    name: permDef.name,
                    module: permDef.module,
                    action: permDef.action,
                }
            });
        }

        // Criar relação
        await prisma.userPermission.upsert({
            where: {
                userId_permissionId: { userId, permissionId: permission.id }
            },
            update: {},
            create: {
                userId,
                permissionId: permission.id,
                grantedBy
            }
        });

        return true;
    } catch (error) {
        console.error('Erro ao conceder permissão:', error);
        return false;
    }
}

// Revogar permissão
export async function revokePermission(userId: string, permissionCode: PermissionCode): Promise<boolean> {
    try {
        const permission = await prisma.permission.findUnique({
            where: { code: permissionCode }
        });

        if (!permission) return true;

        await prisma.userPermission.deleteMany({
            where: { userId, permissionId: permission.id }
        });

        return true;
    } catch (error) {
        console.error('Erro ao revogar permissão:', error);
        return false;
    }
}

// Inicializar permissões padrão no banco
export async function initializePermissions(): Promise<void> {
    try {
        for (const [code, def] of Object.entries(ALL_PERMISSIONS)) {
            await prisma.permission.upsert({
                where: { code },
                update: { name: def.name, module: def.module, action: def.action },
                create: { code, name: def.name, module: def.module, action: def.action }
            });
        }
        console.log('Permissões inicializadas com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar permissões:', error);
    }
}

// Mapeamento de rotas para permissões necessárias
export const ROUTE_PERMISSIONS: Record<string, PermissionCode> = {
    '/': 'dashboard.view',
    '/clients': 'clients.view',
    '/pipeline': 'pipeline.view',
    '/agenda': 'agenda.view',
    '/sellers': 'sellers.view',
    '/campaigns': 'campaigns.view',
    '/reports': 'reports.view',
    '/batch-analysis': 'analysis.view',
    '/goals': 'goals.view',
    '/settings': 'settings.view',
    '/users': 'users.view',
    '/carteira': 'carteira.view',
};

import { prisma } from './db';
import bcrypt from 'bcryptjs';

// Tipos
export interface UserSession {
    id: string;
    username: string;
    name: string;
    email: string | null;
    role: 'admin' | 'user';
    mustChangePassword?: boolean;
}

export interface AuthResult {
    success: boolean;
    user?: UserSession;
    error?: string;
    mustChangePassword?: boolean;
}

// Constantes de segurança
const MAX_LOGIN_ATTEMPTS = 3; // Bloqueia após 3 tentativas
const SESSION_DURATION_HOURS = 24;

// Função para hash de senha
export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
}

// Função para verificar senha
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// Autenticar usuário
export async function authenticateUser(username: string, password: string): Promise<AuthResult> {
    try {
        // Buscar usuário
        const user = await prisma.user.findUnique({
            where: { username: username.toLowerCase() }
        });

        if (!user) {
            return { success: false, error: 'Usuário ou senha inválidos' };
        }

        // Verificar se está ativo
        if (!user.active) {
            return { success: false, error: 'Usuário desativado. Contate o administrador.' };
        }

        // Verificar se está bloqueado permanentemente (lockedUntil = data muito no futuro)
        if (user.lockedUntil) {
            return { 
                success: false, 
                error: 'Conta bloqueada. Contate o administrador para desbloquear.' 
            };
        }

        // Verificar senha
        const isValid = await verifyPassword(password, user.password);

        if (!isValid) {
            // Incrementar tentativas de login
            const newAttempts = user.loginAttempts + 1;
            
            await prisma.user.update({
                where: { id: user.id },
                data: { loginAttempts: newAttempts }
            });

            const attemptsLeft = MAX_LOGIN_ATTEMPTS - newAttempts;
            
            if (attemptsLeft > 0) {
                return { 
                    success: false, 
                    error: `Senha incorreta. ${attemptsLeft} tentativa(s) restante(s).` 
                };
            } else {
                // Bloquear conta permanentemente e notificar admin
                await prisma.user.update({
                    where: { id: user.id },
                    data: { 
                        lockedUntil: new Date('2099-12-31'), // Bloqueio permanente
                        loginAttempts: newAttempts
                    }
                });

                // Criar notificação para administradores
                await prisma.notification.create({
                    data: {
                        type: 'security',
                        title: '🔒 Conta Bloqueada',
                        message: `O usuário "${user.name}" (@${user.username}) foi bloqueado após ${MAX_LOGIN_ATTEMPTS} tentativas de login incorretas. É necessário desbloquear e resetar a senha.`,
                        metadata: {
                            userId: user.id,
                            username: user.username,
                            reason: 'max_login_attempts'
                        }
                    }
                });

                return { 
                    success: false, 
                    error: 'Conta bloqueada após muitas tentativas. Contate o administrador.' 
                };
            }
        }

        // Verificar se precisa trocar a senha
        const mustChangePassword = (user as any).mustChangePassword === true;

        // Login bem sucedido - resetar tentativas
        await prisma.user.update({
            where: { id: user.id },
            data: {
                loginAttempts: 0,
                lockedUntil: null,
                lastLogin: new Date()
            }
        });

        return {
            success: true,
            mustChangePassword,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role as 'admin' | 'user',
                mustChangePassword
            }
        };

    } catch (error) {
        console.error('Erro na autenticação:', error);
        return { success: false, error: 'Erro interno. Tente novamente.' };
    }
}

// Criar sessão
export async function createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    await prisma.session.create({
        data: {
            userId,
            token,
            expiresAt,
            ipAddress,
            userAgent
        }
    });

    return token;
}

// Validar sessão
export async function validateSession(token: string): Promise<UserSession | null> {
    try {
        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: true }
        });

        if (!session) return null;

        // Verificar expiração
        if (session.expiresAt < new Date()) {
            await prisma.session.delete({ where: { id: session.id } });
            return null;
        }

        // Verificar se usuário ainda está ativo
        if (!session.user.active) {
            await prisma.session.delete({ where: { id: session.id } });
            return null;
        }

        return {
            id: session.user.id,
            username: session.user.username,
            name: session.user.name,
            email: session.user.email,
            role: session.user.role as 'admin' | 'user'
        };
    } catch (error) {
        console.error('Erro ao validar sessão:', error);
        return null;
    }
}

// Encerrar sessão
export async function destroySession(token: string): Promise<void> {
    try {
        await prisma.session.delete({ where: { token } });
    } catch (error) {
        // Sessão já não existe
    }
}

// Limpar sessões expiradas (pode ser executado periodicamente)
export async function cleanExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } }
    });
    return result.count;
}

// Gerar token de sessão seguro
function generateSessionToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token + '_' + Date.now().toString(36);
}

// Gerar senha aleatória segura
export function generateRandomPassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%&*';
    const allChars = uppercase + lowercase + numbers + special;
    
    // Garantir pelo menos um de cada tipo
    let password = '';
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += special.charAt(Math.floor(Math.random() * special.length));
    
    // Completar o resto
    for (let i = 4; i < length; i++) {
        password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Embaralhar
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Verificar autenticação de uma requisição
export async function verifyAuth(request: any): Promise<{ authenticated: boolean; user?: UserSession }> {
    try {
        // Pegar token do cookie
        const cookieHeader = request.headers.get('cookie');
        if (!cookieHeader) {
            return { authenticated: false };
        }

        // Extrair token do cookie
        const cookies = cookieHeader.split(';').reduce((acc: any, cookie: string) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {});

        const token = cookies['session_token'];
        if (!token) {
            return { authenticated: false };
        }

        // Validar sessão
        const user = await validateSession(token);
        if (!user) {
            return { authenticated: false };
        }

        return { authenticated: true, user };
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        return { authenticated: false };
    }
}

// Criar usuário admin padrão (executar apenas na inicialização)
export async function ensureAdminExists(): Promise<void> {
    try {
        const adminExists = await prisma.user.findFirst({
            where: { role: 'admin' }
        });

        if (!adminExists) {
            const hashedPassword = await hashPassword('admin');
            await prisma.user.create({
                data: {
                    username: 'admin',
                    name: 'Administrador',
                    email: 'admin@ymbale.com.br',
                    password: hashedPassword,
                    role: 'admin',
                    active: true
                }
            });
            console.log('✅ Usuário admin criado: admin / admin');
        }
    } catch (error) {
        console.error('Erro ao criar admin:', error);
    }
}


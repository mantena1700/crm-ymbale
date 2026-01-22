# 🔐 MÓDULO 2: AUTENTICAÇÃO E SEGURANÇA

## Objetivo
Implementar sistema completo de autenticação, sessões e controle de acesso.

## Passos de Implementação

### 1. Instalar Dependências

```bash
npm install bcryptjs @types/bcryptjs
```

### 2. Criar Funções de Autenticação

**Arquivo:** `src/lib/auth.ts`

#### 2.1. Hash de Senha
```typescript
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

#### 2.2. Autenticar Usuário
```typescript
export async function authenticateUser(username: string, password: string) {
  // 1. Buscar usuário por username
  // 2. Verificar se existe
  // 3. Verificar se está ativo
  // 4. Verificar se está bloqueado (lockedUntil)
  // 5. Verificar senha
  // 6. Se falhar: incrementar loginAttempts
  //    - Se >= 5: definir lockedUntil (30 min)
  // 7. Se sucesso: resetar loginAttempts, atualizar lastLogin
  // 8. Retornar resultado
}
```

#### 2.3. Criar Sessão
```typescript
export async function createSession(userId: string, ipAddress?: string, userAgent?: string) {
  // 1. Gerar token único (UUID ou random string)
  // 2. Definir expiresAt (24 horas)
  // 3. Criar registro na tabela Session
  // 4. Retornar token
}
```

#### 2.4. Verificar Sessão
```typescript
export async function verifySession(token: string) {
  // 1. Buscar sessão por token
  // 2. Verificar se existe
  // 3. Verificar se não expirou (expiresAt)
  // 4. Buscar dados do usuário
  // 5. Retornar usuário ou null
}
```

### 3. Criar API Routes

#### 3.1. Login (`src/app/api/auth/login/route.ts`)
```typescript
export async function POST(request: NextRequest) {
  // 1. Extrair username e password do body
  // 2. Validar campos obrigatórios
  // 3. Chamar authenticateUser
  // 4. Se sucesso:
  //    - Criar sessão
  //    - Definir cookie httpOnly
  //    - Retornar dados do usuário
  // 5. Se falhar: retornar erro
}
```

#### 3.2. Verificar Sessão (`src/app/api/auth/session/route.ts`)
```typescript
export async function GET(request: NextRequest) {
  // 1. Extrair token do cookie
  // 2. Verificar sessão
  // 3. Retornar dados do usuário ou null
}
```

#### 3.3. Logout (`src/app/api/auth/logout/route.ts`)
```typescript
export async function POST(request: NextRequest) {
  // 1. Extrair token do cookie
  // 2. Deletar sessão do banco
  // 3. Limpar cookie
  // 4. Retornar sucesso
}
```

### 4. Criar Middleware

**Arquivo:** `src/middleware.ts`

```typescript
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Rotas públicas
  const publicRoutes = ['/login', '/api/auth/login'];
  
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }
  
  // Verificar autenticação
  const token = request.cookies.get('session_token')?.value;
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  const session = await verifySession(token);
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}
```

### 5. Criar Context de Autenticação

**Arquivo:** `src/contexts/AuthContext.tsx`

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<{success: boolean, error?: string}>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

export function AuthProvider({ children }) {
  // Estado do usuário
  // Função checkSession (verificar sessão ao carregar)
  // Função login
  // Função logout
  // Retornar Provider com valores
}

export function useAuth() {
  // Hook para usar o contexto
}
```

### 6. Criar Página de Login

**Arquivo:** `src/app/login/page.tsx`

**Funcionalidades:**
- Formulário de login (username, password)
- Validação de campos
- Feedback de erros
- Loading state
- Redirecionamento após login
- Personalização (logo, cores, mensagem)

### 7. Sistema de Permissões (Opcional)

**Estrutura:**
- Tabela Permission (código, nome, módulo, ação)
- Tabela UserPermission (relação N:N)
- Função hasPermission(userId, permissionCode)

**Uso:**
```typescript
// Verificar permissão antes de renderizar
if (await hasPermission(userId, 'clients.create')) {
  // Mostrar botão de criar
}
```

### 8. Proteção de Server Actions

```typescript
// Helper para verificar autenticação em Server Actions
async function requireAuth() {
  const token = cookies().get('session_token')?.value;
  if (!token) throw new Error('Não autenticado');
  
  const session = await verifySession(token);
  if (!session) throw new Error('Sessão inválida');
  
  return session.user;
}

// Usar em Server Actions
export async function minhaAction() {
  const user = await requireAuth();
  // ... lógica da action
}
```

## Validações e Segurança

1. **Senha:**
   - Hash com bcrypt (10 rounds)
   - Nunca retornar senha em respostas

2. **Sessão:**
   - Token único e aleatório
   - Expiração de 24 horas
   - Cookie httpOnly (não acessível via JavaScript)

3. **Tentativas de Login:**
   - Limite de 5 tentativas
   - Bloqueio de 30 minutos após 5 falhas
   - Resetar contador após login bem-sucedido

4. **Proteção de Rotas:**
   - Middleware verifica todas as rotas (exceto públicas)
   - Server Actions verificam autenticação
   - Client Components usam useAuth()

## Testes

1. Login com credenciais válidas
2. Login com credenciais inválidas
3. Bloqueio após 5 tentativas
4. Verificação de sessão
5. Logout
6. Proteção de rotas

## Próximo Módulo

Após concluir este módulo, seguir para: **MÓDULO 3: IMPORTAÇÃO DE DADOS**

-- Adicionar coluna must_change_password à tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Atualizar o admin para NÃO precisar trocar a senha (já está com senha correta)
UPDATE users SET must_change_password = false WHERE username = 'admin';

-- Atualizar a senha do admin com o hash correto
UPDATE users 
SET password = '$2b$12$BpX92.w3B6hI5fLT5cl8e.iNJvbB1ywKqbovSTUSwcAEddUWKuFw2',
    login_attempts = 0,
    locked_until = NULL
WHERE username = 'admin';


# Correção dos Erros Atuais do Sistema

## Problemas Identificados

### 1. Erro SQLite: `no such column: manual_control_enabled`
**Descrição:** O banco de dados SQLite não tem as colunas necessárias para o novo sistema.

**Solução:**
```bash
node migrate-database.js
```

### 2. Erro Supabase: `Invalid API key`
**Descrição:** O sistema não consegue acessar o Supabase porque não há arquivo `.env` configurado.

**Solução:**
```bash
node setup-supabase.js
```

### 3. Erro Rate Limiting: `Status 429 - Too many requests`
**Descrição:** O dashboard está fazendo muitas requisições e atingindo o limite de rate limiting.

**Solução:**
```bash
npm run test-rate-limit
```

### 4. Erro Puppeteer: `Protocol error (Runtime.callFunctionOn): Session closed`
**Descrição:** Sessão do navegador fechada inesperadamente (sintoma dos outros problemas).

## Passos para Correção

### Passo 1: Verificar Configuração do Servidor
Primeiro, verifique se as variáveis de ambiente estão configuradas corretamente:

```bash
npm run check-env
```

### Passo 2: Corrigir Configuração (se necessário)
Se houver problemas, execute o script de correção:

```bash
npm run fix-server
```

### Passo 3: Migrar o Banco de Dados
Execute o script de migração para adicionar as colunas faltantes:

```bash
npm run migrate-db
```

Este script irá:
- Verificar se as colunas existem
- Adicionar colunas faltantes:
  - `is_first_message`
  - `manual_control_enabled`
  - `agent_id`
  - `manual_control_taken_at`
  - `finalized_at`
  - `final_message`

### Passo 4: Configurar o Supabase (se necessário)
Se o Supabase não estiver configurado, execute:

```bash
npm run setup-supabase
```

Este script irá:
- Criar ou atualizar o arquivo `.env`
- Solicitar URL e chave do Supabase
- Configurar as variáveis de ambiente necessárias

### Passo 5: Testar Rate Limiting
Teste se o rate limiting foi corrigido:

```bash
npm run test-rate-limit
```

### Passo 6: Testar a Configuração
Teste se o Supabase está funcionando:

```bash
npm run test-supabase
```

### Passo 7: Reiniciar o Sistema
Após as correções, reinicie o sistema:

```bash
# Se usando PM2
pm2 restart evolux-bot

# Se usando npm
npm start
```

## Estrutura da Tabela Supabase

Se você precisar criar a tabela `jobs` no Supabase, use esta estrutura:

```sql
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  salary_range TEXT,
  location TEXT,
  type TEXT DEFAULT 'CLT',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Verificação Final

Após executar todos os passos, verifique se os erros foram resolvidos:

1. **Banco de dados:** Não deve mais aparecer erro de coluna faltante
2. **Supabase:** Deve carregar vagas sem erro de API key
3. **WhatsApp:** Deve conectar normalmente sem erro de sessão

## Scripts Criados

- `migrate-database.js` - Migração do banco SQLite
- `setup-supabase.js` - Configuração do Supabase
- `test-supabase.js` - Teste da conexão Supabase
- `check-env.js` - Verificação de variáveis de ambiente
- `fix-server-env.js` - Correção de configuração do servidor
- `test-rate-limit.js` - Teste do rate limiting

## Próximos Passos

1. Execute os scripts na ordem apresentada
2. Reinicie o sistema
3. Monitore os logs para confirmar que os erros foram resolvidos
4. Teste o funcionamento do chatbot

## Suporte

Se ainda houver problemas após executar estes passos, verifique:
- Logs detalhados do sistema
- Configurações do Supabase no painel de controle
- Permissões da chave anônima do Supabase

# Verificação de Vagas Ativas

## Visão Geral

O sistema agora verifica automaticamente se uma vaga está ativa antes de mostrá-la para os candidatos. Isso garante que apenas vagas realmente disponíveis sejam exibidas.

### ⏰ **Timeout de Conversa**

O sistema também possui um timeout configurável para finalizar conversas automaticamente após 10 minutos de inatividade, garantindo que os recursos sejam liberados adequadamente.

## Como Funciona

### 🔍 **Verificações Automáticas**

O sistema verifica múltiplos critérios para determinar se uma vaga está ativa:

1. **Campo `is_active`**: Deve ser `true`
2. **Data de expiração**: Se existir `expires_at`, a data atual não pode ser posterior
3. **Status da vaga**: Deve ser `active` ou `ativa`
4. **Idade da vaga**: Vagas com mais de 90 dias (configurável) são consideradas inativas se não tiverem data de expiração
5. **Verificação manual**: Vagas específicas podem ser desativadas manualmente no código (ex: vaga de Secretária)

### 📋 **Logs Detalhados**

O sistema mostra logs claros para cada verificação:

```
✅ Vaga "Desenvolvedor Full Stack" está ativa
🚫 Vaga "Assistente Administrativo" está inativa (is_active: false)
🚫 Vaga "Analista de Marketing" expirou em 15/12/2024
🚫 Vaga "Vendedor" tem status inativo: closed
🚫 Vaga "Recepcionista" é muito antiga (120 dias, máximo: 90)
🚫 Vaga "Secretária" está inativa (vaga de Secretária desativada manualmente)
```

## Configuração

### Arquivo `src/config/config.js`

```javascript
jobs: {
  maxAgeDays: 90,           // Idade máxima em dias para vagas sem data de expiração
  cacheDuration: 300000,    // Cache de 5 minutos
  requireActiveStatus: true, // Sempre verificar status ativo
  showExpirationDate: true, // Mostrar data de expiração nas vagas
  autoRefresh: true         // Atualizar cache automaticamente
}
```

### Personalização

- **`maxAgeDays`**: Altere para 60, 120, etc. conforme sua necessidade
- **`showExpirationDate`**: Defina como `false` para não mostrar datas de expiração
- **`cacheDuration`**: Ajuste o tempo de cache (em milissegundos)

## Funcionalidades Implementadas

### ✅ **Verificação Robusta**
- Múltiplas camadas de verificação
- Logs detalhados para debug
- Tratamento de erros seguro

### ✅ **Cache Inteligente**
- Cache de 5 minutos para performance
- Atualização automática
- Verificação em tempo real quando necessário

### ✅ **Filtros Avançados**
- Por área de atuação
- Por localização
- Por nível de experiência
- Por compatibilidade com perfil do candidato

### ✅ **Estatísticas**
- Contagem de vagas ativas
- Distribuição por área
- Distribuição por localização
- Distribuição por nível

## Exemplos de Uso

### Buscar Todas as Vagas Ativas
```javascript
const jobService = new JobService();
const activeJobs = await jobService.getAllJobs();
console.log(`${activeJobs.length} vagas ativas encontradas`);
```

### Verificar se Há Vagas Disponíveis
```javascript
const hasJobs = await jobService.hasActiveJobs();
if (hasJobs) {
  console.log('Há vagas ativas disponíveis');
} else {
  console.log('Nenhuma vaga ativa no momento');
}
```

### Obter Estatísticas
```javascript
const stats = await jobService.getActiveJobsStats();
console.log(`Total: ${stats.total} vagas`);
console.log('Por área:', stats.byArea);
console.log('Por localização:', stats.byLocation);
```

## Vantagens

### 🎯 **Para Candidatos**
- Só vêem vagas realmente disponíveis
- Não perdem tempo com vagas expiradas
- Informações mais precisas sobre prazos

### 🏢 **Para Empresas**
- Controle total sobre vagas ativas
- Evita candidaturas para vagas fechadas
- Melhor gestão de prazos

### 🤖 **Para o Sistema**
- Performance otimizada com cache
- Logs detalhados para monitoramento
- Configuração flexível

## Solução de Problemas

### Vaga não aparece para candidatos
1. Verifique se `is_active` está `true`
2. Confirme se a data de expiração não passou
3. Verifique se o status está como `active`
4. Consulte os logs para detalhes

### Cache não atualiza
1. Aguarde 5 minutos (ou ajuste `cacheDuration`)
2. Use `refreshCache()` para forçar atualização
3. Verifique se `autoRefresh` está `true`

### Vagas muito antigas sendo filtradas
1. Ajuste `maxAgeDays` na configuração
2. Adicione data de expiração (`expires_at`) às vagas
3. Atualize o status para `active`

## Monitoramento

### Logs Importantes
- `✅ Vaga "X" está ativa` - Vaga aprovada
- `🚫 Vaga "X" está inativa` - Vaga rejeitada
- `⚠️ Nenhuma vaga ativa encontrada` - Sem vagas disponíveis

### Métricas
- Total de vagas carregadas vs vagas ativas
- Tempo de resposta das consultas
- Taxa de cache hit/miss
- Distribuição de vagas por critério

---

**Nota**: Esta funcionalidade garante que apenas vagas realmente ativas sejam mostradas aos candidatos, melhorando a experiência do usuário e a eficiência do processo de recrutamento.

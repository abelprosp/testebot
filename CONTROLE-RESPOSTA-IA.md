# Controle de Resposta da IA

## Configuração Atual

O sistema está configurado para que a IA **só responda quando alguém te chamar**, não quando você chamar alguém.

### Como Funciona

1. **Mensagens Enviadas por Você**: Quando você envia uma mensagem para alguém, a IA **NÃO** responde automaticamente
2. **Mensagens Recebidas**: Quando alguém te envia uma mensagem, a IA processa e responde normalmente

### Configuração no Código

No arquivo `src/config/config.js`:

```javascript
conversation: {
  // ... outras configurações ...
  onlyRespondToIncoming: true  // true = só responde quando recebe mensagem
}
```

### Logs de Debug

O sistema agora mostra logs claros:

- `🚫 Ignorando mensagem enviada pelo próprio bot` - quando você envia uma mensagem
- `📱 Nova mensagem recebida de [número]: [texto]` - quando alguém te envia uma mensagem
- `✅ Configuração ativa: IA só responde quando alguém te chama` - confirmação da configuração

### Como Alterar o Comportamento

Se você quiser que a IA responda sempre (incluindo quando você chama alguém):

1. Abra o arquivo `src/config/config.js`
2. Mude `onlyRespondToIncoming: true` para `onlyRespondToIncoming: false`
3. Reinicie o bot

### Vantagens da Configuração Atual

- ✅ Evita respostas automáticas indesejadas
- ✅ Mantém controle total sobre quando a IA atua
- ✅ Permite que você envie mensagens sem interferência da IA
- ✅ Só ativa a IA quando realmente necessário (quando alguém te contata)

### Casos de Uso

**Configuração Atual (onlyRespondToIncoming: true)**:
- Você envia "Oi João" → IA não responde
- João te envia "Oi" → IA responde automaticamente

**Configuração Alternativa (onlyRespondToIncoming: false)**:
- Você envia "Oi João" → IA pode responder
- João te envia "Oi" → IA responde automaticamente

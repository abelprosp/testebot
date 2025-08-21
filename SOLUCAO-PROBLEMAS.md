# 🔧 Solução de Problemas - Agente Evolux

## 🚨 Problemas Comuns e Soluções

### **1. Erro do Chrome/Puppeteer**

**Problema:**
```
❌ Erro ao inicializar cliente WhatsApp: Error: Failed to launch the browser process! spawn C:\Program Files\Google\Chrome\Application\chrome.ex ENOENT
```

**Solução:**
```bash
# 1. Instalar Puppeteer com Chrome embutido
npm install puppeteer

# 2. Configurar o arquivo .env (NÃO configure CHROME_PATH)
npm run setup

# 3. Testar o sistema
npm start
```

### **2. Erro da API Groq**

**Problema:**
```
❌ Invalid API Key
```

**Solução:**
```bash
# 1. Obter chave válida em: https://console.groq.com/
# 2. Configurar a chave
npm run setup

# 3. Testar a API
npm run test-groq

# 4. Se funcionar, executar o sistema
npm start
```

### **3. Sistema Não Inicia**

**Problema:**
```
❌ Erro ao inicializar WhatsApp
```

**Solução:**
```bash
# 1. Verificar configurações
npm run test-groq

# 2. Se API OK, tentar sem WhatsApp
npm run test-new-flow

# 3. Verificar logs
npm run diagnose
```

## 🔧 Scripts de Diagnóstico

### **1. Configurar Sistema**
```bash
npm run setup
```
- Configura arquivo .env
- Define chaves de API
- Configura portas e tokens

### **2. Testar API Groq**
```bash
npm run test-groq
```
- Verifica se a chave da API está válida
- Testa conexão com Groq
- Mostra resposta da API

### **3. Testar Fluxo Completo**
```bash
npm run test-new-flow
```
- Testa todos os endpoints da API
- Verifica funcionalidades do sistema
- Mostra status de cada componente

### **4. Diagnóstico Geral**
```bash
npm run diagnose
```
- Verifica configurações do sistema
- Mostra logs de erro
- Sugere soluções

## 📋 Checklist de Configuração

### **✅ Passos Obrigatórios:**

1. **Instalar Dependências**
   ```bash
   npm install
   npm install puppeteer
   ```

2. **Configurar API Groq**
   ```bash
   npm run setup
   # Digite sua chave da API Groq
   ```

3. **Testar API**
   ```bash
   npm run test-groq
   ```

4. **Iniciar Sistema**
   ```bash
   npm start
   ```

### **✅ Passos Opcionais:**

5. **Testar Fluxo Completo**
   ```bash
   npm run test-new-flow
   ```

6. **Usar Controle Manual**
   ```bash
   npm run cli
   ```

## 🔍 Verificações Importantes

### **1. Arquivo .env**
Verifique se o arquivo `.env` existe e contém:
```env
GROQ_API_KEY=sua_chave_valida_aqui
WHATSAPP_NUMBER=5511999999999
PORT=3000
DASHBOARD_PORT=3003
DASHBOARD_TOKEN=Jornada2024@
```

### **2. Dependências**
Verifique se todas as dependências estão instaladas:
```bash
npm list --depth=0
```

### **3. Portas Disponíveis**
Verifique se as portas 3000 e 3003 estão livres:
```bash
netstat -an | findstr :3000
netstat -an | findstr :3003
```

## 🚀 Soluções Rápidas

### **Problema: Chrome não encontrado**
```bash
# Solução: Usar Chrome embutido
npm install puppeteer
# Remover CHROME_PATH do .env
npm start
```

### **Problema: API Key inválida**
```bash
# Solução: Reconfigurar
npm run setup
npm run test-groq
```

### **Problema: Sistema não inicia**
```bash
# Solução: Verificar passo a passo
npm run test-groq
npm run test-new-flow
npm run diagnose
```

### **Problema: WhatsApp não conecta**
```bash
# Solução: Verificar QR Code
# 1. Acesse: http://localhost:3000/whatsapp/qrcode
# 2. Escaneie com WhatsApp
# 3. Aguarde conexão
```

## 📞 Suporte

Se os problemas persistirem:

1. **Verifique os logs** do sistema
2. **Execute os scripts de diagnóstico**
3. **Verifique a documentação** em `FLUXO-ATUALIZADO.md`
4. **Teste cada componente** individualmente

## 🎯 Dicas Importantes

- ✅ **Sempre use `npm run setup`** para configurar
- ✅ **Teste a API Groq** antes de iniciar o sistema
- ✅ **Use Chrome embutido** do Puppeteer (mais confiável)
- ✅ **Verifique as portas** antes de iniciar
- ✅ **Mantenha as chaves de API** seguras e atualizadas

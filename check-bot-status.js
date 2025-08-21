const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('./src/config/config');

console.log('🔍 Verificando status do bot...\n');

const db = new sqlite3.Database(config.database.path);

async function checkBotStatus() {
  try {
    console.log('📊 Status das conversas ativas:');
    console.log('='.repeat(60));
    
    // Busca todas as conversas
    const conversations = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          id,
          phone_number,
          user_type,
          status,
          is_first_message,
          manual_control_enabled,
          agent_id,
          created_at,
          updated_at
        FROM conversations 
        ORDER BY created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (conversations.length === 0) {
      console.log('ℹ️ Nenhuma conversa encontrada');
    } else {
      conversations.forEach((conv, index) => {
        console.log(`\n📱 Conversa ${index + 1}:`);
        console.log(`   ID: ${conv.id}`);
        console.log(`   Telefone: ${conv.phone_number}`);
        console.log(`   Tipo: ${conv.user_type}`);
        console.log(`   Status: ${conv.status}`);
        console.log(`   Primeira mensagem: ${conv.is_first_message ? 'Sim' : 'Não'}`);
        console.log(`   Controle manual: ${conv.manual_control_enabled ? 'Ativo' : 'Inativo'}`);
        console.log(`   Agente: ${conv.agent_id || 'Nenhum'}`);
        console.log(`   Criada: ${conv.created_at}`);
        console.log(`   Atualizada: ${conv.updated_at}`);
      });
    }

    // Verifica estrutura da tabela
    console.log('\n🔧 Estrutura da tabela conversations:');
    console.log('='.repeat(60));
    
    const columns = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(conversations)', (err, cols) => {
        if (err) reject(err);
        else resolve(cols);
      });
    });

    columns.forEach(col => {
      console.log(`   ✅ ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });

    // Estatísticas
    console.log('\n📈 Estatísticas:');
    console.log('='.repeat(60));
    
    const stats = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as total_conversas,
          SUM(CASE WHEN manual_control_enabled = 1 THEN 1 ELSE 0 END) as controle_manual,
          SUM(CASE WHEN is_first_message = 1 THEN 1 ELSE 0 END) as primeira_mensagem,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as ativas
        FROM conversations
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log(`   Total de conversas: ${stats.total_conversas}`);
    console.log(`   Com controle manual: ${stats.controle_manual}`);
    console.log(`   Primeira mensagem: ${stats.primeira_mensagem}`);
    console.log(`   Ativas: ${stats.ativas}`);

    // Verifica se há problemas
    console.log('\n🔍 Verificação de problemas:');
    console.log('='.repeat(60));
    
    const problems = [];
    
    // Verifica conversas com controle manual ativo sem agente
    const manualWithoutAgent = await new Promise((resolve, reject) => {
      db.all(`
        SELECT phone_number 
        FROM conversations 
        WHERE manual_control_enabled = 1 AND (agent_id IS NULL OR agent_id = '')
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (manualWithoutAgent.length > 0) {
      problems.push(`❌ ${manualWithoutAgent.length} conversa(s) com controle manual ativo sem agente`);
    }

    // Verifica conversas com valores NULL problemáticos
    const nullValues = await new Promise((resolve, reject) => {
      db.all(`
        SELECT phone_number 
        FROM conversations 
        WHERE manual_control_enabled IS NULL 
           OR is_first_message IS NULL 
           OR status IS NULL
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (nullValues.length > 0) {
      problems.push(`❌ ${nullValues.length} conversa(s) com valores NULL problemáticos`);
    }

    if (problems.length === 0) {
      console.log('   ✅ Nenhum problema encontrado!');
    } else {
      problems.forEach(problem => console.log(`   ${problem}`));
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICAÇÃO CONCLUÍDA!');
    console.log('='.repeat(60));
    
    if (problems.length === 0) {
      console.log('🎉 Bot funcionando corretamente!');
      console.log('🤖 Não deve assumir controle automaticamente.');
    } else {
      console.log('⚠️ Problemas encontrados. Execute o script de correção.');
    }

  } catch (error) {
    console.error('❌ Erro durante a verificação:', error.message);
  } finally {
    db.close();
  }
}

checkBotStatus();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('./src/config/config');

console.log('🔧 Corrigindo banco de dados em produção...\n');

const db = new sqlite3.Database(config.database.path);

// Função para verificar e corrigir a estrutura da tabela
async function fixConversationsTable() {
  console.log('🔍 Verificando estrutura da tabela conversations...');
  
  try {
    // Verifica se a tabela existe
    const tableExists = await new Promise((resolve, reject) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'", (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });

    if (!tableExists) {
      console.log('📝 Criando tabela conversations...');
      
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT NOT NULL,
            user_type TEXT CHECK(user_type IN ('candidate', 'company', 'other', 'unknown')) DEFAULT 'unknown',
            status TEXT DEFAULT 'active',
            is_first_message BOOLEAN DEFAULT 1,
            manual_control_enabled BOOLEAN DEFAULT 0,
            agent_id TEXT,
            manual_control_taken_at DATETIME,
            finalized_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('❌ Erro ao criar tabela:', err.message);
            reject(err);
          } else {
            console.log('✅ Tabela conversations criada com sucesso!');
            resolve();
          }
        });
      });
    } else {
      console.log('ℹ️ Tabela conversations já existe');
      
      // Verifica e adiciona colunas que podem estar faltando
      const columnsToAdd = [
        { name: 'manual_control_enabled', definition: 'BOOLEAN DEFAULT 0' },
        { name: 'agent_id', definition: 'TEXT' },
        { name: 'manual_control_taken_at', definition: 'DATETIME' },
        { name: 'finalized_at', definition: 'DATETIME' },
        { name: 'is_first_message', definition: 'BOOLEAN DEFAULT 1' },
        { name: 'updated_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
      ];

      for (const column of columnsToAdd) {
        await addColumnIfNotExists('conversations', column.name, column.definition);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error.message);
  }
}

// Função para adicionar coluna se não existir
async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  try {
    const exists = await columnExists(tableName, columnName);
    
    if (!exists) {
      console.log(`➕ Adicionando coluna ${columnName}...`);
      
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`, (err) => {
          if (err) {
            console.error(`❌ Erro ao adicionar coluna ${columnName}:`, err.message);
            reject(err);
          } else {
            console.log(`✅ Coluna ${columnName} adicionada com sucesso!`);
            resolve();
          }
        });
      });
    } else {
      console.log(`ℹ️ Coluna ${columnName} já existe`);
    }
  } catch (error) {
    console.error(`❌ Erro ao verificar coluna ${columnName}:`, error.message);
  }
}

// Função para verificar se coluna existe
function columnExists(tableName, columnName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) {
        reject(err);
        return;
      }
      
      const exists = columns.some(col => col.name === columnName);
      resolve(exists);
    });
  });
}

// Função para corrigir conversas existentes
async function fixExistingConversations() {
  console.log('\n🔧 Corrigindo conversas existentes...');
  
  try {
    // Busca todas as conversas
    const conversations = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM conversations', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log(`📊 Encontradas ${conversations.length} conversas`);

    // Corrige cada conversa
    for (const conversation of conversations) {
      console.log(`🔧 Corrigindo conversa ${conversation.id} (${conversation.phone_number})`);
      
      // Define valores padrão para colunas que podem estar NULL
      const updates = [];
      const params = [];
      
      if (conversation.manual_control_enabled === null || conversation.manual_control_enabled === undefined) {
        updates.push('manual_control_enabled = 0');
      }
      
      if (conversation.is_first_message === null || conversation.is_first_message === undefined) {
        updates.push('is_first_message = 1');
      }
      
      if (conversation.status === null || conversation.status === undefined) {
        updates.push('status = "active"');
      }
      
      if (updates.length > 0) {
        const updateQuery = `UPDATE conversations SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        params.push(conversation.id);
        
        await new Promise((resolve, reject) => {
          db.run(updateQuery, params, function(err) {
            if (err) {
              console.error(`❌ Erro ao corrigir conversa ${conversation.id}:`, err.message);
              reject(err);
            } else {
              console.log(`✅ Conversa ${conversation.id} corrigida`);
              resolve();
            }
          });
        });
      } else {
        console.log(`ℹ️ Conversa ${conversation.id} já está correta`);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao corrigir conversas:', error.message);
  }
}

// Função para testar o banco de dados
async function testDatabase() {
  console.log('\n🧪 Testando banco de dados...');
  
  try {
    // Teste 1: Criar uma nova conversa
    const testPhone = '5551999999999';
    const conversationId = await new Promise((resolve, reject) => {
      db.run('INSERT INTO conversations (phone_number, user_type) VALUES (?, ?)', 
        [testPhone, 'unknown'], 
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    console.log(`✅ Conversa criada com ID: ${conversationId}`);

    // Teste 2: Verificar controle manual
    const manualControl = await new Promise((resolve, reject) => {
      db.get('SELECT manual_control_enabled, is_first_message, status FROM conversations WHERE id = ?', 
        [conversationId], 
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    console.log(`✅ Controle manual: ${manualControl.manual_control_enabled}, Primeira mensagem: ${manualControl.is_first_message}, Status: ${manualControl.status}`);

    // Teste 3: Habilitar controle manual
    await new Promise((resolve, reject) => {
      db.run('UPDATE conversations SET manual_control_enabled = 1, agent_id = ? WHERE id = ?', 
        ['test-agent', conversationId], 
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    console.log('✅ Controle manual habilitado');

    // Limpa o teste
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM conversations WHERE phone_number = ?', [testPhone], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ Teste limpo');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Função principal
async function fixProductionDatabase() {
  try {
    console.log('🚀 Iniciando correção do banco de dados em produção...\n');

    // Corrige a estrutura da tabela
    await fixConversationsTable();

    // Corrige conversas existentes
    await fixExistingConversations();

    // Testa o banco de dados
    await testDatabase();

    // Mostra estrutura final
    console.log('\n📋 Estrutura final da tabela conversations:');
    const columns = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(conversations)', (err, cols) => {
        if (err) reject(err);
        else resolve(cols);
      });
    });

    columns.forEach(col => {
      console.log(`   - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ CORREÇÃO CONCLUÍDA!');
    console.log('='.repeat(50));
    console.log('🎉 Banco de dados em produção corrigido!');
    console.log('🔄 Reinicie o sistema para aplicar as mudanças.');
    console.log('🤖 O bot não deve mais assumir controle automaticamente.');

  } catch (error) {
    console.error('❌ Erro durante a correção:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    db.close();
  }
}

// Executar a correção
fixProductionDatabase();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('./src/config/config');

console.log('🔧 Forçando atualização do banco de dados...\n');

const db = new sqlite3.Database(config.database.path);

// Função para verificar se uma coluna existe
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

// Função para adicionar uma coluna se ela não existir
async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  try {
    const exists = await columnExists(tableName, columnName);
    
    if (!exists) {
      console.log(`➕ Adicionando coluna ${columnName} na tabela ${tableName}...`);
      
      return new Promise((resolve, reject) => {
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
      console.log(`ℹ️ Coluna ${columnName} já existe na tabela ${tableName}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao verificar coluna ${columnName}:`, error.message);
  }
}

// Função para recriar a tabela conversations se necessário
async function recreateConversationsTable() {
  console.log('🔄 Verificando estrutura da tabela conversations...');
  
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
      
      return new Promise((resolve, reject) => {
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
            console.error('❌ Erro ao criar tabela conversations:', err.message);
            reject(err);
          } else {
            console.log('✅ Tabela conversations criada com sucesso!');
            resolve();
          }
        });
      });
    } else {
      console.log('ℹ️ Tabela conversations já existe');
    }
  } catch (error) {
    console.error('❌ Erro ao verificar tabela conversations:', error.message);
  }
}

// Função para atualizar o banco de dados
async function updateDatabase() {
  try {
    console.log('🚀 Iniciando atualização forçada do banco de dados...\n');

    // Recria a tabela conversations se necessário
    await recreateConversationsTable();

    // Adiciona colunas que podem estar faltando
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

    // Verifica se todas as colunas foram adicionadas
    console.log('\n🔍 Verificando estrutura final da tabela conversations...');
    
    const columns = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(conversations)', (err, cols) => {
        if (err) reject(err);
        else resolve(cols);
      });
    });

    console.log('📋 Colunas na tabela conversations:');
    columns.forEach(col => {
      console.log(`   - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });

    // Testa algumas operações básicas
    console.log('\n🧪 Testando operações básicas...');
    
    // Teste 1: Criar uma conversa
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

    // Teste 2: Habilitar controle manual
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

    // Teste 3: Verificar controle manual
    const manualControl = await new Promise((resolve, reject) => {
      db.get('SELECT manual_control_enabled, agent_id FROM conversations WHERE id = ?', 
        [conversationId], 
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    console.log(`✅ Controle manual verificado: ${manualControl.manual_control_enabled}, Agente: ${manualControl.agent_id}`);

    // Limpa o teste
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM conversations WHERE phone_number = ?', [testPhone], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ ATUALIZAÇÃO FORÇADA CONCLUÍDA!');
    console.log('='.repeat(50));
    console.log('🎉 Banco de dados atualizado com sucesso!');
    console.log('🔄 Reinicie o sistema para aplicar as mudanças.');

  } catch (error) {
    console.error('❌ Erro durante a atualização:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    db.close();
  }
}

// Executar a atualização
updateDatabase();

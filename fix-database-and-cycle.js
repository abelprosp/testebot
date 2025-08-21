const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('./src/config/config');

console.log('🔧 Corrigindo problemas do banco de dados e ciclo infinito...\n');

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
      return new Promise((resolve, reject) => {
        const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`;
        console.log(`📝 Adicionando coluna ${columnName} à tabela ${tableName}...`);
        db.run(sql, (err) => {
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
    throw error;
  }
}

// Função para corrigir conversas em ciclo infinito
async function fixInfiniteCycleConversations() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Verificando conversas em ciclo infinito...');
    
    // Busca conversas que podem estar em ciclo
    const sql = `
      SELECT DISTINCT phone_number, COUNT(*) as message_count, 
             MAX(created_at) as last_message
      FROM conversations 
      WHERE status = 'active' 
      GROUP BY phone_number 
      HAVING message_count > 5
      ORDER BY last_message DESC
    `;
    
    db.all(sql, (err, rows) => {
      if (err) {
        console.error('❌ Erro ao buscar conversas:', err.message);
        reject(err);
        return;
      }
      
      if (rows.length === 0) {
        console.log('✅ Nenhuma conversa em ciclo infinito encontrada');
        resolve();
        return;
      }
      
      console.log(`⚠️ Encontradas ${rows.length} conversas suspeitas de ciclo infinito:`);
      rows.forEach(row => {
        console.log(`   - ${row.phone_number}: ${row.message_count} mensagens`);
      });
      
      // Corrige as conversas problemáticas
      rows.forEach(row => {
        const updateSql = `
          UPDATE conversations 
          SET status = 'finalized', 
              updated_at = CURRENT_TIMESTAMP,
              manual_control_enabled = 0,
              agent_id = NULL
          WHERE phone_number = ? AND status = 'active'
        `;
        
        db.run(updateSql, [row.phone_number], (err) => {
          if (err) {
            console.error(`❌ Erro ao corrigir conversa ${row.phone_number}:`, err.message);
          } else {
            console.log(`✅ Conversa ${row.phone_number} corrigida`);
          }
        });
      });
      
      resolve();
    });
  });
}

// Função para limpar dados de teste antigos
async function cleanOldTestData() {
  return new Promise((resolve, reject) => {
    console.log('🧹 Limpando dados de teste antigos...');
    
    // Remove conversas antigas (mais de 7 dias) que não foram finalizadas
    const sql = `
      DELETE FROM conversations 
      WHERE created_at < datetime('now', '-7 days') 
      AND status != 'finalized'
    `;
    
    db.run(sql, function(err) {
      if (err) {
        console.error('❌ Erro ao limpar dados antigos:', err.message);
        reject(err);
      } else {
        console.log(`✅ ${this.changes} conversas antigas removidas`);
        resolve();
      }
    });
  });
}

// Função principal
async function fixDatabaseAndCycle() {
  try {
    console.log('🔍 Verificando estrutura do banco de dados...');
    
    // Adicionar colunas faltantes na tabela conversations
    await addColumnIfNotExists('conversations', 'is_first_message', 'BOOLEAN DEFAULT 1');
    await addColumnIfNotExists('conversations', 'manual_control_enabled', 'BOOLEAN DEFAULT 0');
    await addColumnIfNotExists('conversations', 'agent_id', 'TEXT');
    await addColumnIfNotExists('conversations', 'manual_control_taken_at', 'DATETIME');
    await addColumnIfNotExists('conversations', 'finalized_at', 'DATETIME');
    await addColumnIfNotExists('conversations', 'final_message', 'TEXT');
    
    // Corrigir conversas em ciclo infinito
    await fixInfiniteCycleConversations();
    
    // Limpar dados antigos
    await cleanOldTestData();
    
    console.log('\n✅ Correções aplicadas com sucesso!');
    console.log('🔄 Reinicie o sistema para aplicar as mudanças.');
    
  } catch (error) {
    console.error('❌ Erro durante as correções:', error.message);
  } finally {
    db.close();
  }
}

// Executar as correções
fixDatabaseAndCycle();

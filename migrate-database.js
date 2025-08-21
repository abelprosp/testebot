const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('./src/config/config');

console.log('🔄 Iniciando migração do banco de dados...');

const db = new sqlite3.Database(config.database.path);

// Função para verificar se uma coluna existe
function columnExists(tableName, columnName) {
  return new Promise((resolve, reject) => {
    db.get(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
        if (err) {
          reject(err);
          return;
        }
        
        const exists = columns.some(col => col.name === columnName);
        resolve(exists);
      });
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

// Executar migrações
async function runMigrations() {
  try {
    console.log('🔍 Verificando estrutura do banco de dados...');
    
    // Adicionar colunas faltantes na tabela conversations
    await addColumnIfNotExists('conversations', 'is_first_message', 'BOOLEAN DEFAULT 1');
    await addColumnIfNotExists('conversations', 'manual_control_enabled', 'BOOLEAN DEFAULT 0');
    await addColumnIfNotExists('conversations', 'agent_id', 'TEXT');
    await addColumnIfNotExists('conversations', 'manual_control_taken_at', 'DATETIME');
    await addColumnIfNotExists('conversations', 'finalized_at', 'DATETIME');
    await addColumnIfNotExists('conversations', 'final_message', 'TEXT');
    
    console.log('✅ Migração concluída com sucesso!');
    console.log('🔄 Reinicie o sistema para aplicar as mudanças.');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error.message);
  } finally {
    db.close();
  }
}

runMigrations();

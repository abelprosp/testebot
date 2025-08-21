#!/bin/bash

echo "🔧 Corrigindo banco de dados em produção..."
echo "📁 Diretório atual: $(pwd)"

# Verifica se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instalando..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Verifica se o script existe
if [ ! -f "fix-production-database.js" ]; then
    echo "❌ Script fix-production-database.js não encontrado!"
    echo "📥 Baixando script..."
    cat > fix-production-database.js << 'EOF'
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuração do banco de dados
const dbPath = './database/evolux.db';

console.log('🔧 Corrigindo banco de dados em produção...\n');

const db = new sqlite3.Database(dbPath);

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
EOF
fi

# Instala dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install sqlite3
fi

# Executa o script de correção
echo "🚀 Executando correção do banco de dados..."
node fix-production-database.js

# Reinicia o PM2
echo "🔄 Reiniciando aplicação..."
pm2 restart all

echo "✅ Correção concluída!"
echo "🤖 O bot deve estar funcionando corretamente agora."

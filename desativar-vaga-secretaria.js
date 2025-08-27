const { createClient } = require('@supabase/supabase-js');
const config = require('./src/config/config');

async function desativarVagaSecretaria() {
  console.log('🚫 Desativando Vaga de Secretária');
  console.log('==================================');
  
  if (!config.supabase?.url || !config.supabase?.key) {
    console.error('❌ Configuração do Supabase incompleta!');
    return;
  }
  
  const supabase = createClient(config.supabase.url, config.supabase.key);
  
  // Primeiro, vamos encontrar a vaga de Secretária
  console.log('\n🔍 Buscando vaga de Secretária...');
  const { data: secretariaJob, error: findError } = await supabase
    .from('jobs')
    .select('*')
    .or('title.ilike.%secretaria%,title.ilike.%secretária%')
    .eq('is_active', true)
    .single();
    
  if (findError) {
    console.error('❌ Erro ao buscar vaga de Secretária:', findError);
    return;
  }
  
  if (!secretariaJob) {
    console.log('❌ Vaga de Secretária não encontrada ou já está inativa');
    return;
  }
  
  console.log('\n🎯 Vaga encontrada:');
  console.log('ID:', secretariaJob.id);
  console.log('Título:', secretariaJob.title);
  console.log('Status atual:', secretariaJob.is_active ? 'ATIVA' : 'INATIVA');
  
  // Agora vamos desativar a vaga
  console.log('\n🔄 Desativando vaga...');
  const { data: updatedJob, error: updateError } = await supabase
    .from('jobs')
    .update({ 
      is_active: false
    })
    .eq('id', secretariaJob.id)
    .select();
    
  if (updateError) {
    console.error('❌ Erro ao desativar vaga:', updateError);
    return;
  }
  
  console.log('\n✅ Vaga desativada com sucesso!');
  if (updatedJob && updatedJob.length > 0) {
    console.log('ID:', updatedJob[0].id);
    console.log('Título:', updatedJob[0].title);
    console.log('Novo status:', updatedJob[0].is_active ? 'ATIVA' : 'INATIVA');
  }
  
  // Verificar se a vaga não aparece mais na lista de ativas
  console.log('\n🔍 Verificando se a vaga não aparece mais na lista de ativas...');
  const { data: activeJobs, error: checkError } = await supabase
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .or('title.ilike.%secretaria%,title.ilike.%secretária%');
    
  if (checkError) {
    console.error('❌ Erro ao verificar vagas ativas:', checkError);
    return;
  }
  
  if (activeJobs && activeJobs.length > 0) {
    console.log('⚠️ ATENÇÃO: Ainda há vagas de Secretaria ativas:');
    activeJobs.forEach(job => {
      console.log(`- ${job.title} (ID: ${job.id})`);
    });
  } else {
    console.log('✅ Confirmado: Nenhuma vaga de Secretaria está mais ativa');
  }
  
  console.log('\n🎉 Processo concluído! A vaga de Secretária foi desativada.');
}

desativarVagaSecretaria().catch(console.error);

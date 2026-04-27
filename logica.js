// Configurações Globais e API
const API_URL = ''; // URL vazia pois os arquivos são servidos do mesmo domínio

// Estado Global
let configuracoesFabyNails = {
    precos: {
        "Manicure & Pedicure": 60.00,
        "Depilação": 80.00,
        "Spa dos Pés": 50.00,
        "Sobrancelhas": 35.00
    },
    pix: {
        chave: "+5511999999999",
        nome: "Faby Nails",
        cidade: "Sao Paulo"
    }
};

let dadosAgendamentoTemporario = null;

// Funções de Utilitário para API
async function apiFetch(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);
        return await response.json();
    } catch (error) {
        console.error(`Erro ao chamar ${endpoint}:`, error);
        return null;
    }
}

// Inicialização: Carregar Configurações e Dados
async function inicializarApp() {
    const configs = await apiFetch('/api/configuracoes');
    if (configs && configs.geral) {
        configuracoesFabyNails = configs.geral;
    } else if (configs && Object.keys(configs).length > 0) {
        // Se as configs vierem separadas ou em outro formato
        if (configs.precos) configuracoesFabyNails.precos = configs.precos;
        if (configs.pix) configuracoesFabyNails.pix = configs.pix;
    } else {
        // Se não houver no banco, salva as padrões iniciais
        await apiFetch('/api/configuracoes', 'POST', { chave: 'geral', valor: configuracoesFabyNails });
    }
    
    atualizarListaClientesSelect();
}

// Chamar inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', inicializarApp);

const janelaModal = document.getElementById('modalAgendamento');
const formulario = document.getElementById('formularioAgendamento');
const mensagemSucesso = document.getElementById('mensagemSucesso');
const selecaoServico = document.getElementById('selecaoServico');

function abrirModalAgendamento() {
    // Definir data mínima como hoje
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('selecaoData').setAttribute('min', hoje);

    janelaModal.classList.add('ativo');
    document.body.style.overflow = 'hidden'; 
    
    formulario.style.display = 'block';
    mensagemSucesso.style.display = 'none';
    const telaPix = document.getElementById('telaPix');
    if (telaPix) telaPix.style.display = 'none';
    
    formulario.reset();
    
    atualizarListaClientesSelect();
}

async function atualizarListaClientesSelect() {
    const clientes = await apiFetch('/api/clientes');
    const selectClientes = document.getElementById('selecaoClienteCadastrado');
    const areaClientes = document.getElementById('areaClientesCadastrados');
    
    if (!selectClientes || !areaClientes) return;

    if (clientes && clientes.length > 0) {
        areaClientes.style.display = 'block';
        selectClientes.innerHTML = '<option value="">-- Novo Cliente (Vou preencher abaixo) --</option>';
        
        clientes.forEach((cliente, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${cliente.nome} - ${cliente.telefone}`;
            selectClientes.appendChild(option);
        });
        
        window.clientesCadastradosData = clientes;
    } else {
        areaClientes.style.display = 'none';
    }
}

function preencherDadosCliente() {
    const select = document.getElementById('selecaoClienteCadastrado');
    const nomeInput = document.getElementById('nomeCliente');
    const telefoneInput = document.getElementById('telefoneCliente');
    
    if (select.value !== "") {
        const cliente = window.clientesCadastradosData[select.value];
        nomeInput.value = cliente.nome;
        telefoneInput.value = cliente.telefone;
    } else {
        nomeInput.value = "";
        telefoneInput.value = "";
    }
}

function fecharModalAgendamento() {
    janelaModal.classList.remove('ativo');
    document.body.style.overflow = ''; // Restaurar a rolagem da página
}

function selecionarServico(nomeDoServico) {
    // Abrir o modal e pré-selecionar o serviço escolhido
    abrirModalAgendamento();
    
    // Percorrer as opções para selecionar a correta
    for(let i = 0; i < selecaoServico.options.length; i++) {
        if(selecaoServico.options[i].value === nomeDoServico) {
            selecaoServico.selectedIndex = i;
            break;
        }
    }
}

// Fechar o modal ao clicar fora dele
janelaModal.addEventListener('click', function(evento) {
    if (evento.target === janelaModal) {
        fecharModalAgendamento();
    }
});

// Formatar o número de telefone automaticamente (WhatsApp)
const entradaTelefone = document.getElementById('telefoneCliente');
entradaTelefone.addEventListener('input', function(e) {
    let valor = e.target.value.replace(/\D/g, '');
    let valorFormatado = '';
    
    if (valor.length > 0) {
        valorFormatado = '(' + valor.substring(0, 2);
    }
    if (valor.length > 2) {
        valorFormatado += ') ' + valor.substring(2, 7);
    }
    if (valor.length > 7) {
        valorFormatado += '-' + valor.substring(7, 11);
    }
    
    e.target.value = valorFormatado;
});

// Lidar com o envio do formulário
function enviarAgendamento(evento) {
    evento.preventDefault(); // Impedir o recarregamento da página
    
    // Coletar os dados
    const nomeDoServico = document.getElementById('selecaoServico').value;
    const data = document.getElementById('selecaoData').value;
    const hora = document.getElementById('selecaoHora').value;
    const nome = document.getElementById('nomeCliente').value;
    const telefone = document.getElementById('telefoneCliente').value;
    
    // Formatar a data de AAAA-MM-DD para DD/MM/AAAA
    const objetoData = new Date(data + 'T12:00:00'); // Prevenir problemas de fuso horário
    const dataFormatada = objetoData.toLocaleDateString('pt-BR');
    
    dadosAgendamentoTemporario = {
        servico: nomeDoServico,
        data: dataFormatada,
        hora: hora,
        nome: nome,
        telefone: telefone,
        pagamento: "",
        valor: configuracoesFabyNails.precos[nomeDoServico] || 0
    };
    
    finalizarAgendamento();
}

async function finalizarAgendamento() {
    // Exibir os dados na mensagem de sucesso
    document.getElementById('sucessoNomeServico').textContent = dadosAgendamentoTemporario.servico;
    document.getElementById('sucessoData').textContent = dadosAgendamentoTemporario.data;
    document.getElementById('sucessoHora').textContent = dadosAgendamentoTemporario.hora;
    
    // Esconder o formulário e mostrar a tela de sucesso
    formulario.style.display = 'none';
    mensagemSucesso.style.display = 'block';
    
    // Enviar para o servidor SQLite
    const partesData = dadosAgendamentoTemporario.data.split('/');
    const dataISO = `${partesData[2]}-${partesData[1]}-${partesData[0]}T${dadosAgendamentoTemporario.hora}`;
    
    const novoAgendamento = {
        cliente_nome: dadosAgendamentoTemporario.nome,
        cliente_telefone: dadosAgendamentoTemporario.telefone,
        servico: dadosAgendamentoTemporario.servico,
        valor: dadosAgendamentoTemporario.valor,
        data_hora: dataISO,
        forma_pagamento: 'Pendente',
        observacoes: document.getElementById('campoObservacoes')?.value || ''
    };
    
    const resultado = await apiFetch('/api/agendamentos', 'POST', novoAgendamento);
    if (resultado && !resultado.error) {
        console.log("Agendamento salvo no servidor:", resultado);
        atualizarListaClientesSelect();
    } else {
        alert(resultado?.error || "Desculpe, este horário acabou de ser ocupado. Por favor, escolha outro.");
        // Re-abre o formulário para correção
        formulario.style.display = 'block';
        mensagemSucesso.style.display = 'none';
    }
}

// Lógica do Modal de Administração (Ver Agenda)
const modalAdmin = document.getElementById('modalAdmin');
const listaAgendamentos = document.getElementById('listaAgendamentos');

function abrirModalAdmin() {
    modalAdmin.classList.add('ativo');
    document.body.style.overflow = 'hidden';
    carregarAgendamentos();
}

function fecharModalAdmin() {
    modalAdmin.classList.remove('ativo');
    document.body.style.overflow = '';
}

async function carregarAgendamentos() {
    listaAgendamentos.innerHTML = '<p class="texto-carregando">Carregando agendamentos...</p>';
    const agendamentos = await apiFetch('/api/agendamentos');
    
    listaAgendamentos.innerHTML = '';
    
    if (!agendamentos || agendamentos.length === 0) {
        listaAgendamentos.innerHTML = '<p class="texto-vazio">Nenhum agendamento encontrado.</p>';
        return;
    }
    
    agendamentos.forEach(agendamento => {
        const item = document.createElement('div');
        item.className = 'item-agendamento';
        
        const dataObjeto = new Date(agendamento.data_hora);
        const dataFormatada = dataObjeto.toLocaleDateString('pt-BR');
        const horaFormatada = agendamento.data_hora.split('T')[1]?.substring(0, 5) || "";

        item.innerHTML = `
            <div class="detalhes-agendamento">
                <h4>${agendamento.servico}</h4>
                <p><ion-icon name="person-outline"></ion-icon> ${agendamento.cliente_nome} | <ion-icon name="logo-whatsapp"></ion-icon> ${agendamento.cliente_telefone}</p>
                <p>📅 ${dataFormatada} às ${horaFormatada}</p>
                ${agendamento.observacoes ? `<p style="font-style: italic; color: #666; font-size: 0.9rem; margin-top: 5px;">📝 "${agendamento.observacoes}"</p>` : ''}
                <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem; color: var(--primaria-escura);">
                    <ion-icon name="wallet-outline"></ion-icon> 
                    <select onchange="atualizarPagamento(${agendamento.id}, this.value)" style="padding: 0.2rem; border-radius: 4px; border: 1px solid var(--primaria-clara); font-size: 0.85rem; outline: none; background: white;">
                        <option value="Pendente" ${agendamento.forma_pagamento === 'Pendente' ? 'selected' : ''}>Aguardando Pagamento</option>
                        <option value="Pix" ${agendamento.forma_pagamento === 'Pix' ? 'selected' : ''}>Pago no Pix</option>
                        <option value="Dinheiro" ${agendamento.forma_pagamento === 'Dinheiro' ? 'selected' : ''}>Pago em Dinheiro</option>
                    </select>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn-whatsapp" style="background-color: var(--primaria); color: white;" onclick="abrirPixAdmin(${agendamento.id}, '${agendamento.servico}')" title="Gerar QR Code Pix">
                    <ion-icon name="qr-code-outline"></ion-icon>
                </button>
                <button class="btn-whatsapp" onclick="enviarWhatsApp('${agendamento.cliente_telefone}', '${agendamento.cliente_nome.replace(/'/g, "\\'")}', '${agendamento.servico}', '${dataFormatada}', '${horaFormatada}')" title="Enviar lembrete pelo WhatsApp">
                    <ion-icon name="logo-whatsapp"></ion-icon>
                </button>
                <button class="btn-excluir" onclick="excluirAgendamento(${agendamento.id})" title="Excluir Agendamento">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
        `;
        listaAgendamentos.appendChild(item);
    });
}

function enviarWhatsApp(telefoneFormatado, nome, servico, data, hora) {
    let numeroLimpo = telefoneFormatado.replace(/\D/g, '');
    if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
        numeroLimpo = '55' + numeroLimpo;
    }
    const mensagem = `Olá ${nome}! Seu agendamento para *${servico}* no *Faby Nails* está confirmado para o dia *${data}* às *${hora}*. Estamos te esperando! 💅✨`;
    const url = `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

async function excluirAgendamento(id) {
    if (confirm('Deseja realmente excluir este agendamento?')) {
        await apiFetch(`/api/agendamentos/${id}`, 'DELETE');
        carregarAgendamentos();
    }
}

async function atualizarPagamento(id, valor) {
    await apiFetch(`/api/agendamentos/${id}/pagamento`, 'PUT', { forma_pagamento: valor });
    console.log(`Pagamento atualizado para ID ${id}: ${valor}`);
}

// Fechar modal de admin ao clicar fora
modalAdmin.addEventListener('click', function(evento) {
    if (evento.target === modalAdmin) {
        fecharModalAdmin();
    }
});

// Lógica do Modal de Clientes
const modalClientes = document.getElementById('modalClientes');
const listaClientesAdmin = document.getElementById('listaClientesAdmin');

function abrirModalClientes() {
    modalClientes.classList.add('ativo');
    document.body.style.overflow = 'hidden';
    carregarClientesAdmin();
}

function fecharModalClientes() {
    modalClientes.classList.remove('ativo');
    document.body.style.overflow = '';
}

async function carregarClientesAdmin() {
    listaClientesAdmin.innerHTML = '<p class="texto-carregando">Carregando clientes...</p>';
    const clientes = await apiFetch('/api/clientes');
    
    listaClientesAdmin.innerHTML = '';
    
    if (!clientes || clientes.length === 0) {
        listaClientesAdmin.innerHTML = '<p class="texto-vazio">Nenhum cliente cadastrado.</p>';
        return;
    }
    
    clientes.forEach(cliente => {
        const item = document.createElement('div');
        item.className = 'item-agendamento';
        item.innerHTML = `
            <div class="detalhes-agendamento">
                <h4>${cliente.nome}</h4>
                <p><ion-icon name="logo-whatsapp"></ion-icon> ${cliente.telefone}</p>
            </div>
            <button class="btn-excluir" onclick="excluirCliente(${cliente.id}, '${cliente.nome.replace(/'/g, "\\'")}')" title="Excluir Cliente">
                <ion-icon name="trash-outline"></ion-icon>
            </button>
        `;
        listaClientesAdmin.appendChild(item);
    });
}

async function excluirCliente(id, nomeDoCliente) {
    if(confirm(`Tem certeza que deseja excluir a cliente "${nomeDoCliente}"?`)) {
        await apiFetch(`/api/clientes/${id}`, 'DELETE');
        carregarClientesAdmin();
        atualizarListaClientesSelect();
    }
}

modalClientes.addEventListener('click', function(evento) {
    if (evento.target === modalClientes) {
        fecharModalClientes();
    }
});

// --- Lógica de Configurações ---
async function salvarConfiguracoes(evento) {
    evento.preventDefault();
    configuracoesFabyNails = {
        precos: {
            "Manicure & Pedicure": parseFloat(document.getElementById('precoManicure').value) || 0,
            "Depilação": parseFloat(document.getElementById('precoDepilacao').value) || 0,
            "Spa dos Pés": parseFloat(document.getElementById('precoSpa').value) || 0,
            "Sobrancelhas": parseFloat(document.getElementById('precoSobrancelhas').value) || 0
        },
        pix: {
            chave: document.getElementById('configChavePix').value,
            nome: document.getElementById('configNomePix').value,
            cidade: document.getElementById('configCidadePix').value
        }
    };
    
    await apiFetch('/api/configuracoes', 'POST', { chave: 'geral', valor: configuracoesFabyNails });
    alert('Configurações salvas com sucesso!');
    fecharModalConfiguracoes();
}

function abrirModalConfiguracoes() {
    document.getElementById('modalConfiguracoes').classList.add('ativo');
    document.body.style.overflow = 'hidden';
    
    document.getElementById('precoManicure').value = configuracoesFabyNails.precos["Manicure & Pedicure"];
    document.getElementById('precoDepilacao').value = configuracoesFabyNails.precos["Depilação"];
    document.getElementById('precoSpa').value = configuracoesFabyNails.precos["Spa dos Pés"];
    document.getElementById('precoSobrancelhas').value = configuracoesFabyNails.precos["Sobrancelhas"];
    
    document.getElementById('configChavePix').value = configuracoesFabyNails.pix.chave;
    document.getElementById('configNomePix').value = configuracoesFabyNails.pix.nome;
    document.getElementById('configCidadePix').value = configuracoesFabyNails.pix.cidade;
}

function fecharModalConfiguracoes() {
    document.getElementById('modalConfiguracoes').classList.remove('ativo');
    document.body.style.overflow = '';
}

document.getElementById('modalConfiguracoes').addEventListener('click', function(evento) {
    if (evento.target === document.getElementById('modalConfiguracoes')) {
        fecharModalConfiguracoes();
    }
});

// --- Gerador de Payload Pix (EMVCo) ---
function gerarPayloadPix(chave, valor, nome, cidade) {
    const formatSize = (str) => String(str.length).padStart(2, '0');
    
    const gui = "0014BR.GOV.BCB.PIX";
    const key = `01${formatSize(chave)}${chave}`;
    const merchantAccountInfo = `26${formatSize(gui + key)}${gui}${key}`;
    
    const merchantCategoryCode = "52040000";
    const transactionCurrency = "5303986";
    const transactionAmount = valor ? `54${formatSize(valor.toFixed(2))}${valor.toFixed(2)}` : "";
    const countryCode = "5802BR";
    
    const cleanName = (nome || "Nome").normalize("NFD").replace(/[^a-zA-Z0-9 ]/g, "").trim().substring(0, 25).toUpperCase();
    const cleanCity = (cidade || "Cidade").normalize("NFD").replace(/[^a-zA-Z0-9 ]/g, "").trim().substring(0, 15).toUpperCase();
    
    const merchantName = `59${formatSize(cleanName)}${cleanName}`;
    const merchantCity = `60${formatSize(cleanCity)}${cleanCity}`;
    
    const additionalDataField = `62070503***`;
    
    const payload = `000201${merchantAccountInfo}${merchantCategoryCode}${transactionCurrency}${transactionAmount}${countryCode}${merchantName}${merchantCity}${additionalDataField}6304`;
    
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
            crc &= 0xFFFF;
        }
    }
    const crcHex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    
    return payload + crcHex;
}

// --- Lógica de Relatórios ---
const modalRelatorios = document.getElementById('modalRelatorios');

function abrirModalRelatorios() {
    modalRelatorios.classList.add('ativo');
    document.body.style.overflow = 'hidden';
    
    const hoje = new Date();
    // Compensate for timezone to get correct local date string in YYYY-MM-DD
    hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
    const dataFormatada = hoje.toISOString().split('T')[0];
    document.getElementById('dataRelatorio').value = dataFormatada;
    
    gerarRelatorio();
}

function fecharModalRelatorios() {
    modalRelatorios.classList.remove('ativo');
    document.body.style.overflow = '';
}

async function gerarRelatorio() {
    const dataSelecionadaISO = document.getElementById('dataRelatorio').value;
    if (!dataSelecionadaISO) return;
    
    // Lê do banco de dados do servidor
    const agendamentosDia = await apiFetch(`/api/relatorios/${dataSelecionadaISO}`);
    const listaRelatorio = document.getElementById('listaRelatorio');
    const elementoTotal = document.getElementById('totalRelatorio');
    
    listaRelatorio.innerHTML = '';
    let totalDia = 0;
    
    if (!agendamentosDia || agendamentosDia.length === 0) {
        listaRelatorio.innerHTML = '<p class="texto-vazio" style="text-align: center; color: #666; padding: 1rem;">Nenhum serviço registrado neste dia.</p>';
        elementoTotal.textContent = 'R$ 0,00';
        return;
    }
    
    agendamentosDia.forEach(ag => {
        let valor = ag.valor || 0;
        let statusPagamento = ag.forma_pagamento || 'Pendente';
        let corPagamento = statusPagamento === 'Pix' ? '#10b981' : (statusPagamento === 'Dinheiro' ? '#f59e0b' : '#ef4444');

        totalDia += valor;
        
        const item = document.createElement('div');
        item.className = 'item-agendamento';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        
        item.innerHTML = `
            <div>
                <h4 style="margin-bottom: 0.2rem;">${ag.cliente_nome}</h4>
                <p style="font-size: 0.85rem; color: #666; margin-bottom: 0.3rem;"><ion-icon name="color-palette-outline"></ion-icon> ${ag.servico}</p>
                <span style="font-size: 0.75rem; background-color: ${corPagamento}20; color: ${corPagamento}; padding: 0.2rem 0.5rem; border-radius: 12px; font-weight: 500;">
                    ${statusPagamento}
                </span>
            </div>
            <div style="font-weight: 600; color: var(--texto); font-size: 1.1rem;">
                R$ ${valor.toFixed(2).replace('.', ',')}
            </div>
        `;
        listaRelatorio.appendChild(item);
    });
    
    elementoTotal.textContent = `R$ ${totalDia.toFixed(2).replace('.', ',')}`;
}

async function excluirDadosRelatorio() {
    const dataSelecionadaISO = document.getElementById('dataRelatorio').value;
    if (!dataSelecionadaISO) return;
    
    if (confirm(`Tem certeza que deseja excluir TODOS os registros de faturamento do dia ${dataSelecionadaISO}?\n\nEsta ação apagará o histórico deste relatório. Isso não poderá ser desfeito.`)) {
        await apiFetch(`/api/relatorios/${dataSelecionadaISO}`, 'DELETE');
        gerarRelatorio();
        alert('Registros do relatório deste dia foram excluídos com sucesso.');
    }
}

document.getElementById('modalRelatorios').addEventListener('click', function(evento) {
    if (evento.target === document.getElementById('modalRelatorios')) {
        fecharModalRelatorios();
    }
});

// --- Lógica do Pix Admin ---
function abrirPixAdmin(id, servico) {
    const valor = configuracoesFabyNails.precos[servico] || 0;
    document.getElementById('valorPixAdmin').textContent = `R$ ${valor.toFixed(2).replace('.', ',')}`;
    
    const payload = gerarPayloadPix(
        configuracoesFabyNails.pix.chave, 
        valor, 
        configuracoesFabyNails.pix.nome, 
        configuracoesFabyNails.pix.cidade
    );
    document.getElementById('imagemQrCodeAdmin').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;
    
    document.getElementById('modalPixAdmin').classList.add('ativo');
}

function fecharModalPixAdmin() {
    document.getElementById('modalPixAdmin').classList.remove('ativo');
}

document.getElementById('modalPixAdmin').addEventListener('click', function(evento) {
    if (evento.target === document.getElementById('modalPixAdmin')) {
        fecharModalPixAdmin();
    }
});

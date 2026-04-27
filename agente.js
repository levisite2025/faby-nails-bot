const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Banco de Dados ---
const dbPath = path.join(__dirname, 'fabynails.db');
const db = new sqlite3.Database(dbPath);

// --- Memória Temporária de Sessão ---
const sessoes = {};

// --- Configurações do Bot (JSON) ---
const configBot = require('./config_bot.json');
const SERVICOS = configBot.servicos;
const MENSAGENS = configBot.mensagens;

async function processarMensagemBot(mensagem, numeroTelefone) {
    const texto = mensagem.trim().toLowerCase();
    
    if (!sessoes[numeroTelefone]) {
        sessoes[numeroTelefone] = { estado: 'INICIO' };
    }

    const sessao = sessoes[numeroTelefone];

    // Comando de retorno
    if (texto === 'menu' || texto === 'sair' || texto === '0') {
        sessao.estado = 'INICIO';
        return `Certinho! Voltamos ao início. 🌸\n\nComo posso te ajudar agora? ✨\n\n1️⃣ - Agendar um Horário 💅\n2️⃣ - Ver Serviços e Preços 💰`;
    }

    switch (sessao.estado) {
        case 'INICIO':
            sessao.estado = 'ESCOLHA_MENU';
            const horaAtual = new Date().getHours();
            let saudacao = "Olá";
            if (horaAtual >= 5 && horaAtual < 12) saudacao = "Bom dia";
            else if (horaAtual >= 12 && horaAtual < 18) saudacao = "Boa tarde";
            else saudacao = "Boa noite";

            return `${saudacao}! Bem-vinda à *Faby Nails*. ✨\nComo posso ajudar?\n\n1️⃣ - Agendar 📅\n2️⃣ - Preços 💰`;

        case 'ESCOLHA_MENU':
            if (texto === '1') {
                sessao.estado = 'PEDIR_NOME';
                return MENSAGENS.pedir_nome;
            } else if (texto === '2') {
                let lista = `Claro! Veja nossa tabela de serviços preparados com muito carinho para você: 💰🌸\n\n`;
                for (let id in SERVICOS) {
                    lista += `*${id}* - ${SERVICOS[id].nome}: _R$ ${SERVICOS[id].preco}_\n`;
                }
                lista += `\nQual desses te interessou hoje? ✨\n\nDigite *1* para iniciar o agendamento ou *0* para voltar ao menu principal.`;
                return lista;
            } else {
                return `Ops, não consegui identificar essa opção... 🤔\n\nPor favor, escolha:\n1️⃣ para *Agendar*\n2️⃣ para *Ver Preços*\n\nQual você prefere? ✨`;
            }

        case 'PEDIR_NOME':
            sessao.nome = mensagem;
            sessao.estado = 'PEDIR_SERVICO';
            let menuServicos = MENSAGENS.satisfacao_conhecer.replace('{nome}', mensagem.split(' ')[0]);
            for (let id in SERVICOS) {
                menuServicos += `*${id}* ➔ ${SERVICOS[id].nome}\n`;
            }
            return menuServicos;

        case 'PEDIR_SERVICO':
            if (SERVICOS[texto]) {
                sessao.servicoId = texto;
                sessao.servicoNome = SERVICOS[texto].nome;
                sessao.valor = SERVICOS[texto].preco;
                sessao.estado = 'PEDIR_DATA';
                return `Amo essa escolha! *${sessao.servicoNome}* fica maravilhoso. 😍✅\n\nPara qual *dia* você deseja agendar? (Ex: 27/04) 📅`;
            } else {
                return `Por favor, escolha um dos números da nossa lista de serviços (1 a 10). Qual vamos fazer hoje? 💅🌸`;
            }

        case 'PEDIR_DATA':
            sessao.data = mensagem;
            sessao.estado = 'PEDIR_HORA';
            return `Perfeito, anotado! 📅\n\nE qual o melhor *horário* para você vir brilhar aqui conosco? (Ex: 14:00) 🕒✨`;

        case 'PEDIR_HORA':
            sessao.hora = mensagem;
            sessao.estado = 'CONFIRMACAO';
            return `Quase tudo pronto! ✨ Só me confirme se os dados abaixo estão certinhos:\n\n📌 *RESUMO DO SEU MOMENTO:*\n👤 *Cliente:* ${sessao.nome}\n💅 *Serviço:* ${sessao.servicoNome}\n📅 *Data:* ${sessao.data}\n🕒 *Hora:* ${sessao.hora}\n💰 *Valor:* R$ ${sessao.valor}\n\nEstá tudo correto? Digite *SIM* para confirmar ou *0* para alterar algo. 🥰🌸`;

        case 'CONFIRMACAO':
            if (texto.includes('sim') || texto === 'confirmar' || texto === 's') {
                // Tenta formatar a data para o padrão do site (AAAA-MM-DD)
                const hoje = new Date();
                let dataParaBanco = hoje.toISOString().split('T')[0]; 
                
                // Limpeza inteligente da Data (remove letras, espaços, etc)
                let dataLimpa = sessao.data.replace(/[^0-9/]/g, ''); 
                if (dataLimpa.includes('/')) {
                    const partes = dataLimpa.split('/');
                    const dia = partes[0].padStart(2, '0');
                    const mes = partes[1].padStart(2, '0');
                    dataParaBanco = `2026-${mes}-${dia}`;
                }

                // Limpeza inteligente da Hora (remove "às", "horas", espaços)
                let horaLimpa = sessao.hora.toLowerCase().replace('h', ':').replace(/[^0-9:]/g, '');
                if (!horaLimpa.includes(':')) {
                    horaLimpa = horaLimpa + ':00';
                }
                const partesHora = horaLimpa.split(':');
                const horaFinal = `${partesHora[0].padStart(2, '0')}:${(partesHora[1] || '00').padStart(2, '0')}`;

                const dataHoraBanco = `${dataParaBanco}T${horaFinal}`;
                console.log(`[LIMPEZA] Original: ${sessao.data} ${sessao.hora} -> Final: ${dataHoraBanco}`);

                db.run('INSERT INTO agendamentos (cliente_nome, cliente_telefone, servico, valor, data_hora, forma_pagamento, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [sessao.nome, numeroTelefone, sessao.servicoNome, sessao.valor, dataHoraBanco, 'WhatsApp', 'Agendado pelo Bot'],
                    function(err) {
                        if (err) console.error('❌ ERRO AO SALVAR NO BANCO:', err.message);
                        else console.log('✅ AGENDAMENTO SALVO COM SUCESSO NO BANCO!');
                    }
                );
                
                db.run('INSERT INTO relatorios (data, cliente_nome, servico, valor, forma_pagamento) VALUES (?, ?, ?, ?, ?)',
                    [dataParaBanco, sessao.nome, sessao.servicoNome, sessao.valor, 'Pendente'],
                    function(err) {
                        if (err) console.error('❌ ERRO AO SALVAR RELATÓRIO:', err.message);
                        else console.log('✅ RELATÓRIO SALVO COM SUCESSO!');
                    }
                );

                // NOVO: Salva o cliente na lista oficial de clientes se não existir
                db.get('SELECT id FROM clientes WHERE telefone = ?', [numeroTelefone], (err, row) => {
                    if (!row) {
                        db.run('INSERT INTO clientes (nome, telefone) VALUES (?, ?)', [sessao.nome, numeroTelefone], (err) => {
                            if (!err) console.log('✅ NOVO CLIENTE CADASTRADO AUTOMATICAMENTE!');
                        });
                    }
                });
                
                sessao.estado = 'INICIO';
                return `🎉 *PRONTINHO! SEU HORÁRIO ESTÁ RESERVADO!* 🎉\n\nEstamos muito ansiosos para te receber, ${sessao.nome.split(' ')[0]}! ✨\n\nTe esperamos dia ${sessao.data} às ${sessao.hora}.\n\nAté logo! 💅🌸🌸`;
            } else {
                return `Para confirmar e garantir sua vaga, digite *SIM*. Se precisar recomeçar, digite *0*. 🥰`;
            }

        default:
            sessao.estado = 'INICIO';
            return `Olá! Digite qualquer coisa para ver o menu. 💅`;
    }
}

function iniciarAgente() {
    console.log("Iniciando Super Bot Faby Nails (Sem API)...");
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: 'session-final' }),
        puppeteer: { args: ['--no-sandbox'] }
    });

    client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
    client.on('ready', () => console.log('¡Super Bot Faby Nails CONECTADO! 🚀'));
    
    client.on('message', async (msg) => {
        if (msg.from.endsWith('@c.us')) {
            const resposta = await processarMensagemBot(msg.body, msg.from.split('@')[0]);
            msg.reply(resposta);
        }
    });

    client.initialize();
}

module.exports = { iniciarAgente };

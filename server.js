require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { iniciarAgente, getQRCode } = require('./agente');

const app = express();
const PORT = process.env.PORT || 3000;

// Rota para o Frontend buscar o QR Code
app.get('/api/qrcode', (req, res) => {
    const qr = getQRCode();
    res.json({ qr: qr });
});

// Middleware
app.use(cors());
app.use(express.json());
// Servir arquivos estáticos (HTML, CSS, JS) da mesma pasta
app.use(express.static(path.join(__dirname)));

// Banco de dados
const db = new sqlite3.Database('./fabynails.db', (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        db.serialize(() => {
            // Tabela de Configurações
            db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chave TEXT UNIQUE,
                valor TEXT
            )`);

            // Tabela de Clientes
            db.run(`CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                telefone TEXT NOT NULL
            )`);

            // Tabela de Agendamentos (Agenda e Pagamento)
            db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_nome TEXT,
                cliente_telefone TEXT,
                servico TEXT,
                valor REAL,
                data_hora TEXT,
                forma_pagamento TEXT DEFAULT 'Pendente',
                observacoes TEXT
            )`);

            // Tabela de Relatórios (Histórico financeiro)
            db.run(`CREATE TABLE IF NOT EXISTS relatorios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT,
                cliente_nome TEXT,
                servico TEXT,
                valor REAL,
                forma_pagamento TEXT
            )`);
            
            console.log('Tabelas inicializadas com sucesso.');
        });
    }
});

// --- Rotas da API ---

// 1. Configurações
app.get('/api/configuracoes', (req, res) => {
    db.all('SELECT chave, valor FROM configuracoes', [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar configurações:', err.message);
            return res.status(500).json({ error: err.message });
        }
        const config = {};
        rows.forEach(row => { 
            try {
                config[row.chave] = JSON.parse(row.valor); 
            } catch (e) {
                config[row.chave] = row.valor;
            }
        });
        res.json(config);
    });
});

app.post('/api/configuracoes', (req, res) => {
    const { chave, valor } = req.body;
    console.log(`Atualizando configuração: ${chave}`);
    const stmt = db.prepare(`INSERT INTO configuracoes (chave, valor) VALUES (?, ?) 
                             ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor`);
    stmt.run([chave, JSON.stringify(valor)], function(err) {
        if (err) {
            console.error('Erro ao salvar configuração:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
    stmt.finalize();
});

// 2. Clientes
app.get('/api/clientes', (req, res) => {
    db.all('SELECT * FROM clientes', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/clientes', (req, res) => {
    const { nome, telefone } = req.body;
    console.log(`Cadastrando cliente: ${nome}`);
    const stmt = db.prepare('INSERT INTO clientes (nome, telefone) VALUES (?, ?)');
    stmt.run([nome, telefone], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, nome, telefone });
    });
    stmt.finalize();
});

app.delete('/api/clientes/:id', (req, res) => {
    const stmt = db.prepare('DELETE FROM clientes WHERE id = ?');
    stmt.run([req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
    stmt.finalize();
});

// 3. Agendamentos
app.get('/api/agendamentos', (req, res) => {
    db.all('SELECT * FROM agendamentos ORDER BY data_hora DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/agendamentos', (req, res) => {
    const { cliente_nome, cliente_telefone, servico, valor, data_hora, forma_pagamento, observacoes } = req.body;
    
    // Verificação de segurança: Horário já ocupado?
    db.get('SELECT id FROM agendamentos WHERE data_hora = ?', [data_hora], (err, row) => {
        if (row) {
            return res.status(400).json({ error: 'Este horário já está ocupado por outra cliente.' });
        }

        console.log(`Novo agendamento: ${cliente_nome} - ${servico}`);
        const stmt = db.prepare('INSERT INTO agendamentos (cliente_nome, cliente_telefone, servico, valor, data_hora, forma_pagamento, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)');
        stmt.run([cliente_nome, cliente_telefone, servico, valor, data_hora, forma_pagamento || 'Pendente', observacoes || ''], function(err) {
        if (err) {
            console.error('Erro ao criar agendamento:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        const idAgendamento = this.lastID;
        
        // Adiciona ao relatório também
        const dataOnly = data_hora.split('T')[0] || new Date().toISOString().split('T')[0];
        db.run('INSERT INTO relatorios (data, cliente_nome, servico, valor, forma_pagamento) VALUES (?, ?, ?, ?, ?)',
            [dataOnly, cliente_nome, servico, valor, forma_pagamento || 'Pendente'],
            (err) => {
                if (err) console.error('Erro ao adicionar ao relatório:', err.message);
            }
        );

        // Verifica se o cliente já existe, se não, cadastra
        db.get('SELECT id FROM clientes WHERE nome = ? AND telefone = ?', [cliente_nome, cliente_telefone], (err, row) => {
            if (!row) {
                db.run('INSERT INTO clientes (nome, telefone) VALUES (?, ?)', [cliente_nome, cliente_telefone]);
            }
        });

        res.json({ id: idAgendamento });
        });
        stmt.finalize();
    });
});

app.put('/api/agendamentos/:id/pagamento', (req, res) => {
    const { forma_pagamento } = req.body;
    console.log(`Atualizando pagamento ID ${req.params.id} para: ${forma_pagamento}`);
    const stmt = db.prepare('UPDATE agendamentos SET forma_pagamento = ? WHERE id = ?');
    stmt.run([forma_pagamento, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Atualiza relatório
        db.get('SELECT * FROM agendamentos WHERE id = ?', [req.params.id], (err, row) => {
            if (row) {
                const dataOnly = row.data_hora.split('T')[0];
                db.run('UPDATE relatorios SET forma_pagamento = ? WHERE data = ? AND cliente_nome = ? AND servico = ?',
                    [forma_pagamento, dataOnly, row.cliente_nome, row.servico]);
            }
        });

        res.json({ success: true });
    });
    stmt.finalize();
});

app.delete('/api/agendamentos/:id', (req, res) => {
    const stmt = db.prepare('DELETE FROM agendamentos WHERE id = ?');
    stmt.run([req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
    stmt.finalize();
});

// 4. Relatórios
app.get('/api/relatorios/:data', (req, res) => {
    db.all('SELECT * FROM relatorios WHERE data = ?', [req.params.data], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/api/relatorios/:data', (req, res) => {
    const stmt = db.prepare('DELETE FROM relatorios WHERE data = ?');
    stmt.run([req.params.data], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deleted: this.changes });
    });
    stmt.finalize();
});

// Inicialização
app.listen(PORT, () => {
    console.log(`\n================================================`);
    console.log(`Servidor Faby Nails rodando na porta ${PORT}`);
    console.log(`Acesse http://localhost:${PORT} no seu navegador.`);
    console.log(`================================================\n`);
    
    // Iniciar o Agente de IA do WhatsApp
    iniciarAgente();
});

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./fabynails.db');

const novosDados = {
    precos: {
        "Manicure & Pedicure": 75.00,
        "Apenas Mão": 40.00,
        "Apenas Pé": 45.00,
        "Esmaltação em Gel": 60.00,
        "Alongamento de Unhas": 150.00,
        "Sobrancelha com Henna": 55.00,
        "Sobrancelha Simples": 35.00,
        "Depilação Completa": 120.00,
        "Depilação Buço": 20.00,
        "Spa dos Pés": 50.00
    },
    pix: {
        chave: "+5511999999999",
        nome: "Faby Nails",
        cidade: "Sao Paulo"
    }
};

db.run(`UPDATE configuracoes SET valor = ? WHERE chave = 'geral'`, [JSON.stringify(novosDados)], function(err) {
    if (err) console.error(err);
    else console.log("Banco de dados atualizado com todos os serviços!");
    db.close();
});

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./fabynails.db');

db.serialize(() => {
    console.log("--- CONFIGURACOES ---");
    db.all("SELECT * FROM configuracoes", [], (err, rows) => {
        rows.forEach(row => console.log(row.chave, row.valor));
        
        console.log("\n--- SERVICOS NOS AGENDAMENTOS ---");
        db.all("SELECT DISTINCT servico FROM agendamentos", [], (err, rows) => {
            rows.forEach(row => console.log(row.servico));
            db.close();
        });
    });
});

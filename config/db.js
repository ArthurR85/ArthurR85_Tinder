const mysql = require ('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'start123',
    database: 'ArthurR85_Tinder',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    host: '127.0.0.1'
});

module.exports = pool.promise();
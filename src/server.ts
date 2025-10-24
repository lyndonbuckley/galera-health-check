import {createPool} from "mariadb";

const pool = createPool({
    host: process.env.DB_HOST  || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    connectionLimit: 5,
    connectTimeout: 1000,
    acquireTimeout: 1000,
});

async function main() {
    let conn;
    try {

        conn = await pool.getConnection();
        const rows = await conn.query("SHOW STATUS LIKE 'wsrep_%'");
        // rows: [ {val: 1}, meta: ... ]

        console.log(rows);

    } finally {
        if (conn) conn.release(); //release to pool
    }
}

main().catch(console.error);
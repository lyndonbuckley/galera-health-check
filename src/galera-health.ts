import {createPool} from "mariadb";
import {createServer} from "http";

const pool = createPool({
    host: process.env.DB_HOST  || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    connectionLimit: 5,
    connectTimeout: 1000,
    acquireTimeout: 1000,
    queryTimeout: 1000,
});

const port: number = (() => {
    if (process.env.DB_HEALTH_PORT && Number(process.env.DB_HEALTH_PORT))
        return Number(process.env.DB_HEALTH_PORT);

    return 3308;
})();

async function getStatus() {
    const status: {[key: string]: string} = {};
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SHOW STATUS LIKE 'wsrep_%'");
        for (const row of rows) {
            const name: string | null = row['Variable_name']??null;
            const value = row['Value']??null;
            if (name && value)
                status[name.substring(6)] = value;
        }
    } finally {
        if (conn) conn.release();
        return status;
    }
}

const server = createServer(async(req, res) => {
    console.log(new Date(),req.method, req.url);
    if (req.method !== "GET") {
        res.writeHead(400, {"Content-Type": "text/plain"});
        return res.end("Bad Request");
    }

    if (req.url !== "/galera") {
        res.writeHead(404, {"Content-Type": "text/plain"});;
        return res.end("Not Found");
    }

    const status = await getStatus();

    const healthy: boolean = (()=>{
        if (status.local_state_comment !== 'Synced') return false;
        if (status.cluster_status !== 'Primary') return false;
        if (status.connected !== 'ON') return false;
        return status.ready === 'ON';
    })();

    res.writeHead(healthy ? 200 : 503, {"Content-Type": "text/plain"});
    return res.end(JSON.stringify(status, null, 2));
});

server.listen(port,()=>{
    console.log(`Server listening on port ${port}`);
});
server.on("error", (err) => {
    console.error(err);
});
import {fork} from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, 'server', 'server.js');
const ports = [3000, 3001, 3002];
const activeProcesses = new Map();


//creates a new server child and restarts if crashes occur
function launchServer(port){
    console.log(`[Master] launching game on port ${port}`);
    const child = fork(serverPath, [port.toString()], {
        execArgv: ['--no-warnings']
    });
    activeProcesses.set(port, child);
    child.on('exit', (code, signal) => {
        console.error(`[Master] server on port ${port} exited with error code ${code}`);
        setTimeout(() => launchServer(port), 2000);
    });
}

ports.forEach((port) => {
    launchServer(port);
})

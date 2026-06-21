import {WebSocketServer} from 'ws';
import {createServer} from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {Player} from './entity/player.js';
import { handleAdminCommand } from './commands.js';

class gameWorld{
    //initialize the map and entity ids
    constructor(){
        this.entities = new Map();
        this.nextId = 1;
    }

    //proccesses every existing entity
    tick(){
        for(const entity of this.entities.values()){
            entity.update();
        }
    }

    //creating arrayBuffer to send data to clients
    createSnapshotBuffer() {
        const entitySize = 28;
        const bufferSize = 2 + (this.entities.size *entitySize);
        const buffer = new ArrayBuffer(bufferSize);
        const view = new DataView(buffer);
        view.setUint16(0, this.entities.size);
        let offset = 2;
        for (const entity of this.entities.values()) {
            offset = entity.pack(view, offset);
        }
        return buffer;
    }
}

const world = new gameWorld();




const args = process.argv.slice(2);
const servPort = args[0] ? parseInt(args[0]) : 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicFolder = path.join(__dirname, '..');

const httpServer = createServer((req, res) => {
    let filePath = path.join(publicFolder, req.url === '/' ? 'index.html' : req.url);
    let contentType = 'text/html';
    if(path.extname(filePath) === '.js') contentType = 'application/javascript';
    fs.readFile(filePath, (err, content) => {
        if(err){
            res.writeHead(404, {'Content-Type': 'text/plain'});
        }
        else{
            res.writeHead(200, {'Content-Type': contentType});
            res.end(content, 'utf-8');
        }
    })
})


const wss = new WebSocketServer({server:httpServer});
httpServer.listen(servPort, () => {
    console.log(`Game server ${process.pid} running on port ${servPort}`);
})


//websocket stuff
wss.on('connection', (ws) => {
    ws.binaryType = 'arraybuffer';
    //creates a new player and links it to the specific websocket
    const newPlayerId = world.nextId++;
    const playerInstance = new Player(newPlayerId, 400, 300, "user_" + newPlayerId);
    world.entities.set(newPlayerId, playerInstance);
    ws.player = playerInstance


    //instantly sends first packet as player's own ID so they can center the world upon themselves
    const initBuffer = new ArrayBuffer(3);
    const initView = new DataView(initBuffer);
    initView.setUint8(0, 0);
    initView.setUint16(1, newPlayerId);
    ws.send(initBuffer);

    world.entities.forEach((existingEntity) => {
        if (existingEntity.type === 'player' && existingEntity.name) {
            const encoder = new TextEncoder();
            const nameBytes = encoder.encode(existingEntity.name);
            const syncPacket = new Uint8Array(1 + 2 + nameBytes.length);
            syncPacket[0] = 4;
            const syncView = new DataView(syncPacket.buffer);
            syncView.setUint16(1, existingEntity.id);
            syncPacket.set(nameBytes, 3);
            ws.send(syncPacket.buffer);
        }
    });

    //registers all player inputs
    ws.on('message', (message) => {
        const view = new DataView(message);
        const command = view.getUint8(0);
        //gets wasd input (command 1)
        if(command === 1){
            ws.player.inputs.w = view.getUint8(1) === 1;
            ws.player.inputs.a = view.getUint8(2) === 1;
            ws.player.inputs.s = view.getUint8(3) === 1;
            ws.player.inputs.d = view.getUint8(4) === 1;
        }
        //Grabs username from player start menu (command 2)
        if(command===2){
            const decoder = new TextDecoder('utf-8');
            const nameString = decoder.decode(new Uint8Array(message.slice(1)));
            ws.player.name = nameString.trim() || "...";

            const encoder = new TextEncoder();
            const nameBytes = encoder.encode(ws.player.name);
            
            const namePacket = new Uint8Array(1 + 2 + nameBytes.length);
            namePacket[0] = 4;
            
            const view = new DataView(namePacket.buffer);
            view.setUint16(1, ws.player.id);
            namePacket.set(nameBytes, 3); 
            
            wss.clients.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(namePacket.buffer);
                }
            });
        }

        if(command===3){
            const decoder = new TextDecoder('utf-8');
            const messageString = decoder.decode(new Uint8Array(message.slice(1))).trim();

            //handles commands
            if (messageString.startsWith('/')) {
                const commandHandled = handleAdminCommand(messageString, ws, world, wss);
                if (commandHandled) {
                    return;
                }
            }

            if(messageString.length>0&&messageString.length<=60){
                const senderName = ws.player.name || `Player ${ws.player.id}`;

                const encoder = new TextEncoder();
                const encodedText = encoder.encode(`${senderName}: ${messageString}`);

                const chatPacket = new Uint8Array(1+ encodedText.length);
                chatPacket[0] = 3;
                chatPacket.set(encodedText, 1);

                wss.clients.forEach((client) =>{
                    if(client.readyState===1){
                        client.send(chatPacket.buffer);
                    }
                })
            }
        }
    });


    //deletes players with closed websockets
    ws.on('close', () => {
        world.entities.delete(ws.player.id);
    });
});

setInterval(() => {
    world.tick();

    //create data buffer to send to all clients and ONLY send to ready clients
    const snapshot = world.createSnapshotBuffer();
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(snapshot);
        }
    });
}, 1000 / 20);//tickrate

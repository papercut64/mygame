const htmlCanvas = document.getElementById('game');
const app = new PIXI.Application();
const clientPort = window.location.port || '3000';
PIXI.Assets.load('https://fonts.googleapis.com/css2?family=Ubuntu:wght@700&display=swap').then(() => {
    return document.fonts.load('bold 14px Ubuntu');
}).then(() => {
    return app.init({
        canvas: htmlCanvas,
        resizeTo: window,
        background: '#d6d6d6',
        antialias: true
    });
}).then(() => {

    const worldContainer = new PIXI.Container();
    app.stage.addChild(worldContainer);

    // Background grid graphics
    const GRID_SIZE = 30;
    const gridGraphic = new PIXI.Graphics();
    gridGraphic.rect(0, 0, GRID_SIZE, GRID_SIZE);
    gridGraphic.stroke({width:1, color: 0xa3a3a3});
    const gridTexture = app.renderer.generateTexture(gridGraphic);

    const backgroundGrid = new PIXI.TilingSprite({
        texture: gridTexture,
        width: app.screen.width,
        height: app.screen.height
    });
    app.stage.addChildAt(backgroundGrid, 0);

    // Dynamic map limits
    const PLAYABLE_MAP_SIZE_X = 4000;
    const PLAYABLE_MAP_SIZE_Y = 4000;

    const voidOverlay = new PIXI.Container();
    worldContainer.addChild(voidOverlay);

    const shroud = new PIXI.Graphics();
    const SHROUD_DISTANCE = 20000;
    const shroudStyle = {color:0x000000, alpha:0.4};
    
    shroud.rect(-SHROUD_DISTANCE, -SHROUD_DISTANCE, PLAYABLE_MAP_SIZE_X + (SHROUD_DISTANCE * 2), SHROUD_DISTANCE);
    shroud.rect(-SHROUD_DISTANCE, PLAYABLE_MAP_SIZE_Y, PLAYABLE_MAP_SIZE_X + (SHROUD_DISTANCE * 2), SHROUD_DISTANCE);
    shroud.rect(-SHROUD_DISTANCE, 0, SHROUD_DISTANCE, PLAYABLE_MAP_SIZE_Y);
    shroud.rect(PLAYABLE_MAP_SIZE_X, 0, SHROUD_DISTANCE, PLAYABLE_MAP_SIZE_Y);    
    shroud.fill(shroudStyle);
    voidOverlay.addChild(shroud);

    const pixiEntities = new Map();
    const serverTargets = new Map();
    const playerNamesRegistry = new Map();
    const dyingEntities = new Set();

    let localPlayerId = null;
    let socket = null;
    let currentScore = 0;
    let debugMode = false;

    document.getElementById('play-button').addEventListener('click', () =>{
        const username = document.getElementById('username-input').value;
        const targetPort = document.getElementById('server-select').value;
        document.getElementById('menu-overlay').style.display = 'none';
        connectToGame(targetPort, username);
    });

    function connectToGame(port, name){
        socket = new WebSocket(`ws://${window.location.hostname}:${port}`);
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => {
            console.log(`Connected to WebSocket on port ${port} with name ${name}`);
            const encoder = new TextEncoder();
            const nameBytes = encoder.encode(name);
            const packet = new Uint8Array(1+nameBytes.length);
            packet[0] = 2;
            packet.set(nameBytes, 1);
            socket.send(packet.buffer);
        };
        socket.onmessage = (event) => {
            const buffer = event.data;
            const view = new DataView(buffer);

            if(buffer.byteLength===3){
                localPlayerId = view.getUint16(1);
                return;
            }

            if(view.getUint8(0)===3){
                const decoder = new TextDecoder('utf-8');
                const chatMessage = decoder.decode(new Uint8Array(buffer.slice(1)));
                const chatArea = document.getElementById('chat-area');
                const messageElement = document.createElement('div');
                messageElement.innerText = chatMessage;
                messageElement.style.padding = "2px 0";
                chatArea.appendChild(messageElement);
                setTimeout(() =>{messageElement.remove(); }, 8000);
                return;
            }

            //notification block
            if (view.getUint8(0) === 5) {
                const decoder = new TextDecoder('utf-8');
                const notificationText = decoder.decode(new Uint8Array(buffer.slice(1)));

                let container = document.getElementById('notification-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'notification-container';
                    document.body.appendChild(container);
                }

                const popup = document.createElement('div');
                popup.className = 'admin-popup';
                popup.innerText = notificationText;

                container.appendChild(popup);

                requestAnimationFrame(() => {
                    popup.classList.add('show');
                });

                setTimeout(() => {
                    popup.classList.add('fade');
                }, 4500);

                setTimeout(() => {
                    popup.classList.add('collapse');
                }, 4800);

                setTimeout(() => {
                    popup.remove();
                }, 5200);

                return;
            }

            //command 4 (register new usernames of people joining)
            if (view.getUint8(0) === 4) {
                const playerId = view.getUint16(1);
                const decoder = new TextDecoder('utf-8');
                const registeredName = decoder.decode(new Uint8Array(buffer.slice(3)));
                playerNamesRegistry.set(playerId, registeredName);
                if (pixiEntities.has(playerId)) {
                    const targetEntity = pixiEntities.get(playerId);
                    targetEntity.nameTag.text = registeredName;
                    targetEntity.nameTag.style.fontFamily = 'Ubuntu';
                }
                return;
            }

            const entityCount = view.getUint16(0);
            const activeIdsThisFrame = new Set();
            let offset = 2;
            const entitySize = 28; // Confirmed 28-byte architecture
            
            //main graphic logic block for entities and decoding arrayBuffers from the server
            for(let i=0;i<entityCount;i++){
                const id = view.getUint16(offset);
                const x = view.getFloat32(offset+2);
                const y = view.getFloat32(offset+6);
                const vx = view.getFloat32(offset+10);
                const vy = view.getFloat32(offset+14);
                const score = view.getFloat64(offset+18);
                const team = view.getUint16(offset+26);
                offset+= entitySize;
                activeIdsThisFrame.add(id);

                serverTargets.set(id, {x, y, score, team});

                if(id===localPlayerId){
                    currentScore = score;
                }

                if(!pixiEntities.has(id)){
                    const entityGroup = new PIXI.Container();

                    // math for basic player render
                    const baseCircle = new PIXI.Graphics();
                    entityGroup.addChild(baseCircle);

                    const realName = playerNamesRegistry.get(id) || `Player ${id}`;                    
                    const nameTag = new PIXI.Text({
                        text: realName,
                        style:{
                            fontFamily: 'Ubuntu',
                            fontSize: 14,
                            fill: 0xffffff,
                            align:'center',
                            fontWeight: 'bold',
                            stroke: { color: 0x111111, width: 4, join: 'round' }
                        }
                    });
                    nameTag.anchor.set(0.5);
                    nameTag.y = 35;
                    entityGroup.addChild(nameTag);

                    entityGroup.x = x;
                    entityGroup.y = y;

                    entityGroup.baseCircle = baseCircle;
                    entityGroup.nameTag = nameTag;

                    worldContainer.addChild(entityGroup);
                    pixiEntities.set(id, entityGroup);
                }   
            }
            for(const [id, entityGroup] of pixiEntities.entries()){
                if(!activeIdsThisFrame.has(id)){
                    pixiEntities.delete(id);
                    serverTargets.delete(id);

                    entityGroup.deathScale = entityGroup.scale.x || 1;

                    dyingEntities.add(entityGroup);
                }
            }
        };
    }

    // High FPS interpolation loop
    app.ticker.add((ticker) =>{
        
        const lerpFactor = 0.25*ticker.deltaTime;
        const logFovValue = Math.log(currentScore + 1);
        const baseFovExpansion = 0.00392 * Math.pow(logFovValue, 1.85) + 1.0;       
        const BASE_WIDTH = 1600*0.75 * baseFovExpansion;
        const BASE_HEIGHT = 900*0.75 * baseFovExpansion;

        let localUserTeam = localPlayerId;
        let localX = 0;
        let localY = 0;
        if(localPlayerId!==null&&serverTargets.has(localPlayerId)){
            localX = serverTargets.get(localPlayerId).x;
            localY = serverTargets.get(localPlayerId).y;
            localUserTeam = serverTargets.get(localPlayerId).team;
        }

        for(const[id, entityGroup] of pixiEntities.entries()){
            const target = serverTargets.get(id);
            if(target){
                entityGroup.x += (target.x - entityGroup.x) * Math.min(lerpFactor, 1);
                entityGroup.y += (target.y - entityGroup.y) * Math.min(lerpFactor, 1);

                const distanceX = Math.abs(entityGroup.x-localX);
                const distanceY = Math.abs(entityGroup.y-localY);

                const CULL_THRESHOLD = (BASE_WIDTH/2)+200;

                if(id !== localPlayerId && (distanceX>CULL_THRESHOLD||distanceY>CULL_THRESHOLD)){
                    entityGroup.visible = false;
                    continue;
                }
                else{
                    entityGroup.visible= true;
                }

                const baseName = playerNamesRegistry.get(id) || `Player ${id}`;
                if(debugMode){
                    entityGroup.nameTag.text = `${baseName} ID: ${id}`
                }
                else{
                    entityGroup.nameTag.text = baseName;
                }

                //const scoreMultiplierThreshold = 5;
                const logValue = Math.log(target.score + 1);
                const dynamicMultiplier = 0.00392 * Math.pow(logValue, 1.85) + 1.0;
                const BASE_RADIUS = 25;
                const calculatedRadius = BASE_RADIUS * dynamicMultiplier;

                const circleGraphic = entityGroup.baseCircle;
                circleGraphic.clear();

                let fillColor = 0xff0000;
                let strokeColor = 0x990000;

                if (id === localPlayerId) {
                    fillColor = 0x00bcff;
                    strokeColor = 0x0082b3;
                } else if (target.team === localUserTeam) {
                    fillColor = 0x00bcff;
                    strokeColor = 0x0082b3;
                }

                //changes radius based on score
                circleGraphic.circle(0, 0, calculatedRadius);
                circleGraphic.fill({ color: fillColor });
                circleGraphic.stroke({ width: 4, color: strokeColor, alignment: 1 });

                //scales name with tank
                entityGroup.nameTag.scale.set(dynamicMultiplier);
                entityGroup.nameTag.y = (calculatedRadius + 15 + (dynamicMultiplier * 2));
            }
        }

        const scaleX = app.screen.width / BASE_WIDTH;
        const scaleY = app.screen.height / BASE_HEIGHT;
        const globalScale = Math.max(scaleX, scaleY);
        
        worldContainer.scale.x = globalScale;
        worldContainer.scale.y = globalScale;

        if(localPlayerId!==null&&pixiEntities.has(localPlayerId)){
            const myTank = pixiEntities.get(localPlayerId);
            const screenCenterX = app.screen.width/2;
            const screenCenterY = app.screen.height/2;

            worldContainer.x = screenCenterX - (myTank.x * globalScale);
            worldContainer.y = screenCenterY - (myTank.y * globalScale);

            backgroundGrid.width = app.screen.width;
            backgroundGrid.height = app.screen.height;

            backgroundGrid.tilePosition.x = worldContainer.x;
            backgroundGrid.tilePosition.y = worldContainer.y;
            backgroundGrid.tileScale.set(globalScale);
        }

        //death pop animation
        for(const dyingGroup of dyingEntities){
            dyingGroup.deathScale += 0.05 * ticker.deltaTime;
            dyingGroup.scale.set(dyingGroup.deathScale);
            dyingGroup.alpha -=0.10*ticker.deltaTime;
            if(dyingGroup.alpha <=0){
                worldContainer.removeChild(dyingGroup);
                dyingGroup.destroy({children:true});
                dyingEntities.delete(dyingGroup);
            }
        }
    });

    //wasd controls
    const keysPressed = {w: 0, a: 0, s: 0, d: 0};
    function sendInputs() {
        if(!socket || socket.readyState !== WebSocket.OPEN) return;        
        const inputBuffer = new ArrayBuffer(5);
        const inputView = new DataView(inputBuffer);
        inputView.setUint8(0, 1); 
        inputView.setUint8(1, keysPressed.w);
        inputView.setUint8(2, keysPressed.a);
        inputView.setUint8(3, keysPressed.s);
        inputView.setUint8(4, keysPressed.d);

        socket.send(inputBuffer);
    }
    
    //debug mode
    window.addEventListener('keydown', (e) => {
        if (document.activeElement === document.getElementById('chat-input')) return;
        if (document.getElementById('menu-overlay').style.display !== 'none') return;
        if (e.key.toLowerCase() === 'm') {
            debugMode = !debugMode;
        }
    });

    window.addEventListener('keydown', (e) =>{
        if(e.key==='Enter'){
            if(document.getElementById('menu-overlay').style.display !== 'none') return;
            const chatInput = document.getElementById('chat-input');

            if(document.activeElement===chatInput){
                const text = chatInput.value.trim();
                if(text.length>0&&socket&&socket.readyState===WebSocket.OPEN){
                    const encoder = new TextEncoder();
                    const textBytes = encoder.encode(text);
                    const packet = new Uint8Array(1+textBytes.length);
                    packet[0] = 3;
                    packet.set(textBytes, 1);
                    socket.send(packet.buffer);
                }

                chatInput.value="";
                chatInput.style.visibility = "hidden";
                chatInput.blur();
            }
            else{
                chatInput.style.visibility = "visible";
                chatInput.focus();
                keysPressed.w = 0; keysPressed.a = 0; keysPressed.s=0; keysPressed.d=0;
                sendInputs();
            }
        }
    });


    window.addEventListener('keydown', (e) => {

        if(document.activeElement===document.getElementById('chat-input')) return;

        const key = e.key.toLowerCase();
        if(key in keysPressed && keysPressed[key] === 0){
            keysPressed[key] = 1;
            sendInputs();
        }
    });

    window.addEventListener('keyup', (e) => {

        if (document.activeElement === document.getElementById('chat-input')) return;

        const key = e.key.toLowerCase();
        if(key in keysPressed){
            keysPressed[key] = 0;
            sendInputs();
        }
    });
});
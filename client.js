const htmlCanvas = document.getElementById('game');
const app = new PIXI.Application();
const clientPort = window.location.port || '3000';
app.init({
    canvas: htmlCanvas,
    resizeTo: window,
    background: '#111111'
}).then(() =>  {

    
    const worldContainer = new PIXI.Container();
    app.stage.addChild(worldContainer);


    const pixiEntities = new Map();
    const serverTargets = new Map();

    let localPlayerId = null;

    const socket = new WebSocket(`ws://${window.location.hostname}:${clientPort}`);
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => {
        console.log(`Connected to WebSocket on port ${clientPort}`);
    }

    socket.onmessage = (event) => {
        //decrypts each server tick as data to render
        const buffer = event.data;
        const view = new DataView(buffer);

        if(buffer.byteLength===3){
            localPlayerId = view.getUint16(1);
            return;
        }

        const entityCount = view.getUint16(0);
        const activeIdsThisFrame = new Set();
        let offset = 2;
        const entitySize = 14;
        for(let i=0;i<entityCount;i++){
            const id = view.getUint16(offset);
            const x = view.getFloat32(offset+2);
            const y = view.getFloat32(offset+6);
            const vx = view.getFloat32(offset+10);
            offset+= entitySize;
            activeIdsThisFrame.add(id);

            serverTargets.set(id, {x, y});

            if(localPlayerId === null){
                localPlayerId = id;
            }

            //placeholder for later, renders self as green and others as blue
            if(!pixiEntities.has(id)){
                const circle = new PIXI.Graphics();
                circle.circle(0, 0, 15);

                if(id===localPlayerId){
                    circle.fill(0x00ff00);
                }else{
                    circle.fill(0x0000ff);
                }
                circle.x = x;
                circle.y = y;

                worldContainer.addChild(circle);
                pixiEntities.set(id, circle);
            }
            const pixiObject = pixiEntities.get(id);
        }
        for(const [id, pixiObject] of pixiEntities.entries()){
            if(!activeIdsThisFrame.has(id)){
                worldContainer.removeChild(pixiObject);
                pixiEntities.delete(id);
                serverTargets.delete(id);
            }
        }
    };

    //smoothing for higher fps
    app.ticker.add((ticker) =>{
        const lerpFactor = 0.25*ticker.deltaTime;

        for(const[id, pixiObject] of pixiEntities.entries()){
            const target = serverTargets.get(id);
            if(target){
                pixiObject.x += (target.x - pixiObject.x) * Math.min(lerpFactor, 1);
                pixiObject.y += (target.y - pixiObject.y) * Math.min(lerpFactor, 1);
            }
        }
        //centering renderer around player
        if(localPlayerId!==null&&pixiEntities.has(localPlayerId)){
            const myTank = pixiEntities.get(localPlayerId);
            const screenCenterX = app.screen.width/2;
            const screenCenterY = app.screen.height/2;
            worldContainer.x = screenCenterX - myTank.x;
            worldContainer.y = screenCenterY - myTank.y;
        }
    })

    const keysPressed = {w: 0, a: 0, s: 0, d: 0};
    function sendInputs() {
        if(socket.readyState !== WebSocket.OPEN) return;
        const inputBuffer = new ArrayBuffer(5);
        const inputView = new DataView(inputBuffer);
        inputView.setUint8(0, 1); // Command 1 = Input updates
        inputView.setUint8(1, keysPressed.w);
        inputView.setUint8(2, keysPressed.a);
        inputView.setUint8(3, keysPressed.s);
        inputView.setUint8(4, keysPressed.d);

        socket.send(inputBuffer);
    }

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if(key in keysPressed && keysPressed[key] === 0){
            keysPressed[key] = 1;
            sendInputs();
        }
    });
    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if(key in keysPressed){
            keysPressed[key] = 0;
            sendInputs();
        }
    })
});
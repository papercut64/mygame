export function handleAdminCommand(messageString, ws, world, wss){
    const args = messageString.trim().split(/\s+/);
    const commandName = args[0].toLowerCase();

    const getTargetEntity = (idStr) =>{
        const id = parseInt(idStr);
        if (isNaN(id)) return null;
        return world.entities.get(id);
    };

    switch(commandName){
        //team command
        case '/team':{
            const targetId = args[1];
            const teamNum = parseInt(args[2]);
            if(!targetId||isNaN(teamNum)){
                sendServerFeedback(ws, "System: Usage is /team (id) (team number)");
                return true;
            }
            const target = getTargetEntity(targetId);
            if(target){
                target.team = teamNum;
                sendServerFeedback(ws, `System: Set entity ID ${targetId}'s team to ${teamNum}`);
            }
            else{
                sendServerFeedback(ws, `System: entity ID ${targetId} not found`); 
            }
            return true;
        }

        //xp command
        case '/xp': {
            const targetId = args[1];
            const scoreAmt = parseInt(args[2]);
            if (!targetId || isNaN(scoreAmt)) {
                sendServerFeedback(ws, "System: Usage is /xp (id) (score)");
                return true;
            }
            const target = getTargetEntity(targetId);
            if (target) {
                target.score = Math.max(0, scoreAmt);
                sendServerFeedback(ws, `System: Set entity ${target.id}'s xp to ${target.score}`);
            } else {
                sendServerFeedback(ws, `System: entity ID ${targetId} not found.`);
            }
            return true;
        }

        //tp command
        case '/tp': {
            if (args.length === 1) {
                if (ws.player) {
                    sendServerFeedback(ws, "System: Usage is /tp (id) (x) (y)");
                }
                return true;
            }
            if (args.length === 2) {
                const target = getTargetEntity(args[1]);
                if (target && ws.player) {
                    target.x = ws.player.x;
                    target.y = ws.player.y;
                    target.vx = 0; target.vy = 0;
                    sendServerFeedback(ws, `System: Teleported ID ${target.id} to your location.`);
                } else {
                    sendServerFeedback(ws, "System: Target entity not found.");
                }
                return true;
            }
            if (args.length >= 4) {
                const target = getTargetEntity(args[1]);
                const absoluteX = parseFloat(args[2]);
                const absoluteY = parseFloat(args[3]);

                if (!target || isNaN(absoluteX) || isNaN(absoluteY)) {
                    sendServerFeedback(ws, "System: Invalid /tp structural parameters.");
                    return true;
                }
                target.x = Math.max(0, Math.min(4000, absoluteX));
                target.y = Math.max(0, Math.min(4000, absoluteY));
                target.vx = 0; target.vy = 0;
                sendServerFeedback(ws, `System: Teleported ID ${target.id} to (${target.x}, ${target.y})`);
                return true;
            }
            return true;
        }

        //kill command
        case '/kill': {
            const targetId = args[1];
            if (!targetId) {
                sendServerFeedback(ws, "System: Usage is /kill (player_id)");
                return true;
            }

            const target = getTargetEntity(targetId);
            if (target) {
                // Drop their score to 0 and reset positions to act as a respawn kill execution
                target.score = 0;
                target.x = 400;
                target.y = 300;
                target.vx = 0; target.vy = 0;
                
                // Alert the server chat log about the termination event
                broadcastServerSystemMessage(wss, `Notice: ID ${target.id} was terminated by an admin.`);
            } else {
                sendServerFeedback(ws, `System: ID ${targetId} not found.`);
            }
            return true;
        }
    }

    return false;
    

    //sends user of command feedback
    function sendServerFeedback(ws, messageText){
        if (ws.readyState===1){
            const encoder = new TextEncoder();
            const textBytes = encoder.encode(messageText);
            const packet = new Uint8Array(1+textBytes.length);
            packet[0]=5;
            packet.set(textBytes, 1);
            ws.send(packet.buffer);
        }
    }

    function broadcastServerSystemMessage(wss, messageText){
        const encoder = new TextEncoder();
        const textBytes = encoder.encode(messageText);
        const packet = new Uint8Array(1+textBytes.length);
        packet[0]=3;
        packet.set(textBytes, 1);

        wss.clients.forEach((client) =>{
            if(client.readyState===1){
                client.send(packet.buffer);
            }
        });
    }
}
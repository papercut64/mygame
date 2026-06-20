import {Entity} from './entity.js'
export class Player extends Entity{
    constructor(id, x, y, username){
        super(id, 'player', x, y, 15);
        this.username = username || "An unnamed tank";
        this.score = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.inputs = {w: false, a: false, s: false, d: false};
    }
    update(){
        const acceleration = 10;
        if(this.inputs.w) this.vy -= acceleration;
        if(this.inputs.s) this.vy += acceleration;
        if(this.inputs.a) this.vx -= acceleration;
        if(this.inputs.d) this.vx += acceleration;
        super.update();

    }

}
import {Entity} from './entity.js'
export class Player extends Entity{
    constructor(id, x, y, username){
        super(id, 'player', x, y, 15);
        this.username = username || "An unnamed tank";
        this.score = 0;
        this.team = id;
        this.health = 100;
        this.maxHealth = 100;
        this.inputs = {w: false, a: false, s: false, d: false};
    }
    update(){
        const baseAcceleration = 10;
        const logValue = Math.log(this.score + 1);
        const massFactor = 0.00392 * Math.pow(logValue, 1.85) + 1.0;
        const acceleration = baseAcceleration/massFactor;
        if(this.inputs.w) this.vy -= acceleration;
        if(this.inputs.s) this.vy += acceleration;
        if(this.inputs.a) this.vx -= acceleration;
        if(this.inputs.d) this.vx += acceleration;
        super.update();

    }

}
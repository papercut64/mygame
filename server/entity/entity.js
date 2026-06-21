export class Entity {
    constructor(id, type, x, y, radius){
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
        this.score = 0;
        this.team = id;
    }

    //basic physics loop
    update(){
        //movement
        this.x += this.vx;
        this.y += this.vy;
        //drag
        this.vx = this.vx*0.7;
        this.vy = this.vy*0.7;
    }

    pack(dataView, offset) {
        dataView.setUint16(offset, this.id);
        dataView.setFloat32(offset + 2, this.x);  
        dataView.setFloat32(offset + 6, this.y);  
        dataView.setFloat32(offset + 10, this.vx); 
        dataView.setFloat32(offset+14, this.vy);
        dataView.setFloat64(offset + 18, this.score);
        dataView.setUint16(offset+26, this.team);
        return offset + 28;
    }
}
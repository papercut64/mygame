const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let squareXoffset = 0;
let squareYoffset = 0;
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('keydown', (event) => {
    keyPressed = event.key.toLowerCase();
    switch (keyPressed){
        case 'w':
            squareYoffset -= 10;
            break;  
        case 's':
            squareYoffset += 10;
            break;
    }
    switch (keyPressed){
        case 'a':
            squareXoffset -= 10;
            break;  
        case 'd':
            squareXoffset += 10;
            break;
    }
    ctx.fillStyle = 'blue';
    ctx.fillRect(canvas.width*0.25+squareXoffset, canvas.height*0.25+squareYoffset, canvas.width*0.5, canvas.height*0.5);
    
});
resizeCanvas();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = 'blue';
    ctx.fillRect(50, 50, 100, 100);
}
window.addEventListener('resize', resizeCanvas);
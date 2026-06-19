addEventListener("keydown", function(event){
if (event.code == 'KeyD') vxr = 5;
if (event.code == 'KeyA') vxl = -5;
if (event.code == 'KeyS') vy = 5;
if (event.code == 'KeyW') vy = -5;
})

addEventListener("keyup", function(event){
if (event.code == 'KeyD') vxr = 0;
if (event.code == 'KeyA') vxl = 0;
if (event.code == 'KeyS') vy = 0;
if (event.code == 'KeyW') vy = 0;
})

/*
addEventListner("keydown", function(event){
if (event.code == 'ArrowLeft') vxr = 5;
if (event.code == 'ArrowRight') vxl = -5;
if (event.code == 'ArrowUp') vy = 5;
if (event.code == 'ArrowDown') vy = -5;
})

addEventListener("keyup", function(event){
if (event.code == 'ArrowLeft') vxr = 0;
if (event.code == 'ArrowRight') vxl = 0;
if (event.code == 'ArrowUp') vy = 0;
if (event.code == 'ArrowDown') vy = 0;
})


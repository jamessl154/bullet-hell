import './styles.css'

// using circular Projectile and CursorObject hitboxes to simplify collision detection and improve performance

let canvas
let ctx

const gameSettings = {
  totalTime: 0, // window loses focus but score ticks up https://developer.mozilla.org/en-US/docs/Web/API/Window/focus_event
  radialTurretNumber: 1, // increase turret number/maxProjectile number with duration/score
  aimedTurretNumber: 1,
  numRadialProjectiles: 10,
  numAimedProjectiles: 10,
  // fireInterval: 5000, // TODO
  reset() {
    this.aimedTurretNumber = 1
    this.radialTurretNumber = 1
    this.numRadialProjectiles = 10,
    this.numAimedProjectiles = 10,
    this.totalTime = 0
  }
}

const gameObjects = {
  radialTurrets: [],
  radialProjectiles: [],
  aimedTurrets: [],
  aimedProjectiles: [],
  reset() {
    this.radialTurrets = []
    this.radialProjectiles = []
    this.aimedTurrets = []
    this.aimedProjectiles = []
  }
}

const gameTimers = {
  elapsedMs: undefined,
  oldTimeStamp: 0,
  reset() {
    this.oldTimeStamp = 0
    this.elapsedMs = undefined
  }
}

const timeoutIDs = {
  gameLoopID: undefined,
  resizeTimeoutID: undefined,
  aimedTimeoutIDs: [],
  reset() {
    this.aimedTimeoutIDs.forEach((timeoutID) => {
      clearTimeout(timeoutID)
    })
    this.resizeTimeoutID = undefined
    this.gameLoopID = undefined
  }
}

const cursorObject = {
  x: 0,
  y: 0,
  radius: 0,
  init() {
    this.radius = canvas.height * 0.01
  },
  draw() {
    ctx.save()
    ctx.fillStyle = 'blue'
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
    ctx.fill()
    ctx.restore()
  },
  collidesWith(projectile) { // returns boolean based on whether cursorObject circle collision with object
    const dx = projectile.x - this.x
    const dy = projectile.y - this.y
    if (dx**2 + dy**2 < (this.radius + projectile.radius)**2) {
      return true
    }
    return false
  }
}

class Projectile {
  constructor(x, y, velX, velY) {
    this.x = x
    this.y = y
    this.velX = velX * (canvas.height + canvas.width) * 0.001 // add magnitude to the normalized vectors depending on canvas height and width
    this.velY = velY * (canvas.height + canvas.width) * 0.001
    this.radius = canvas.height * 0.003
  }

  draw() {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.fillStyle = this.colour
    ctx.beginPath()
    ctx.arc(0, 0, this.radius, 0, 2 * Math.PI)
    ctx.fill()
    ctx.restore()
  }

  update() {
    this.x += this.velX
    this.y += this.velY
  }
}

class RadialProjectile extends Projectile {
  constructor(x, y, velX, velY) {
    super(x, y, velX, velY)
    this.colour = 'green'
  }
}

class AimedProjectile extends Projectile {
  constructor(x, y, velX, velY) {
    super(x, y, velX, velY)
    this.colour = 'orange'
  }
}

class Turret {
  constructor() {
    this.velX = 0
    this.fireTimeoutID = undefined
  }

  draw() {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.fillStyle = this.colour
    ctx.beginPath()
    ctx.arc(0, 0, this.radius, 0, 2 * Math.PI)
    ctx.fill()
    ctx.restore()
  }

  update() {
    this.y += this.velY

    if (this.y > canvas.height + this.radius) { // OOB reset turret to top of screen
      this.x = Math.random() * canvas.width
      this.y = -this.radius
      this.velY = this.randomYVelocity
    }
  }
}

class RadialTurret extends Turret {
  constructor() {
    super()
    this.colour = 'red'
    this.radius = canvas.height * 0.02
    this.x = this.radius + Math.random() * (canvas.width - 2 * this.radius) // always starts with its full diameter inside the viewport
    this.y = 0 // could spawn randomly distributed above y = 0
    this.velY = canvas.height * (Math.random() * 0.001 + 0.001) // velocity varying between 0.1 to 0.2 % of canvas height
    this.randomYVelocity = this.velY
  }

  #fireRadial() { // fires evenly spaced projectiles emitted from the centre of each turret
    for (let i=0; i < gameSettings.numRadialProjectiles; i++) {
      const slice = 2 * Math.PI / gameSettings.numRadialProjectiles;
      const angle = slice * i;
      // assigns vectors that evenly distributes each radialProjectile around the unit circle
      gameObjects.radialProjectiles.push(new RadialProjectile(this.x, this.y, Math.sin(angle), Math.cos(angle)))
    }
  }

  fireRadialOnce() { // debounce calling turret.fireRadial() binding current Turret instance as the context
    if (this.fireTimeoutID) clearTimeout(this.fireTimeoutID)
    this.fireTimeoutID = setTimeout(this.#fireRadial.bind(this), 100)
  }
}

class AimedTurret extends Turret {
  constructor() {
    super()
    this.colour = 'yellow'
    this.radius = canvas.height * 0.02
    this.x = this.radius + Math.random() * (canvas.width - 2 * this.radius)
    this.y = 0
    this.velY = canvas.height * (Math.random() * 0.0005 + 0.0005) // velocity varying between 0.05 to 0.1 % of canvas height
    this.randomYVelocity = this.velY
  }

  #fireAimed() { // fires aimed projectiles
    const dist = Math.sqrt((this.x - cursorObject.x)**2 + (this.y - cursorObject.y)**2)
    const velX = (cursorObject.x - this.x) / dist // normalized vectors pointing from the turret to the cursor
    const velY = (cursorObject.y - this.y) / dist
    // increase magnitude of vector with difficulty?
    gameObjects.aimedProjectiles.push(new AimedProjectile(this.x, this.y, velX, velY))
  }

  #fireAimedInterval() { // calls #fireAimed at 0.1s interval for total numAimedProjectiles
    let aimedTimeoutID
    for (let i=0; i < gameSettings.numAimedProjectiles; i++) {

      aimedTimeoutID = setTimeout(this.#fireAimed.bind(this), i * 100)

      // store the ID of each setTimeout in array, allowing us to clearTimeout on all of them if there are setTimeouts pending when the game ends
      timeoutIDs.aimedTimeoutIDs.push(aimedTimeoutID)
      if (timeoutIDs.aimedTimeoutIDs.length > gameSettings.numAimedProjectiles) timeoutIDs.aimedTimeoutIDs.shift()
    }
  }

  fireAimedOnce() { // debounces the calls to fire from gameLoop to this turret
    if (this.fireTimeoutID) clearTimeout(this.fireTimeoutID)
    this.fireTimeoutID = setTimeout(this.#fireAimedInterval.bind(this), 100)
  }
}

window.onload = init

window.onresize = function() {
  // debounce resize event. End the current gameLoop, reset the game settings for the next gameLoop and call init
  clearTimeout(timeoutIDs.resizeTimeoutID)
  timeoutIDs.resizeTimeoutID = setTimeout(function() {
    endGame()
    resetGame()
    init()
  }, 100)
}

window.onmousemove = function(e) {
  cursorObject.x = e.x
  cursorObject.y = e.y
}

function init() {
  canvas = document.getElementById('canvas1')
  ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  cursorObject.init() // cursorObject size is responsive to canvas height
  
  ctx.font = `${canvas.width * 0.02}px Arial`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'white'
  ctx.strokeStyle = 'white'

  startMenu()
}

function startMenu() {
  const menuText = 'PRESS SPACE TO START'

  ctx.save()
  ctx.translate(canvas.width/2, canvas.height/2)
  ctx.fillText(menuText, 0, 0)
  ctx.restore()

  document.addEventListener('keydown', spaceBarListener)
}

function spaceBarListener(e) {
  if (e.key === ' ') {
    startGame()
  }
}

function startGame() {
  document.removeEventListener('keydown', spaceBarListener)

  cursorObject.x = canvas.width/2
  cursorObject.y = canvas.height/2

  for (let i=0; i < gameSettings.radialTurretNumber; i++) {
    gameObjects.radialTurrets.push(new RadialTurret())
  }
  
  for (let i=0; i < gameSettings.aimedTurretNumber; i++) {
    gameObjects.aimedTurrets.push(new AimedTurret())
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame#parameters
  gameTimers.oldTimeStamp = performance.now() // returns DOMHighResTimeStamp which is the same format as the timeStamp passed to the callback of RequestAnimationFrame, gameLoop in this case

  gameLoop(gameTimers.oldTimeStamp) // specify the first timestamp passed to gameLoop. Passing performance.now() means elapsedMs always starts from 0
}

function endGame() {
  cancelAnimationFrame(timeoutIDs.gameLoopID)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function resetGame() {
  gameObjects.reset()
  gameSettings.reset()
  timeoutIDs.reset()
  gameTimers.reset()
}

function drawScore() {
  const seconds = Math.round(gameSettings.totalTime/1000)
  ctx.save()
  ctx.fillStyle = 'white'
  ctx.translate(canvas.width * 0.1, canvas.height * 0.1) // score is time in seconds alive
  ctx.fillText(seconds, 0, 0)
  ctx.restore()
}

function gameLoop(timeStamp) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // ctx.save()
  // ctx.fillStyle = 'rgba(0, 0, 0, 0.3)' // cheap trail effect
  // ctx.fillRect(0, 0, canvas.width, canvas.height)
  // ctx.restore()

  gameTimers.elapsedMs = (timeStamp - gameTimers.oldTimeStamp) // milliseconds passed since last call to gameLoop
  gameTimers.oldTimeStamp = timeStamp

  gameSettings.totalTime += gameTimers.elapsedMs

  // if (gameSettings.totalTime % 10000 < 50) { // increase difficulty every 10s
  //   increaseDifficulty()
  // }

  cursorObject.draw()
  drawScore()

  // Radial turrets/projectiles
  gameObjects.radialTurrets.forEach((turret) => { // update and draw turrets
    turret.update()
    turret.draw()
  })

  if (gameSettings.totalTime % 5000 < 50) { // create/fire radial projectiles once every 5 seconds
    gameObjects.radialTurrets.forEach((turret) => {
      turret.fireRadialOnce()
    })
  }

  for (let i=0; i < gameObjects.radialProjectiles.length; i++) { // update and render radial projectiles
    let p = gameObjects.radialProjectiles[i]
    p.update()

    if (cursorObject.collidesWith(p)) { // check collision for each with cursorObject
      endGame()
      resetGame()
      startMenu()
      return
    }

    p.draw()

    if (p.x < -p.radius || p.x > canvas.width + p.radius || p.y < -p.radius || p.y > canvas.height + p.radius) { // OOB
      gameObjects.radialProjectiles.splice(i, 1) // remove projectiles outside of screen
      i--
    }
  }

  // Aimed turrets/projectiles
  gameObjects.aimedTurrets.forEach((turret) => { // update and draw turrets
    turret.update()
    turret.draw()
  })

  if (gameSettings.totalTime % 3000 < 50) { // create/fire aimed projectiles once every 5 seconds
    gameObjects.aimedTurrets.forEach((turret) => {
      turret.fireAimedOnce()
    })
  }

  for (let i=0; i < gameObjects.aimedProjectiles.length; i++) { // update and render aimed projectiles
    let p = gameObjects.aimedProjectiles[i]
    p.update()

    if (cursorObject.collidesWith(p)) { // check collision for each with cursorObject
      endGame()
      resetGame()
      startMenu()
      return
    }

    p.draw()

    if (p.x < -p.radius || p.x > canvas.width + p.radius || p.y < -p.radius || p.y > canvas.height + p.radius) { // OOB
      gameObjects.aimedProjectiles.splice(i, 1) // remove projectiles outside of screen
      i--
    }
  }

  timeoutIDs.gameLoopID = window.requestAnimationFrame(gameLoop)
}
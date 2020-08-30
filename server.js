const express = require('express');
const path = require('path');
const app = express();
const nocache = require('nocache');

const server = app.listen(process.env.PORT || 3000, () => {
  console.log("Server listening at...");
});

const io = require('socket.io')(server);

app.use(express.static('public'));
app.use(nocache());
app.set('etag', false);

app.get("/", (req, res) => {

  res.sendFile(path.join(__dirname + "/index.html"));
});



const config = {
  width : 900,
  height : 1500,
  backgroundColor : 0xb5b5b5,
}

var paddle_1 = {
  x : config.width / 2,
  y : config.height - 50,
  width : 100,
  height : 20,
  color : 0xFF0000,
  playerName : "player-1",
};

var paddle_2 = {
  x : config.width / 2,
  y : 50,
  width : 100,
  height : 20,
  color : 0x0000FF,
  playerName : "player-2",
};

var ball = {
  x : config.width / 2,
  y : config.height / 2,
  width : 20,
  height : 20,
  color : 0xFFFF00,
  dx : 1,
  dy : 1,
  isEnabled : true,
}

var counter = 0;
var roomno = 0;
var score = {player1 : 0, player2 : 0};
var update_loop;

io.on('connection', (socket) => {



  console.log("A user connected");
  console.log("Sending initial data...");

  socket.join("room-" + roomno);

  if(counter == 0)
  {
    socket.emit('init-data', {config : config, paddle_1 : paddle_1, paddle_2 : paddle_2, ball : ball});
  }
  else if(counter == 1)
  {
    socket.emit('init-data', {config : config, paddle_1 : paddle_2, paddle_2 : paddle_1, ball : ball});
  }

  counter += 1;

  console.log("Sent initial data information successfully");
  console.log("Starting update loop");

  if(counter == 2)
  {
    update_loop = setInterval(function (){

      moveBall();
      io.in("room-" + roomno).emit("game-data", {ball : ball, paddle_1 : paddle_1, paddle_2 : paddle_2, score : score});
    }, 16);

    counter = 0;
  }


  socket.on("paddle-movement", function(data) {

    if(data.paddle.playerName == "player-1")
    {
      paddle_1.x = data.paddle.x;
      ball.isEnabled = true;
    }
    else if(data.paddle.playerName == "player-2")
    {
      paddle_2.x = data.paddle.x;
      ball.isEnabled = true;
    }

  });
});

function didCollideWithPaddle(ball, paddle)
{

  if(paddle.playerName == "player-1")
  {
    const horizontalIntersection = (ball.x <= paddle.x && paddle.x <= ball.x + ball.width) ||
    ((ball.x <= paddle.x + paddle.width && paddle.x + paddle.width <= ball.x + ball.width)) ||
    (paddle.x <= ball.x && ball.x <= paddle.x + paddle.width);

    const verticalIntersection = ball.y + ball.height >= paddle.y;

    return horizontalIntersection && verticalIntersection;
  }
  else if(paddle.playerName == "player-2")
  {
    const horizontalIntersection = (ball.x <= paddle.x && paddle.x <= ball.x + ball.width) ||
    ((ball.x <= paddle.x + paddle.width && paddle.x + paddle.width <= ball.x + ball.width)) ||
    (paddle.x <= ball.x && ball.x <= paddle.x + paddle.width);

    const verticalIntersection = ball.y <= paddle.y + paddle.height;

    return horizontalIntersection && verticalIntersection;
  }

}

function didCollideWithCourtVertically(ball)
{
  return (ball.y < 0) || (ball.y + ball.height > config.height);
}

function didCollideWithCourtHorizontally(ball)
{
  return ball.x < 0 || (ball.x + ball.width) > config.width;
}

function moveBall()
{
  if(didCollideWithCourtVertically(ball))
  {

    if(ball.y < 0)
    {
      ball.y = paddle_1.y - ball.height - 10;
      ball.x = paddle_1.x + paddle_1.width / 2;
      ball.isEnabled = false;

      score.player1 += 1;
    }
    else if(ball.y + ball.height > config.height)
    {
      ball.y = paddle_2.y + paddle_2.height + 10;
      ball.x = paddle_2.x + paddle_2.width / 2;
      ball.isEnabled = false;

      score.player2 += 1;
    }


    console.log("Score:");
    console.log(score);

  }

  if(didCollideWithCourtHorizontally(ball))
  {
    console.log("Horizontal collision detected!");


    if(ball.x < 0)
    {
      ball.x = 0;
    }
    else if(ball.x + ball.width > config.height)
    {
      ball.x = config.width - ball.width;
    }

    ball.dx *= -1;
  }


  if(didCollideWithPaddle(ball, paddle_1) || didCollideWithPaddle(ball, paddle_2))
  {
    ball.dy *= -1;
  }

  if(ball.isEnabled)
  {
    ball.x += ball.dx;
    ball.y += ball.dy;
  }
}

function checkGameStatus(score)
{
  if(score.player1 == 3)
  {
    io.in("room-" + roomno).emit("game-over", {message :
      {
        player1 : "You Won!",
        player2 : "You Lost!",
      }
    });
    clearInterval(update_loop);
  }
  else if(score.player2 == 3)
  {
    io.in("room-" + roomno).emit("game-over", {message :
      {
        player1 : "You Lost!",
        player2 : "You Won!",
      }
    });
    clearInterval(update_loop);
  }
}

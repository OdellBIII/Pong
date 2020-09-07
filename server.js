const express = require('express');
const path = require('path');
const app = express();
const nocache = require('nocache');
const redis = require("redis");
const client = redis.createClient();

client.on("error", function(error){

  console.error(error);
});

const server = app.listen(process.env.PORT || 3000, () => {
  console.log("Server listening at...");
});

const io = require('socket.io')(server);

app.use(express.static('public'));
app.use(nocache());
app.set('etag', false);

app.get("/", (req, res) => {

  var user = req.query;
  var cookie = {user_id : user.user_id, match_id : user.match_id};

  res.cookie("user_data_pong", cookie);

  res.sendFile(path.join(__dirname + "/index.html"));
});

const config = {
  width : 1000,
  height : 1500,
  backgroundColor : 0xb5b5b5,
};



io.on('connection', (socket) => {

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
    dy : 3,
    isEnabled : true,
  }

  var score = {player1 : 0, player2 : 0};
  var update_loop;

  const room_id = parseInt(socket.handshake.query.match_id);

  console.log("Room ID: " + room_id);

  console.log("A user connected");
  console.log("Sending initial data...");

  socket.join(room_id);

  if(io.sockets.adapter.rooms[room_id].length == 1)
  {
    let game_state = JSON.stringify({config : config, paddle_1 : paddle_1, paddle_2 : paddle_2, ball : ball, score : score});
    client.set(room_id, game_state, function(err, reply){
      console.log("-----REDIS OUTPUT REPLY----- " + reply);
      console.log("-----REDIS OUTPUT ERROR----- " + err);
    });

    socket.emit('init-data', {config : config, paddle_1 : paddle_1, paddle_2 : paddle_2, ball : ball});
    console.log("Player-1 initialized");



  }
  else if(io.sockets.adapter.rooms[room_id].length == 2)
  {
    socket.emit('init-data', {config : config, paddle_1 : paddle_2, paddle_2 : paddle_1, ball : ball});
    console.log("Player-2 initialized");
  }


  console.log("Sent initial data information successfully");

  if(io.sockets.adapter.rooms[room_id].length == 2)
  {
    console.log("Starting update loop");
    io.in(room_id).emit("start-game", {});
    setTimeout(function(){

      update_loop = setInterval(function (){

        client.get(room_id, function(err, object){

          let game_data = JSON.parse(object);

          checkGameStatus(game_data.score, room_id, update_loop);
          moveBall(game_data.ball, game_data.paddle_1, game_data.paddle_2, game_data.score);

          client.set(room_id, JSON.stringify(game_data));
          io.in(room_id).emit("game-data", game_data);
        });
      }, 16);

    }, 3000);

  }


  socket.on("paddle-movement", function(data) {

    client.get(room_id, function(err, object){
      let game_data = JSON.parse(object);

      if(data.paddle.playerName == "player-1")
      {
        game_data.paddle_1.x = data.paddle.x;
        game_data.ball.isEnabled = true;
      }
      else if(data.paddle.playerName == "player-2")
      {
        game_data.paddle_2.x = data.paddle.x;
        game_data.ball.isEnabled = true;
      }

      client.set(room_id, JSON.stringify(game_data));

    });
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

function moveBall(ball, paddle_1, paddle_2, score)
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

    ball.dy = 3;
    ball.dx = 1;

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

    if(ball.dx < 0)
    {
      ball.dx -= 1;
    }
    else if(ball.dx > 0)
    {
      ball.dx += 1;
    }

    ball.dx *= -1;
  }


  if(didCollideWithPaddle(ball, paddle_1) || didCollideWithPaddle(ball, paddle_2))
  {
    if(ball.dy < 0)
    {
      ball.dy -= 1;
    }
    else if(ball.dy > 0)
    {
      ball.dy += 1;
    }

    ball.dy *= -1;

  }

  if(ball.isEnabled)
  {
    ball.x += ball.dx;
    ball.y += ball.dy;
  }
}

function checkGameStatus(score, room_id, update_loop)
{
  if(score.player1 == 3)
  {
    io.in(room_id).emit("game-over", {message :
      {
        player1 : "You Won!",
        player2 : "You Lost!",
      }
    });
    clearInterval(update_loop);
  }
  else if(score.player2 == 3)
  {
    io.in(room_id).emit("game-over", {message :
      {
        player1 : "You Lost!",
        player2 : "You Won!",
      }
    });
    clearInterval(update_loop);
  }
}

const express = require('express');
const path = require('path');
const app = express();
const nocache = require('nocache');

const server = app.listen(process.env.PORT || 3000, () => {
  console.log("Server listening at...");
});

app.use(express.static('public'));
app.use(nocache());
app.set('etag', false);

app.get("/", (req, res) => {

  res.sendFile(path.join(__dirname + "/index.html"));
});

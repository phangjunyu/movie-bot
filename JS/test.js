const express = require('express');
const mongoose = require('mongoose');
const Movie = require('../models/Movie')
const tss = require('./testSearchService');
const bodyParser = require('body-parser');

const PORT = 8000;

var app = express();
var router = express.Router();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
mongoose.connect('mongodb://junyu_test:junyu123@ds161471.mlab.com:61471/movies');

router.use(function(req, res, next){
  console.log("initializing...");
  next();
});

router.get('/', function(req, res) {
  res.json("welcome to moviebot!");
});


router.route('/movie/:title')
.get(function(req, res, next){
  tss.findMovieWithTitle(req.params.title, function(err, result){
    if (err) return next(err);
    res.json(result);
  });
})

router.route('/movie')
  .post(function(req, res, next){
    tss.findMovieWithTitleAndCinema(req.body.title, req.body.cinemaName, function(err, result){
      if(err) return next(err);
      res.json(result);
    })
  })

app.use('/api', router);
app.listen(PORT);
console.log('Magic happens on port ', PORT);

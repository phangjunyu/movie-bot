var mongoose = require('mongoose');
var Movie = require('../models/Movie');

exports.findMovieWithTitle = function(title, callback){
  Movie.find({title:title}).exec(function(err, result){
    if(err) return callback(err);
    return callback(null, result);
  });
}

exports.findMovieWithTitleAndCinema = function(title, cinemaName, callback){
  Movie.find({title:title, cinemaName:cinemaName}).exec(function(err, result){
    if(err) return callback(err);
    console.log(result);
    return callback(null, result);
  });
}

'use strict'
var request = require('request');
var cheerio = require('cheerio');

exports.getAllCinemas = function(url, callback) {
  request({url: url}, function(error, response, html){
    if(!error){
        var $ = cheerio.load(html);

    var movieList = [];

    $('.movie-slideshow').children('.list-unstyled').children('li[class=item]').each(function(){
      var data = $(this).children('.entry').children().find('a');
      var movieURL = data.attr('href');
      var movieID = idParser(movieURL);
      var movie = {
        movieName: data.text(),
        movieURL: movieURL,
        movieID: movieID
      };
      movieList.push(movie);
    })
    return callback(null, movieList);
  }
  else{
    console.log(error);
    return callback(error);
    }
  })
}

function idParser(movieURL){
  var tempArray = movieURL.split('/');
  return tempArray[(tempArray.length-2)];
}

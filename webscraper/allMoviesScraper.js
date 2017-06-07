'use strict'
var request = require('request');
var cheerio = require('cheerio');

exports.getAllCinemas = function(url, callback) {
  request({url: url}, function(error, response, html){
    if(!error){
        var $ = cheerio.load(html);

    var movieList = [];
    var date = $('#movies-search-wrapper').find('.movies-date-id').children();
    var dateToday = date.eq(1).attr('data-value');
    var dates = {
      today: dateToday,
      tomorrow: date.eq(2).attr('data-value'),
      dayafter: date.eq(3).attr('data-value')
    }
    $('.movie-slideshow').children('.list-unstyled').children('li[class=item]').each(function(){
      var data = $(this).children('.entry').children().find('a');
      var movieURL = data.attr('href');
      var movieID = idParser(movieURL);
      var movie = {
        movieName: data.text(),
        movieURL: movieURL,
        movieID: movieID,
        dateScraped: dateToday
      };
      movieList.push(movie);
    })
    return callback(null, movieList, dates);
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

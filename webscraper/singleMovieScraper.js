'use strict'

var request = require('request');
var cheerio = require('cheerio');
var moment = require('moment');
var Movie = require('../models/Movie');
// var mongoose = require('mongoose');
//find and update use upsert


exports.getShowTimesByMovie = function(movieJson, callback){
  var url = "http://www.insing.com/" + movieJson.movieURL + "showtimes/";
  request(url, function(error, response, html){
    if(error){
      console.log('Error: ', error);
      callback(error, null);
    } else if (response.body.error){
      console.log('Error: ', response.body.error);
      callback(response.body.error, null);
    } else {
      var $ = cheerio.load(html);
      var allShowTimes = [];
      $('.cinema-showtime').each(function(i,elem){
          var movie = new Movie();
          movie.title = movieJson.movieName;
          movie.inSingID = movieJson.movieID;
          var data = $(this);
          var cinemaName = data.find('.cinemas-name').text();
          var showTimeByCinema = [], bookingLinksByCinema = [];
          data.find('.movie-showtimes').children().children().each(function(i, elem){
            var data = $(this).find('a').text();
            data = moment(data, "HH:mm a").format("HHmm");
            var bookingLink = $(this).find('a').attr('onclick');
            bookingLink = linkParser(bookingLink);
            bookingLinksByCinema.push(bookingLink);
            showTimeByCinema.push(data);
          });
          for(var x = 0; x < showTimeByCinema.length; x++){
          movie.cinemaName = cinemaName;
          movie.timings = showTimeByCinema;
          movie.bookingLinks = bookingLinksByCinema;
          }
          allShowTimes.push(movie);
      })
    }
    var jsonAllShowTimes = JSON.stringify(allShowTimes, null, 4);
    return callback(null, allShowTimes);
  })
}

function linkParser(string){
  string = string.split('this.href=');
  return string[1].replace('\'',"");
}

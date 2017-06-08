'use strict'

var request = require('request');
var cheerio = require('cheerio');
var moment = require('moment');

var url = "http://www.insing.com/movies/"

request(url, function(error, response, html){
  if(error){
    console.log('Error: ', error);
    callback(error, null);
  } else if (response.body.error){
    console.log('Error: ', response.body.error);
    callback(response.body.error, null);
  } else {
    var $ = cheerio.load(html);

    var result = $('#movies-search-wrapper').find('.movies-date-id').children().eq(1).attr('data-value')

    //.children('.inner').children('.entry').children().eq(2).children('.dropdown-container').find('input').attr('type')
    //.children('.movies-date-id').children('li').eq(1).attr('data-value')
    console.log(result);
  }
})

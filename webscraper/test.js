'use strict'

var request = require('request');
var cheerio = require('cheerio');

var url = "http://www.insing.com/movies/wonder-woman-2017/id-6aec0000/showtimes/?d=2017-06-06"

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
    var scrapedDate = $('.dates-panel').children().children().first().find('a').attr('data-date')
    console.log(scrapedDate);
  }
})

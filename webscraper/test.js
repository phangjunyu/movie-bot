'use strict'

var request = require('request');
var cheerio = require('cheerio');
var moment = require('moment');
var axios = require('axios');
var url = "http://www.insing.com/movies/"


function getPageImg(url) {
    return new Promise((resolve, reject) => {
        //get our html
        axios.get(url)
        .then(resp => {
            //html
            const html = resp.data;
            //load into a $
            const $ = cheerio.load(html);
            //find ourself a img
            const retURL = nodeURL.resolve(url,$('.movie-slideshow').children().children().find("img")[0].attribs.src);
            resolve(retURL);
        })
        .catch(err => {
           reject(err);
        });
    });
}

getPageImg(url)
// request(url, function(error, response, html){
//   if(error){
//     console.log('Error: ', error);
//     callback(error, null);
//   } else if (response.body.error){
//     console.log('Error: ', response.body.error);
//     callback(response.body.error, null);
//   } else {
//     var $ = cheerio.load(html);
//
//     var result = $('.movie-slideshow').children().children().find('img').attr('data-src')
//
//     //.children('.inner').children('.entry').children().eq(2).children('.dropdown-container').find('input').attr('type')
//     //.children('.movies-date-id').children('li').eq(1).attr('data-value')
//     console.log(result);
//   }
// })

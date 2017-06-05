'use strict'

var mongoose = require('mongoose');
var Movie = require('./movie');
var moment = require('moment');

exports.findQuery = function(movie, showTime, callback){
    var query = {title: movie};
    var query1 = {timing: showTime};

    // JOSEPH: u can do a Movie.find({title:movie, timing:showTime}, function(err, movieArray) {

    //})

    // dont use Caps in front of nonclasses, i.e. in this case movieArray is a variable so shouldnt be MovieArray

    Movie.find({$and: [  query, query1 ] } )
    .exec(function(err, movieArray){
        if (err) return callback(err);
        // res.json(MovieArray[0]);
				return callback(null,movieArray[0]);
				// res.json(MovieArray[0]);
    })}


exports.findTheNearestTime = function(req, callback){
	var query = 
				{
					title: req.desired_title,
					timing: req.desired_timing,
					location: req.desired_location
				}
	if(query.timing == null || query.timing == undefined){
		query.timing = moment().format('HHmm');
	}
	if(query.location == "" || query.location == undefined || query.location == null){
		// run function to ask for location
		query.location = 'West';
	}
	var maxTime = moment(query.timing, 'HH:mm').add(2, 'hours').format('HHmm');
	query.timing = moment(query.timing, 'HH:mm').format('HHmm');

	console.log(query);

	Movie.find( 
							 { timing: {$gte: query.timing, $lte: maxTime }, 							
							   title: query.title , 
							   cinema: query.location 
							 }
				)
	.exec(function(err, movieArray){
		if(err) return (err);
		//console.log(movieArray);
		return callback(movieArray[0]);
	})
}

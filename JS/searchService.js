'use strict'

var mongoose = require('mongoose');
var Movie = require('../models/Movie');
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

	var maxTime = moment(req.timings, 'HH:mm').add(30, 'minutes').format('HHmm');
	var requestedTime = moment(req.timings, 'HH:mm').format('HHmm');

	maxTime = parseInt(maxTime);
	requestedTime = parseInt(requestedTime);
	//console.log('timing is below:');
	//console.log(maxTime, requestedTime);
	var query =	{
					title: req.title 
				}
	var query2 = {
		
		"timings": {
			$lte: maxTime
		}
	}
	var query3 = {

		"timings": {
			$gte:requestedTime
		}
		//cinemaName: req.cinemaName
	}

	//console.log(query, query2, query3);
	Movie.aggregate([
				{$match: query },
				{$unwind: "$timings"},
				// {$match: query2},
				// {$match: query3},
				{$project: 
					{
						difference: {$subtract: [ "$timings"]}	
					} 
				}
				{$group: 
						{
							_id: "$cinemaName",
							timings : {$push: "$timings"}
						}
				}

				
			], function(err, result){
				if (err) return(err);

				var replyString = processTimings(title, result);

				console.log(result);

				var result = JSON.stringify(result)

				return callback(null, result);
			})

}

function processTimings(title, results) {
	//results contain 


	// Here's where you can watch Wonder Woman around 17:00
	// WE Cinema - 1700, 1720, 1820 \n
	// Cathay Cineleisure - 1700, 

}
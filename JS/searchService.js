'use strict'

var mongoose = require('mongoose');
var Movie = require('../models/Movie');
var moment = require('moment');
var region = require('../region');
var bodyParser = require('body-parser');
const express = require('express');

const app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

exports.findQuery = function(movie, showTime, callback){
    var query = {title: movie};
    var query1 = {timing: showTime};
    Movie.find({$and: [  query, query1 ] } )
    .exec(function(err, movieArray){
        if (err) return callback(err);
        // res.json(MovieArray[0]);
				return callback(null,movieArray[0]);
				// res.json(MovieArray[0]);
    })}



exports.findTheNearestTime = function(context, callback){
	var requestedTime = moment(context.timings).toDate();
	var maxTime = moment(context.timings).add(30, 'minutes').toDate();
	var minTime = moment(context.timings).add(-30, 'minutes').toDate(); 
console.log('am i in search service');
	
	//context.title is the name of the movie 
	var searchTitle = context.title;
	// .split(" ");
	// var searchTerm	= searchTitle;
	// var regTerm = searchTerm[0];
	// var regexQuery = {
	// 			title: {$regex: regTerm, $options: 'i'}
	// }
	
	var query =	{
					title: context.title,
				}
	var query2 = {
		"timings": {
			$lte: maxTime
		}}
	var query3 = {

		"timings": {
			$gte: minTime
		}}
		console.log('why am i undefined',context.title);
	// know that region is an array
	var area = JSON.stringify(context.area).slice(1, -1);
	if(area == 'North'){ 
		var areaArray = region.North;
	}
	if(area == 'South'){
		var areaArray = region.South;
	}
	if(area == 'East'){
		var areaArray = region.East;
	}
	if(area == 'West'){
		var areaArray = region.West;
	}
	if(area == 'Central'){
		var areaArray = region.Central;
	}
	if(area == 'All'){
		var areaArray = region.East.concat(region.North, region.South, region.West, region.Central);
	}
	console.log(area);
	console.log(areaArray);

	console.log(maxTime, minTime);
	Movie.aggregate([
				{$match: 
					{$text:{$search: searchTitle}}
				},
				{$match: regexQuery },
				{$match: {cinemaName:{$in: areaArray }}},
				{$unwind: {
							path: "$bookingLinks",
							includeArrayIndex: 'link_index'
				}},
				{$unwind: {		
								path: "$timings",
								includeArrayIndex: 'timing_index'
				}},
				{$match: query2},
				{$match: query3},
				{$project:{
						title: 1,
						timings: 1,
						cinemaName: 1,
						bookingLinks: 1,
						compare: {
									$cmp:['$link_index', '$timing_index']
						},
						difference: { $abs: {$subtract: [ "$timings", requestedTime]}}
					}
				},
				{$match: {compare: 0}
				},
				{$sort: {difference: 1}
				},
				{$limit: 5
				},
				{$group: 

						{
							_id: "$cinemaName",

							timings : {$push: "$timings"},
							bookingLinks :{ $push: "$bookingLinks"}
						}
				}], function(err, result){
				if (err) return(err);
				return callback(null, result);
			})

}



function processTimings(title, results) {
	//results contain


	// Here's where you can watch Wonder Woman around 17:00
	// WE Cinema - 1700, 1720, 1820 \n
	// Cathay Cineleisure - 1700,

}

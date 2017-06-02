'use strict'

var mongoose = require('mongoose');
var Movie = require('./movie');

exports.searchMovieTitle = function(req, res, next){
	var query = {title : req.title};
		Movie.aggregate([
			{$match: query},
			{$project: {
							title: 1,
							timing: 1,
							cinema: 1
						}
			},
		], function(err, result){
			if(err) return callback(err);
			return res.json(result);
		})
}

exports.findQuery = function(movie, showTime, callback){
    var query = {title: movie};
    var query1 = {timing: showTime};

    Movie.find({$and: [  query, query1 ] } )
    .exec(function(err, MovieArray){
        if (err) return callback(err);
        // res.json(MovieArray[0]);
				return callback(null,MovieArray[0]);
				// res.json(MovieArray[0]);
    })}

exports.searchMovieTiming = function(req, res, next){
	var query = {timing : req.params.movie_timing};
		Movie.aggregate([
			{$match: query},
			{$project: {
							title: 1,
							timing: 1,
							cinema: 1
						}
			},
		], function(err, result){
			if(err) return callback(err);
			return res.json(result);
		})
}

exports.searchMovieLocation = function(req, res, next){
	var query = {timing : req.params.movie_timing};
		Movie.aggregate([
			{$match: query},
			{$project: {
							title: 1,
							timing: 1,
							cinema: 1
						}
			},
		], function(err, result){
			if(err) return callback(err);
			return res.json(result);
		})
}

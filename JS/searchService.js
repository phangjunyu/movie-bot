'use strict'

var mongoose = require('mongoose');
var Movie = require('./movie');

exports.searchMovieTitle = function(req, res, next){
	//JOSEPH: don't use aggregate for normal db queries. just do Movie.find({title: req.title}, function(err, movie) { })
	//P.S. does this even work? shouldnt it be req.body.title?
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

    // JOSEPH: u can do a Movie.find({title:movie, timing:showTime}, function(err, movieArray) {

    //})

    // dont use Caps in front of nonclasses, i.e. in this case movieArray is a variable so shouldnt be MovieArray

    Movie.find({$and: [  query, query1 ] } )
    .exec(function(err, MovieArray){
        if (err) return callback(err);
        // res.json(MovieArray[0]);
				return callback(null,MovieArray[0]);
				// res.json(MovieArray[0]);
    })}

exports.searchMovieTiming = function(req, res, next){

	//JOSEPH: again dont use aggregate when u can use find
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
	//JOSEPH: use find. there is no need for aggregate
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

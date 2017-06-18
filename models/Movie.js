'use strict'

// grab the things we need
var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var movieSchema = new Schema({
    title: {
      type:String
    },
    inSingID: {
      type:String
    },
    cinemaName: {
        type: String
      },
    timings: {
        type: [Date]
      },
    bookingLinks: {
      type: [String]
    },
    imageLink: {
      type: String
    }
});

// the schema is useless so far
// we need to create a model using it
var Movie = mongoose.model('Movie', movieSchema);

// make this available to our Node applications
module.exports = Movie;

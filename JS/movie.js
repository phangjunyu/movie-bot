var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var MovieSchema = new Schema ({
	// JOSEPH: need to expand this. is timing best saved as a string or number?
	// might be better to save timing as a number 0000 - 2359, then u can search for timings > the timing that the user gave
	// also add in a location field. see the model for storeLocations in merchant model of vouch server
	title: 	String,     		//name
	cinemaName: String,	 			//name of cinema e.g. cathay
	timings: Number,	 			//time of movie
	location: String,			//area of cinema e.g. north west 
	day: String,				//day of the week


});

module.exports = mongoose.model('Movie', MovieSchema);

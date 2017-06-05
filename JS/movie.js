var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var MovieSchema = new Schema ({
	// JOSEPH: need to expand this. is timing best saved as a string or number?
	// might be better to save timing as a number 0000 - 2359, then u can search for timings > the timing that the user gave
	// also add in a location field. see the model for storeLocations in merchant model of vouch server
	title: 	String,     		//name
	cinema: String,	 			//name of cinema
	timing: Number,	 			//time of movie
	location: String,			//area of cinema
	day: String,				//day of the week


});

module.exports = mongoose.model('Movie', MovieSchema);

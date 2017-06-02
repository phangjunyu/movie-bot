var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var MovieSchema = new Schema ({

	title: 	String,
	cinema: String,
	timing: String

});

module.exports = mongoose.model('Movie', MovieSchema);

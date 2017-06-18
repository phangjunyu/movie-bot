var cron = require('node-cron');
var request = require('request');


exports.beginCronjob = function(){
	cron.schedule('0 0 16 * *', function(){
		request({
			url: 'http://localhost/scrape',
			method: 'GET'
		}, function(error, next){
			if(err) return(err);
			return next();
		});
	})
}


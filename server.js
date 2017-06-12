'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
const moment = require('moment');
const searchService = require('./JS/searchService');
const mongoose = require('mongoose');
const async = require('async');
const Movie = require('./models/Movie');
const ams = require('./webscraper/allMoviesScraper');
const sms = require('./webscraper/singleMovieScraper');
var region = require('./region');



// mongoose.connect('mongodb://test12:12test@ds137261.mlab.com:37261/hunglinga12');
mongoose.connect('mongodb://junyu_test:junyu123@ds161471.mlab.com:61471/movies');


function firstEntityValue(entities, entity){
  const val = entities && entities[entity] &&
  Array.isArray(entities[entity]) &&
  entities[entity].length > 0 &&
  entities[entity][0].value;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

let Wit = null;
let log = null;
try {
  // if running from repo
  Wit = require('./').Wit;
  log = require('./').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}

// Webserver parameter
const PORT = process.env.PORT || 3000;

// Wit.ai parameters
const WIT_TOKEN = process.env.WIT_TOKEN || '2DOU3VRLIV27HARM4STH5ORTKVQ3LCDV';

// Messenger API parameters
//const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN || 'EAAX94gbB7OIBAEBN8WfWjsdMGH5JD3WORXdY461UhWs5PGFdYhPajN431ivFPGGO7eZCM4nlH4tkuDI7HzdIiwN0xUvFUIA8ckKinM0JZAQkooLeZCqL8uowhZCHrAXxsZCr5xYy669jRruCuzQNpr3S1XYSZCqpY4gg6Or5QoPwZDZD';


const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN || 'EAAX94gbB7OIBAMrbsh8nr2n6s2Y2QWaQwhZAN9bTSFbhzu8tRTFZBVoad21hJHhIoW6zjqGsQyHqjA4QQbgnTBdXDKb6lxqQjZBoIml93HlyuHPHtzVKgPMM6Ha7GyDHPndYRSjqFxQjo8ikrIJre9ABbdwZBqN8RZBaV5KsSQAZDZD';

if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN') }
const FB_APP_SECRET = process.env.FB_APP_SECRET || '84f1b7362715035cd132a3fd67ed4c5f';
//for mymoviebot

// const FB_APP_SECRET = process.env.FB_APP_SECRET || '16b510b46fe3a12f91a42acb2ba5b2d4';
if (!FB_APP_SECRET) { throw new Error('missing FB_APP_SECRET') }

const FB_VERIFY_TOKEN = "VOUCHMOVIEBOT";
// crypto.randomBytes(8, (err, buff) => {
//   if (err) throw err;
//   FB_VERIFY_TOKEN = buff.toString('hex');
//   console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
// });

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};


const fbMessageCarouselCinemas = (id, context) => {
  //process result
  var elementArray = [];
  var results = JSON.parse(context.result)
  results.forEach(function(result) {
    var element = {
      title: result._id,
      subtitle: result.title
    };

    var buttonArray = [];
    var timings = result.timings;
    var bookingLinks = result.bookingLinks
    timings.forEach(function(timing, index) {
      var timing = moment(timing).utcOffset('+0800').format('dddd, HH:mm');
      var button = {
        "type": "web_url",
        "url": bookingLinks[index],
        "title": timing,
        "webview_height_ratio": "full"
      };
      buttonArray.push(button);

    })
    element.buttons = buttonArray;
    elementArray.push(element);
  })
  sendGenericMessage(id, elementArray, FB_PAGE_TOKEN, function(err, response) {
    console.log("id is: ", id)
    fbMessage(id, "Alrite, I've wiped my mind. What do you want now?");
  })

};



// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

// Our bot actions
const actions = {
  // send(request, response) {
  //   console.log('am i in the send function');
  //   // console.log(JSON.stringify(request));
  //   var sessionId = request.sessionId;
  //   var text = response.text;
  //   //console.log("response text is: ", text)
  //   var context = request.context;
  //   console.log('send function context: ', context);
  //   // Our bot has something to say!
  //   // Let's retrieve the Facebook user whose session belongs to
  //   const recipientId = sessions[sessionId].fbid;
  //   //console.log('the real id is: ', recipientId);
  //   if (recipientId) {
  //     // Yay, we found our recipient!
  //     // Let's forward our bot response to her.
  //     // We return a promise to let our bot know when we're done sending
  //     //console.log('<><><><>', JSON.stringify(context));
  //     if(context.resetID == 'Y'){
  //       var reply = "DONE!";
  //       fbMessage(recipientId, reply );
  //       return}
  //     if(context.title && !context.area){
  //       console.log('am i in the onwofnofowefb', recipientId);
  //       sendLocationQuickReply(recipientId, FB_PAGE_TOKEN, function(err, response){});
  //       return
  //     }
  //     if(context.title && context.timings && context.area && context.missingResult){
  //       sendResetQuickReply(recipientId, function(err, response){});
  //       return
  //     }
  //     if(context.title && context.result && context.timings && context.area) {
  //       fbMessageCarouselCinemas(recipientId ,context);
  //       return
  //     }
  //     return fbMessage(recipientId, text)
  //     .then(() => null)
  //     .catch((err) => {
  //       console.error(
  //         'Oops! An error occurred while forwarding the response to',
  //         recipientId,
  //         ':',
  //         err.stack || err
  //       );
  //     });
  //   } else {
  //     console.error('Oops! Couldn\'t find user for session:', sessionId);
  //     // Giving the wheel back to our bot
  //     return Promise.resolve()
  //   }
  // },
  send(request, response) {
    console.log('am i in the send function');
    // console.log(JSON.stringify(request));
    var sessionId = request.sessionId;
    var text = response.text;
    console.log("response text is: ", text)
    var context = request.context;
    console.log('send function context: ', context);
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    console.log('the real id is: ', recipientId);
    if (recipientId) {
      return fbMessage(recipientId, text)
      .then(() => null)
      .catch((err) => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
        );
      });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },

  getTimeAndLocation({context, entities, sessionId}){
    // console.log("getTimeAndLocation entities are: ", entities);
    var recipientId = sessions[sessionId].fbid;
    // context.reset = false;
    console.log("getTimeAndLocation context is: ",context);
    return new Promise((resolve, reject)=>{

      const reset = firstEntityValue(entities, 'reset')
      if(reset){
        console.log('reset is true')
        context.reset = true;
      }
      const title = firstEntityValue(entities, 'search_query');
      if (title){
        console.log('setting title')
        var statusMessage = "Watching: " + title;
        fbMessage(recipientId, statusMessage);
        context.title = title;
      }
      const cinemaLocation = firstEntityValue(entities, 'cinema_location')
      if(cinemaLocation){
        console.log('setting area')
        var statusMessage = "Your search area is set to: " + cinemaLocation;
        fbMessage(recipientId, statusMessage);
        context.area = cinemaLocation;
      }
      const datetime = firstEntityValue(entities, 'datetime');
      if(datetime){
        console.log('setting timings')
        var statusMessage = "Your search timing is set to: " + moment(datetime).utcOffset('+0800').format("dddd, HH:mm");
        fbMessage(recipientId, statusMessage);
        context.timings = datetime;
      }
      const area = firstEntityValue(entities, 'area');
      if(area){
        console.log('setting area')
        var statusMessage = "Your search area is set to: " + area;
        fbMessage(recipientId, statusMessage);
        context.area = area;
      }

      if(context.title && context.timings && context.area && context.reset == null){
        console.log('just before the search service', context);
        if (recipientId){
          var formattedTime = moment(context.timings).utcOffset('+0800').format("dddd, HH:mm");
          var searchText = "Currently trawling the seas for " + context.title + " at " + formattedTime + " at " + context.area + "...";
          fbMessage(recipientId, searchText);
        }
        searchService.findTheNearestTime(context,function(err, result){
          if(err) {return console.log(err);}
          if (result.length > 0){
            context.reset = true;
            context.result = JSON.stringify(result);
            if (context.missingResult){
              delete context.missingResult;
            }
          }
          else context.missingResult = true;
          return resolve(context);
        })
      }

        return resolve(context);
      })

    },

  sendReply(request){
    const recipientId = sessions[request.sessionId].fbid;
    var context = request.context
    var entities = request.entities
    console.log("context inside sendReply is: ", request.context)
    console.log('the real id is: ', recipientId);
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      //console.log('<><><><>', JSON.stringify(context));
      //Final successful search

      //reset pressed

      const reset = firstEntityValue(entities, 'reset')
      if(reset){
        console.log('SENDREPLY reset is true')
        context.reset = true;
      }

    if (context.reset && context.missingResult){
            fbMessage(recipientId, "Alrite, I've wiped my mind. What do you want now?", function(err, response){
              // return resolve(context);
            });
          return Promise.resolve(context);
      }
      //successful search
      else if(context.title && context.result && context.timings && context.area) {
          fbMessageCarouselCinemas(recipientId ,context)
         return Promise.resolve(context)
      }
      //Unsuccessful search
      else if(context.title && context.timings && context.area && context.missingResult && context.reset == null){
      sendResetQuickReply(recipientId, function(err, response){})
        return Promise.resolve(context)
      }
      else if (context.title && context.area){
        fbMessage(recipientId, "What time? :)\nPlease use pm or am!", function(err, response){})
        return Promise.resolve(context)
      }
      else if((context.title && context.timings) || (context.title && context.area == null && context.timings == null)){
        sendLocationQuickReply(recipientId, FB_PAGE_TOKEN, function(err, response){})
        return Promise.resolve(context)
      }
      else if(context.area && context.title == null && context.timings){
        fbMessage(recipientId, "Which movie? :)", function(err, response){})
        return Promise.resolve(context)
      }
      else if(context.area && context.title == null && context.timings == null){
        fbMessage(recipientId, "Which movie? :)", function(err, response){})
        return Promise.resolve(context)
      }
      else if(context.timings && context.title == null && context.area == null){
        fbMessage(recipientId, "Which movie? :)", function(err, response){})
        return Promise.resolve(context)
      }
    }
  },

};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

app.get('/', (req, res) => {
  res.sendStatus(200);
});
// Webhook setup
app.get('/webhook', (req, res) => {
  console.log('hello');
  if (req.query['hub.mode'] === 'subscribe' &&
  req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(400);
  }
});

  // app.get('/m', function(req, res, next) {
  //   Movie.find({}).distinct('title').exec(function(err, movieNameArray) {
  //     console.log('test');
  //     if(err) return next(err);
  //     return res.json(movieNameArray);

  //     imageLink
  //   })
  // });

  // Message handler
app.post('/webhook', (req, res) => {
  console.log('hello');
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  //context.reset = true;
  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if(event.postback && event.postback.payload && event.postback.payload != undefined)
            {
              console.log('am i even in here');
                switch(event.postback.payload){

                  case 'GET_STARTED_PAYLOAD':
                      console.log('yay get started recieved');
                      break;
                  case 'NOW_SHOWIMG':
                      console.log('requested for now showing movies');
                      var recipientId = event.sender.id;
                      var sessId = findOrCreateSession(senId);
                      summonTheCarousels(recipientId);
                      break;
                  case 'RESET':
                  console.log('RESET BUTTON CLICKED, relaying to context reset');

                      var senId = event.sender.id;
                      var sessId = findOrCreateSession(senId);
                      var ttext = 'I want to watch null at null at null';
                      sessions[sessId].context.resetID = "Y";
                      fbMessage(senId, "DONE!");
                      var reset = true;
                      var context = {};
                      context.title = null;
                      sessions[sessId].context.title = null;
                      wit.converse(sessId, context, ttext, reset)
                      wit.runActions(
                                sessId, // the user's current session
                                ttext, // the user's message
                                sessions[sessId].context // the user's current session state
                              ).then((context) => {
                                  console.log('resetting context', context);
                                  context.reset = true;
                                  if(context.reset ==true){
                                    for(var value in context)
                                      delete context[value];

                                    console.log('owuebfuwebfouewbf', context);
                                  }
                                sessions[sessId].context = context;
                              })
                              .catch((err) => {
                                console.error('Oops! Got an error from Wit: ', err.stack || err);
                              });

                      console.log('RESET BUTTON CLICKED, relaying to context reset');

                      break;
                  case 'SEARCH_MOVIE':
                      console.log('SEARCH MOVIE BUTTON CLICKED');
                      break;
                  case 'SEARCH_LOCATION':
                      console.log('SEARCH LOCATION BUTTON CLICKED');
                      break;
                  case 'SEARCH_TIMINGS':
                      console.log('SEARCH TIMINGS BUTTON CLICKED');
                }
            }
        // We retrieve the user's current session, or create one if it doesn't exist
        // This is needed for our bot to figure out the conversation history
        else if(event.message && !event.message.is_echo){
        var sender = event.sender.id;
        const sessionId = findOrCreateSession(sender);
        // We retrieve the message content
        const {text, attachments} = event.message;
        if (attachments) {
          // We received an attachment
          // Let's reply with an automatic message
          fbMessage(sender, 'Sorry I can only process text messages for now.')
          .catch(console.error);
        }
        else if (text) {
          // We received a text message
          // Let's forward the message to the Wit.ai Bot Engine
          // This will run all actions until our bot has nothing left to do
          wit.runActions(sessionId, text, sessions[sessionId].context).then((context) => {
            console.log('Waiting for next user messages');
            if (context.reset){
              console.log('resetting context');
              for (var value in context){
                delete context[value];
              }
            }
            sessions[sessionId].context = context;
          })
          .catch((err) => {
            console.error('Oops! Got an error from Wit: ', err.stack || err);
          })
        }
      }

      else {
          console.log('received event', JSON.stringify(event));
      }
    });
  })
res.sendStatus(200);
  }
});
   //res.sendStatus(200);



app.get('/scrape', function(req, res, next){
  var url = 'http://www.insing.com/movies/';
  async.waterfall([
    function startScraping(callback){
      console.log("url is ", url);
      ams.getAllCinemas(url, function(err, movieList, dates){
        if (err) return callback(err);
        return callback(null, movieList, dates);
      })
    },
    function gotListOfMovies(movieList, dates, callback){
      async.parallel([
        function scrapeToday(callback){
          //current date no need to increment
          async.map(movieList, sms.getShowTimesByMovie, function(err, result){
            if (err){
              console.log(err)
              return err;
            }
            return callback(null, result);
          })
        },
        function scrapeTomorrow(callback){
          var tomorrow = dates.tomorrow
          for (var i = 0; i < movieList.length; i++){
            movieList[i].dateScraped = tomorrow;
          }
          async.map(movieList, sms.getShowTimesByMovie, function(err, result){
            if (err){
              console.log(err)
              return err;
            }
            return callback(null, result);
          })
        },
        function scrapeDayAfter(callback){
          var dayafter = dates.dayafter
          for (var i = 0; i < movieList.length; i++){
            movieList[i].dateScraped = dayafter;
          }
          async.map(movieList, sms.getShowTimesByMovie, function(err, result){
            if (err){
              console.log(err)
              return err;
            }
            return callback(null, result);
          })
        }
      ],  function(err, results){
        if(err) return next(err);
        return callback(null, results);
      });
    }
  ], function saveToDatabase(err, results){
    if (err) return next(err);
    results = [].concat.apply([],results);
    results = [].concat.apply([],results);
    //double flatten the results array so that it can be uploaded
    async.waterfall([
      function clearDataBase(callback){
        Movie.remove({}, function onDelete(err, docs) {
          if (err) {
            console.log("Couldn't delete! Error: ", err)
            return callback(err);
          } else {
            console.info('database cleared!');
            return callback(null);
          }
        })
      },
      function insertNewValues(callback){
        Movie.insertMany(results, function onInsert(err, docs) {
          if (err) {
            console.log("Couldn;t upload! Error: ", err)
            return callback(err);
          } else {
            console.info('new values uploaded!');
            return callback(null);
          }
        })
      }
    ], function doneUploading(err, result){
      if (err) return next(err);
    })
  })
  res.sendStatus(200);
})


/*
* Verify that the callback came from Facebook. Using the App Secret from
* the App Dashboard, we can verify the signature that is sent with each
* callback in the x-hub-signature field, located in the header.
*
* https://developers.facebook.com/docs/graph-api/webhooks#setup
*
*/
function summonTheCarousels(recipientId){
  var recipientId  = recipientId;
console.log('entered the summon carousels');
  searchService.NowShowing(recipientId, function(err, result){
    if(err) return (err);
    console.log('came out of now showing')
    processNowShowingCarousel(result, function(err, result){
      if (err) return(err);
      var elementArray = [];
      result.forEach(function(result){
        var element = {title: result._id,
                        subtitle: "blank"
                        //button: "link"
                      }
        elementArray.push(element);
      })
      var i;
      var stringLength = result.length;
      var quotient = Math.floor(stringLength/10);

      if (stringLength < 10){quotient =1;}

      for(i=0;i<=quotient;i++)
          {
            var resultArr = [];
            resultArr = elementArray.slice(i*10, (i*10)+10);
            console.log('wiufiuwefiuewbfbw',resultArr);
          sendGenericMessage(recipientId, resultArr, FB_PAGE_TOKEN, function(err, result){
            if(err) return(err);
            return console.log('sent carousel for now showing 1');
          })
        }
    //return console.log('sent carousel for now showing 2');
    })
 //return console.log('sent carousel for now shwoing 2');
  })
}

function processNowShowingCarousel(result, callback){
  var movieArray = result;
  console.log('the process now showing carousell is: ', movieArray);
  return callback(null, movieArray);
}

function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
    .update(buf)
    .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

function sendLocationQuickReply(recipient, accessToken, callback){
  //triggered to give 5 buttons
  var messData = {
    "text":"Either tell me the cinema name or tap an area below!",
    "quick_replies":[
      {"content_type":"text",
      "title":"North",
      "payload":"North"
      },
      {"content_type":"text",
      "title":"West",
      "payload":"West"
      },
      {"content_type":"text",
      "title": "East",
      "payload": "East"
      },
      {"content_type": "text",
      "title": "South",
      "payload": "South"
      },
      {"content_type":"text",
      "title": "Central",
      "payload": "Central"
      },
      {"content_type": "text",
      "title": "All",
      "payload": "All"
  }]}
console.log('The mess data is: ', messData, recipient);
var messageData = messData;
request({
  url:'https://graph.facebook.com/me/messages?',
  qs: { access_token: accessToken },
  method: 'POST',
  json: {
    recipient: { id: recipient },
    message: messageData,
  }
}, function(error, response, body){
  if (error){
    console.log("error sending quick reply", error);
    return callback(err, null);
  }else if(response.body.error){
    console.log('error: ', response.body.error);
    return callback(response.body.error, null);
  } else {
    console.log('the response is: ',response.body);
    return callback(null, response.body);
  }
}
);
}

function sendResetQuickReply(recipient, callback){
  var messData = {
    "text":" Shiver me timbers!!\nI'm sorry. There are no other showings within half an hour of the timing you gave! Either change one of the parameters or press Reset to start a new search!",
    "quick_replies":[
      {"content_type":"text",
      "title":"Reset",
      "payload":"Reset"
    }]
  }
  console.log('The mess data is: ', messData, recipient);
  var messageData = messData;
  request({
    url:'https://graph.facebook.com/me/messages?',
    qs: { access_token: FB_PAGE_TOKEN },
    method: 'POST',
    json: {
      recipient: { id: recipient },
      message: messageData,
    }
  }, function(error, response, body){
    if (error){
      console.log("error sending quick reply", error);
      return callback(err, null);
    }else if(response.body.error){
      console.log('error: ', response.body.error);
      return callback(response.body.error, null);
    } else {
      console.log('the response is: ',response.body);
      return callback(null, response.body);
    }
  }
);
}

function sendGenericMessage(recipient, elements, accessToken, callback) {
  console.log(elements);

  var messageData = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": elements
      }
    }
  };
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: accessToken },
    method: 'POST',
    json: {
      recipient: { id: recipient },
      message: messageData
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
      return callback(error, null);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
      return callback(response.body.error, null);
    } else {
      return callback(null, response.body);
    }
  });

}

// router.route('/startCronjob')
//   .get(cronjob.beginCronjob)

app.listen(PORT);

console.log('Listening on :' + PORT + '...');

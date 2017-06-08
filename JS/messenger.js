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
const searchService = require('./searchService');
const mongoose = require('mongoose');
const async = require('async');
const Movie = require('../models/Movie');
const ams = require('../webscraper/allMoviesScraper');
const sms = require('../webscraper/singleMovieScraper');
var region = require('../region');

mongoose.connect('mongodb://test12:12test@ds137261.mlab.com:37261/hunglinga12');
// mongoose.connect('mongodb://junyu_test:junyu123@ds161471.mlab.com:61471/movies');

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
  Wit = require('../').Wit;
  log = require('../').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}

// Webserver parameter
const PORT = process.env.PORT || 5000;

// Wit.ai parameters
const WIT_TOKEN = process.env.WIT_TOKEN || '2DOU3VRLIV27HARM4STH5ORTKVQ3LCDV';

// Messenger API parameters
//const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN || 'EAAZA7FbmJywkBALWOZAUQ0rr2mc7w9g3rX9bTeHlhptvedHlYgi7vnZCHf0dt5T9Pl9ejMPx93ZBSWCJNnr3AkgohUTsvPo4qbRqix8Cu4eoQU4h8x0tEU3986jB8b8zfaWGdD49s6ursYyG7IkApZAQWB1pGRfQ3TJbgxvZCdzwZDZD';
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN || 'EAAX94gbB7OIBAM2Ah0CbBOdvr5vB8UJOdclXZC54cwxDFkEueqxSKPIHlREAD83ys6XFMGHN3mqOkV8qBesR12XRxNrA2QIAxcsILe2KHGZBzwTmv17JXR8gCP45g5cv0kS3bTxbnVgZAkC0bmfQlcTRNAFydwJvZAp3Q8eyugZDZD';

if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN') }
const FB_APP_SECRET = process.env.FB_APP_SECRET || '84f1b7362715035cd132a3fd67ed4c5f';
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


const fbMessageCarouselCinemas = (id, title, results) => {
  //process result
  var elementArray = [];
  console.log(results);
  results.forEach(function(result) {
    var element = {

        title: result._id,//cinema name,
        //subtitle: // cinema location,
        //item_url: productUrl,
        //image_url: // cinema logo
    };

    var buttonArray = [];
    var timings = result.timings;
    // console.log(timings);
    // console.log(result);
    var bookingLinks = result.bookingLinks
    // console.log(bookingLinks);
    timings.forEach(function(timing, index) {
      //console.log(timing);
      var timing = moment(timing).format('HH:mm');
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
  
  console.log(elementArray);
 
  //send carousel message
  sendGenericMessage(id, elementArray, FB_PAGE_TOKEN, function(err, response) {

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
  send(request, response) {
    console.log('am i in the send function');
    console.log(JSON.stringify(request));
    var sessionId = request.sessionId;
    var text = response.text;
    var context = request.context;
    console.log('send function context: ', context);
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    console.log('the real id is: ', recipientId);
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      //console.log('<><><><>', JSON.stringify(context));
      if(context.title && context.timings && !context.area){
        console.log('am i in the onwofnofowefb', recipientId);
        sendLocationQuickReply(recipientId, FB_PAGE_TOKEN);
        return
      }
      // if (context.title && context.timings && context.area)
      //   {context.reset=true;}
      console.log('triple deal here: ', context.title);
      if(context.title && context.result && context.requestedTime) {
        var rec= recipientId;
        context.reset=true;
        var title = context.title;
        var cont = context.result;
        fbMessageCarouselCinemas(rec, title, JSON.parse(cont));
        return
      }
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
  getCinema({context, entities}) {

    console.log('running getCinema');
      //context.reset = false;
      return new Promise((resolve, reject)=> {
          // const movie = firstEntityValue(entities, 'movie');
          // if (movie){
          //   context.title = movie;
          // }        
          // var datetime = firstEntityValue(entities, 'datetime');
          // var parsedTimings;
          //  if(datetime){
          //   parsedTimings = moment(datetime, ["HH:mm:ss", moment.ISO_8601]).format("HH:mm");
          // }

          // var parsedShowDay = firstEntityValue(entities, 'datetime');
          // if(parsedShowDay){
          //   parsedShowDay = moment(parsedShowDay, ["YYYY-MM-DD", moment.ISO_8601]).format("MM-DD");
          // }
          // //const location = firstEntityValue(entities, 'cinema_location')

          // //const cinemaName = await 
          // context = {
          //             title : movie,
          //             timings : datetime
          //             //cinemaName: cinemaName
          //           };
          console.log(context);
          const area = firstEntityValue(entities, ' area');
          context.area = area;


          searchService.findTheNearestTime(context, function(err, result){
              if(err) {return console.log(err);}
              if(result == null){
                return resolve(context);
              }
              context.title = movie;
              context.requestedTime =  moment(datetime).toDate();
              context.result = JSON.stringify(result);
              if(context.title && context.result && context.requestedTime&& context.location) {
                context.reset = true;

              } 

              return resolve(context);
            }
         )
    //  return resolve(context);
  })
},

getTimeAndLocation({context, entities, input}){
  console.log('gettimeandlocation');
  console.log(context);
  context.reset = false;
  return new Promise((resolve, reject)=>{
    const movie = firstEntityValue(entities, 'search_query');
    if (movie){
      context.title = movie;
    }
    const datetime = firstEntityValue(entities, 'datetime');
    if(datetime){
      context.timings = datetime;
    }
    var area = firstEntityValue(entities, 'area');
    if(area){
      context.area = area;
      
    }
    if(!area){
      console.log('location not given!');

    }
    if(context.title && context.timings && area){ 
      area = null;
      console.log('ket me innnnnn');
        console.log('just before the search service', context);
    searchService.findTheNearestTime(context,function(err, result){
      context.reset = true;
      console.log('search results return',result);
      if(err) {return console.log(err);}
      if(result == null){
        return resolve(context);
      }
      context.title = context.title;
      context.requestedTime = moment(datetime).toDate();
      context.result = JSON.stringify(result);
      if (context.title && context.result && context.requestedTime && context.area){
        context.reset = true;
      }
      return resolve(context);
    })    }
    else
    return resolve(context);
    // searchServce.findTheNearestTime(context, function(err, result){
    //   if(err) {return console.log(err);}
    //   if(result==null){
    //     return resolve(context);
    //   }
    //   context.title
    })

  }



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
        if (event.message && !event.message.is_echo) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender


          const sender = event.sender.id;
         console.log(event);

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
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
            console.log('before running actions');            
            wit.runActions(
              sessionId, // the user's current session
              text, // the user's message
              sessions[sessionId].context // the user's current session state
            ).then((context) => {


              // Our bot did everything it has to do.
              // Now it's waiting for further messages to proceed.
              console.log('Waiting for next user messages');
              // Based on the session state, you might want to reset the session.
              // This depends heavily on the business logic of your bot.
              // Example:
              if (context.reset){

              console.log('resetting context');
              delete context.title;
              delete context.result;
              delete context.requestedTime;
              delete context.area;
              }

              // Updating the user's current session state
              sessions[sessionId].context = context;
            })
            .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
          }
        } else if (event.message.quick_reply) {

        } else {
          console.log('received event', JSON.stringify(event));
        }
      });
    });
    res.sendStatus(200);
  }
});

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
                              "text":"Where:",
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
    url:'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: accessToken },
    method: 'POST',
    json: {
            recipient: { id: recipient },
            message: messageData,
          }
    }, function(error, response, body){
      if (error){
        console.log("error sending quick reply", error);
        return(err, null);
      }else if(response.body.error){
        console.log('error: ', response.body.error);
        return(response.body.error, null);
      } else {
        console.log('the response is: ',response.body);
        return(null, response.body);
      }
    }
  );
}


function sendGenericMessage(recipient, elements, accessToken, callback) {

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

app.listen(PORT);
console.log('Listening on :' + PORT + '...');


// Just in case
// function gotListOfMovies(movieList, callback){
//   async.map(movieList, sms.getShowTimesByMovie, function(err, result){
//     if (err){
//       console.log(err)
//       return err;
//     }
//     return callback(null, result);
//   });
// }

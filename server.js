var port = 3000;

// config data
// make sure this is ignored by git
var conf = require('./config');
const fs = require('fs');


/* ------------ SET UP THE APP ------------- */
var express = require('express');
var app = express();

var bodyParser = require('body-parser');
var multer = require('multer');
var urlencodedParser = bodyParser.urlencoded({ extended: true }); // for parsing form data
app.use(urlencodedParser);

// instagram scraper
var scraper = require('insta-scraper');
// facebook graph api
var graph = require('fbgraph');
// http request module 
var request = require('request');

// server static files as well as routes
app.use(express.static('public'));
app.set('view engine', 'ejs');

graph.setAccessToken(conf.access);

// open the port
app.listen(port, function() {
    console.log('Server listening on port ' + port)
});


// ----------- AUTHORIZE ----------------- //

// get authorization url 
var authUrl = graph.getOauthUrl({
    "client_id": conf.client_id,
    "redirect_uri": conf.redirect_uri
});


app.get('/auth', function(req, res) {

    // we don't have a code yet 
    // so we'll redirect to the oauth dialog 
    if (!req.query.code) {
        console.log("Performing oauth for some user right now.");

        var authUrl = graph.getOauthUrl({
            "client_id": conf.client_id,
            "redirect_uri": conf.redirect_uri,
            "scope": conf.scope
        });

        if (!req.query.error) { //checks whether a user denied the app facebook login/permissions 
            res.redirect(authUrl);
        } else { //req.query.error == 'access_denied' 
            res.send('access denied');
        }
    }
    // If this branch executes user is already being redirected back with code (whatever that is) 
    else {
        console.log("Oauth successful, the code (whatever it is) is: ", req.query.code);
        // code is set 
        // we'll send that and get the access token 
        graph.authorize({
            "client_id": conf.client_id,
            "redirect_uri": conf.redirect_uri,
            "client_secret": conf.client_secret,
            "code": req.query.code
        }, function(err, facebookRes) {
            console.log(facebookRes);
            conf.access = facebookRes.access_token;
            res.send("done!");
            //res.redirect('/UserHasLoggedIn');
        });
    }
});

// ----------- ROUTES ----------------- //

app.post('/setplaces', function(req, res) {

    var start = req.body.startlocation;
    var end = req.body.endlocation;
    var dist = req.body.distance;

    console.log(req.body);

    // pass locations to google api to get initial route
    // pass locations to instagram scrape
    findNearby(start, dist, res);

    //res.send("You submitted: " + textvalue);
});

function promisifiedGetMediaByLocationId(locationId) {
    return new Promise(function(resolve, reject) {
        scraper.getMediaByLocationId(locationId, function(error, response_json) {
            if (error) {
                reject(error)
                return
            }
            resolve(response_json)
        })
    })
}




// currently using a hardcoded location but this should be user based
//app.get('/nearby', function(req, res) {

function findNearby(latlong, dist, res) {

    var url = "search?type=place&center=" + latlong + "&distance=" + dist;
    //"search?type=place&center=37.76,-122.427&distance=1000"

    // get nearby places
    graph.get(url, function(err, response) {
        console.log("success, received nearby places!");
        // pass places to instagram scraper

        // .data is just the place data for the first 25 places
        var nearbyPlaces = response.data;
        //console.log(nearbyPlaces);

        // but we need to deal with pagination
        // .paging.next will provide the URL for the next 25 results
        // but for now, just use the first 25...

        // pass this to get instagram stats
        if (response.data.length > 0) {
            getInstagramData(nearbyPlaces, res);
        } else {
            res.send("no nearby places - expand radius");
        }

    })
}



function getInstagramData(places, res) {
    console.log("get instagram data");

    var instagramPlaces = [];
    var promiseArray = [];

    for (var n = 0; n < places.length; n++) {
        var thisLocID = parseInt(places[n].id);
        //console.log(typeof thisLocID);
        console.log(places[n].name);

        var promise = promisifiedGetMediaByLocationId(thisLocID)
            .then(function(response_json) {
                instagramPlaces.push(response_json)
            })
            .catch(function(error) {
                console.log(error)
            })
        promiseArray.push(promise);
    }

    Promise.all(promiseArray).then(function() {

        // for each place, 
        // sort places but media count
        instagramPlaces.sort(function(a, b) {
            // sort by document then sentence sequence
            return b.media.count - a.media.count;
        })
        res.send(instagramPlaces);
    })
}



// if i want to do distances...
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1); // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    var meters = d/1000;
    return meters;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}
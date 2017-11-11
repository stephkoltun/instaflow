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
// geojson validate
var GJV = require("geojson-validation");
// get directions using mapbox api
var MapboxClient = require('mapbox/lib/services/directions');



// server static files as well as routes
app.use(express.static('public'));
app.set('view engine', 'ejs');

graph.setAccessToken(conf.access);
// https://github.com/mapbox/mapbox-sdk-js/blob/master/API.md
var mapboxClient = new MapboxClient(conf.mapaccess);

// open the port
app.listen(port, function() {
    console.log('Server listening on port ' + port)
});




// ----------- ROUTES ----------------- //

app.get('/', function(req, res) {
    res.render("directions.ejs");
})

app.post('/getplaces', function(req, res) {
    console.log("----- received destination");
    console.log(req.body);

    var start = req.body.startlocation;
    var end = req.body.endlocation;
    var dist = parseFloat(req.body.distance);

    // parse the incoming string
    // TODO accept any sort of place
    // likely need ANOTHER API - ugh too much
    var startObj = latLongObj(start);
    var endObj = latLongObj(end);
    var places = [startObj, endObj];

    var allPromises = [];
    var origRoute;

    var routePromise = getRoute(places)
        .then(function(response_route) {
            console.log("success - route receieved");
            console.log(response_route);
            origRoute = response_route;
        })
        .catch(function(error) {
            console.log("error");
            console.log(error)
        })
    allPromises.push(routePromise);

    var startData = {
        coords: startObj,
        string: start,
        nearby: null,
    }
    var startPromise = findNearby(start, dist)
        .then(function(response_nearby) {
            var nearbyFBPlaces = response_nearby;
            startData.nearby = nearbyFBPlaces;
            //get instagram stats for this place
        })
        .catch(function(error) {
            console.log("error on finding nearby " + start);
            console.log(error)
        })
    allPromises.push(startPromise);

    var endData = {
        coords: endObj,
        string: end,
        nearby: null,
    }
    var endPromise = findNearby(end, dist)
        .then(function(response_nearby) {
            var nearbyFBPlaces = response_nearby;
            endData.nearby = nearbyFBPlaces;
        })
        .catch(function(error) {
            console.log("error on finding nearby " + end);
            console.log(error)
        })
    allPromises.push(endPromise);

    Promise.all(allPromises).then(function() {
        console.log("all nearby places are returned for both places");
        getMedia(startData, endData, origRoute, res);
    })

});


function getMedia(startData, endData, origroute, res) {
    var allPromises = [];

    var startMedia = getInstagramData(startData.nearby, startData.string)
        .then(function(response_instamedia) {
            startData.instaplaces = response_instamedia;
        });
    allPromises.push(startMedia);

    //get instagram stats for this place
    var endMedia = getInstagramData(endData.nearby, endData.string)
        .then(function(response_instamedia) {
            endData.instaplaces = response_instamedia;
        });
    allPromises.push(endMedia);

    Promise.all(allPromises).then(function() {
        console.log("all required data has been gathered");

        var startStats = keyStats(startData.instaplaces, startData.string);
        startData.stats = startStats;
        var endStats = keyStats(endData.instaplaces, endData.string);
        endData.stats = endStats;

        var newpoints = newWaypoints(startData, endData);

        getRoute(newpoints).then(function(newroute) {
            //do something with the new route
            console.log("received new route");
            var newdests = [startData.stats.mostPopular,startData.stats.leastPopular,startData.stats.mostLiked,endData.stats.mostPopular,endData.stats.leastPopular,endData.stats.mostLiked];

            constructGeoDataSet(startData, endData, origroute, newroute, newdests, res);
        })
    })
}



function constructGeoDataSet(start, end, origroute, newroute, newdests, res) {
    console.log("----- construct geoJSON");   

    var waypoints = {
        "type": "FeatureCollection",
        "features": []
    }

    for (var i = 0; i < newdests.length; i++) {
        var thispoint = newdests[i];
        var feature = constructFeature(thispoint);
        waypoints.features.push(feature);
    }


    var dataToSend = {
        newroute: newroute,
        origroute: origroute,
        startPlaces: null,
        endPlaces: null,
        waypoints: waypoints,
        start: start.coords,
        end: end.coords
    }

    console.log("send data");
    res.send(dataToSend);


    //     console.log("done featuring");
    //     var valid = (GJV.valid(dataCollection));
    //     if (valid) {
    //         res.send(dataCollection);
    //     } else {
    //         console.log("errors in geojson!");
    //     }

}


function constructFeature(place) {
    /*function findPlace(thisplace) {
        return thisplace.name === thisname;
    }
    // find the corresponding fbplace
    var matchingFB = fbplaces.find(findPlace);

    var dist = getDistanceFromLatLonInKm(origPlace.lat, origPlace.lng, thisinstaplace.lat, thisinstaplace.lng)*/
    console.log("construct feature");

    /*function likes() {
       if (place.top_posts.nodes[0].likes != 0) {
        return place.top_posts.nodes[0].likes
    } else {
        return 0;
    } */


    var geoFeature = {
        "id": place.id,
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [place.lng, place.lat] //long-lat
        },
        "properties": {
            "name": place.name,
            //"category": matchingFB.category_list,
            "count": place.media.count, // number of instagrams
            //"mostlikes": likes(), // the photo at place with most likes
            //"dist": dist
        }
    };

    return geoFeature;

}

// -------- HELPER PROMISES ------ //

function newWaypoints(startData, endData) {
    var newPoints = [
        startData.coords,
        {
            latitude: startData.stats.mostPopular.lat,
            longitude: startData.stats.mostPopular.lng
        },
        {
            latitude: startData.stats.leastPopular.lat,
            longitude: startData.stats.leastPopular.lng
        },
        {
            latitude: startData.stats.mostLiked.lat,
            longitude: startData.stats.mostLiked.lng
        },
        {
            latitude: endData.stats.mostPopular.lat,
            longitude: endData.stats.mostPopular.lng
        },
        {
            latitude: endData.stats.leastPopular.lat,
            longitude: endData.stats.leastPopular.lng
        },
        {
            latitude: endData.stats.mostLiked.lat,
            longitude: endData.stats.mostLiked.lng
        },
        endData.coords,
    ];

    return newPoints;
}


function getInstagramData(places, point) {

    return new Promise(function(resolve, reject) {
        console.log("----- get instagram data for " + point);

        var instagramPlaces = [];
        var promiseArray = [];

        for (var n = 0; n < places.length; n++) {
            var thisLocID = parseInt(places[n].id);
            // some how i'll also want to save the category list from the facebook data
            var thisCategoryList = places[n].category_list;

            // only look up places that are not cities or neighborhoods
            if ((thisCategoryList[0].name != 'City') && (thisCategoryList[0].name != 'Neighborhood')) {

                console.log("look up " + places[n].name);

                var promise = lookupInstagramStats(thisLocID)
                    .then(function(response_json) {
                        instagramPlaces.push(response_json)
                    })
                    .catch(function(error) {
                        console.log("error");
                        reject(error)
                    })
                promiseArray.push(promise);
            }
            /*else {
                console.log("ignore " + places[n].name + ", " + thisCategoryList[0].name);
            }*/
        }

        // once each place has been instagram scrapped... 
        Promise.all(promiseArray).then(function() {
            console.log("instagram returned for " + point);
            resolve(instagramPlaces);
        })
    })
}


function getRoute(places) { // takes an array of objects, each with lat
    console.log("----- get route");



    // directions API can return promises
    // https://www.mapbox.com/help/getting-started-directions-api/
    return new Promise(function(resolve, reject) {
        mapboxClient.getDirections(places, {
                geometries: 'geojson',
                profile: 'walking',
                alternatives: false,
            },
            function(error, response_json) {
                if (error) {
                    reject(error)
                    console.log(error);
                    return
                }
                resolve(response_json)
            })
    })
}

function findNearby(point, dist) {
    console.log("----- find nearby places for " + point);

    var url = "search?type=place&center=" + point + "&distance=" + dist + "&fields=name,id,location,category_list";

    return new Promise(function(resolve, reject) {
        graph.get(url, function(error, response_json) {
            if (error) {
                reject(error)
                console.log(error);
                return
            } else {
                console.log("success, received nearby places for " + point);
                // .data is just the place data for the first 25 places
                var nearbyPlaces = response_json.data;

                // but we need to deal with pagination
                // .paging.next will provide the URL for the next 25 results
                // because we should also exclude 'neighborhoods' maybe - and just restrict to specific locations
                // but for now, just use the first 25...

                // pass this to get instagram stats
                if (nearbyPlaces.length > 0) {
                    resolve(nearbyPlaces);
                } else {
                    console.log("no nearby places - expand radius");
                }
            }
        })
    })
}

function lookupInstagramStats(locationId) {
    return new Promise(function(resolve, reject) {
        scraper.getMediaByLocationId(locationId, function(error, response_json) {
            if (error) {
                reject(error)
                console.log(error);
                return
            }
            resolve(response_json)
        })
    })
}

function latLongObj(string) {
    var values = string.split(',');

    var obj = {
        latitude: parseFloat(values[0]),
        longitude: parseFloat(values[1])
    }

    return obj
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
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}


function keyStats(data, string) {
    console.log("--- stats for " + string)

    var pop = popularity(data);

    var keyStats = {
        mostPopular: pop.most,
        leastPopular: pop.least,
        mostLiked: mostLiked(data)
    }
    return keyStats
}

function popularity(data) {
    var sorted = data.sort(function(a, b) {
        return b.media.count - a.media.count
    });

    console.log("most popular: " + sorted[0].name + ", " + sorted[0].media.count);
    console.log("least popular: " + sorted[sorted.length - 1].name + ", " + sorted[sorted.length - 1].media.count);

    var popularity = {
        most: sorted[0],
        least: sorted[sorted.length - 1]
    }
    return popularity;
}

function mostLiked(data) {
    console.log("most likes: " + data[0].name + ", " + data[0].top_posts.nodes[0].likes.count);
    return data[0];
}


// ----------- AUTHORIZE FACEBOOK GRAPH API ----------------- //

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
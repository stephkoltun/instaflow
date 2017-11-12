#Brainstorming
I had a number of ideas for this spatially-oriented data art project that I wanted to test before narrowing it down to one. 

##Invisible Cities
An installation of platonic oversized forms create an abstract environment to hear Italo Calvino's "Invisible Cities". As with many museum and gallery experiences, an indivdual audio tour device is available. Audio clips play based on an individual's position relative to others, the objects and empty space. Each 'hot spot' is associated with different clips from the text. Depending on how each person circulates through the environment and their latent interation with others, each could hear potentially a different ordering of clips. With this lack of specific order, each listener constructs their own invisible city from Calvino's text. The video below demonstrates the concept from a planametric view.

##Trace-Route Search Enginge
Building on an earlier project in Understanding Networks, I was interested in exposing the physical locations of IP address hops that every request makes before a webpage is delievered. Rather than enter a particular website address into the browser bar, this is taken as an input, and each hop is shown with the corresponding Google Streetview. As one individual continues to use this service for navigating to all websites
Notes for further exploration: how could this incorporate a map view? Could a browser extension be a way to implement the same experinece but for clicking on links on a page, rather than directly inputting a destination?

##Broadcast 2.0
Broadcast is a project I keep coming back to and am never satisfied with. The basic premise is to use proximity between two individuals to prompt the swapping of whatever music they're currently listening to. Although I've developed a prototype of it before, I looked at how the interactions would change without a map view. 

##Instagram-Directions Mashup
The idea I developed furthest in terms of technical implementation combined Instagram and directions-mapping. Given two locations, rather than returning the most optimal route, directions are routed to a number of popular Instagram destinations within a distance from the start and end points. 

###Method
The service uses a number of different APIs to gather and process data. 
1. Facebook Graph API
When the user inputs two locations, this is processed through Facebook's Graph API to find nearby places as well as to get a "Facebook ID" for the particular locations. The method returns a paginated collection of any places within a particular distance (in meters) from the supplied location. 
Strangely, when testing, I often found that specifying anything below 900m returned no results. Below is a sample output of the JSON response.

{
    "name": "New York City Halloween Parade",
    "id": "142696759079705",
    "location":
    {
        "city": "New York",
        "country": "United States",
        "latitude": 40.725358658563,
        "longitude": -74.004135274659,
        "state": "NY",
        "street": "Spring Street and 6th Ave",
        "zip": "10013"
    },
    "category_list": [
    {
        "id": "179943432047564",
        "name": "Performance & Event Venue"
    },
    {
        "id": "152880021441864",
        "name": "Community Organization"
    }]
}
Why Facebook Graph? I also looked at Foursquare's API which has a similar endpoint for nearby places. Since the Instagram scraper module required a Facebook-specific ID, as a first draft it's been easier to use the Facebook API. However, I'm interesting in seeing how different the results are between the two services.

In 2016, Instagram locked down much of their API capabilities and minimized what type of applications could access the endpoints. Fortunately, someone wrote a node module for scraping the public content and included a method searching based on Facebook's location ID of the place.

2. Insta-scraper
For the two collections of nearby places, I used the insta-scraper module to pull the most recent and most-liked photos for each location. It returns an extensions JSON object included links to the media file, ....

For the time-being, I focused on the number of posts associated with a particular place (the "count" property) and the number of likes for the top post. An aspect I've only started experimenting with is which of these places I choose to display and use as the waypoints. As a first test, out of each "nearby" collection, I used the place with the most photos as well as the place with the most likes. I also included the place with the least photos, to provide an "undiscovered" or "up-and-coming" destination. Often the place with the most number of photos is the same place as the photo with the most likes. If this was the case, I selected the place with the 

For further exploration of what places to select as waypoints, I'd like to dig into the tags as well as finding similarities across nearby places. One thing the Facebook Graph API provides is categories associated with each place. Does the user calibrate the waypoints they get back? Potential modes could include:
- FOMO: shows all the most popular, current places regardless of distance
- Before-It's-Cool: the places that have had the most rise in activity lately but aren't the top destination yet

3. Mapbox Display
purposefully ambiguous, maybe just labeled with the tags?

In further development, I'd like to incorporate more instances of finding "nearby"/additional destinations along the original route. Rather than source additional destinations based on their proximity to the start and end, if an originating route is longer than a certain distance, intermediate points could be determined to find other locations. Or, is it a chain reaction: from start to 1 nearby, then use that nearby as the input to find a new way point, and so on and son on.

I'd like to track this overtime. As I was working on it, the top places would change.
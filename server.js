var express = require("express");
var session = require("cookie-session");
var bodyParser = require("body-parser");
var app = express();
var http = require("http");
var url = require("url");
var MongoClient = require("mongodb").MongoClient;
var assert = require("assert");
var ObjectId = require("mongodb").ObjectID;
var mongourl =
  "mongodb://applenumber1:applenumber1@ds149682.mlab.com:49682/11661956";
var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var fs = require("fs");
var formidable = require("formidable");
var util = require("util");

//Restaurant Schema : Start
var restaurantSchema = new Schema({
  restaurant_id: Number,
  name: { type: String, required: true },
  borough: String,
  cuisine: String,
  photoMimetype: String,
  photo: String,
  address: [
    {
      street: String,
      building: String,
      zipcode: String,
      coord: [{ lat: Number, lon: Number }]
    }
  ],
  grades: [
    {
      user: String,
      score: Number
    }
  ],
  owner: { type: String, required: true }
});
//Restaurant Schema : End

app = express();

app.set("view engine", "ejs");

var SECRETKEY1 = "I Love Apple";
var SECRETKEY2 = "Apple Number One";

app.set("view engine", "ejs");

app.use(
  session({
    name: "session",
    keys: [SECRETKEY1, SECRETKEY2]
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

//Default Forward
app.get("/", function(req, res) {
  console.log(req.session);
  if (!req.session.authenticated) {
    res.redirect("/login");
  } else {
    res.status(200);
    res.redirect("/home");
  }
});

//Login Session : Login or Logout
app.get("/login", function(req, res) {
  res.render("login");
});

app.post("/login", function(req, res) {
  var usernameInput = req.body.name;
  var passwordInput = req.body.password;
  var userInfo = { username: usernameInput, password: passwordInput };
  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      if (!usernameInput) {
        console.log("Login: Username is not inputted");

        res.render("invalid");
        return;
      }
      db.collection("users").findOne(userInfo, function(err, result) {
        if (!err) {
          if (result) {
            console.log("User Login success");
            req.session.authenticated = true;
            req.session.username = result.username;
            res.redirect("/home");
          } else {
            console.log("Login: Invalid username or password");

            res.render("invalid");
          }
        }
        db.close();
      });
    }
  );
});

app.get("/logout", function(req, res) {
  req.session = null;
  res.redirect("/");
});

//Register
app.get("/register", function(req, res) {
  res.render("register");
});

app.post("/register", function(req, res) {
  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      var usernameInput = req.body.username;
      var passwordInput = req.body.password;
      var userInfo = { username: usernameInput, password: passwordInput };
      db.collection("users").findOne({ username: usernameInput }, function(
        err,
        result
      ) {
        if (err) throw err;
        if (result === null) {
          db.collection("users").insertOne(userInfo, function(err, res) {
            if (err) throw err;
            console.log("Register: User Registration Success!");
          });
        } else {
          console.log("Register: Failed");
        }
        db.close();
      });
    }
  );
  res.redirect("/");
});

//Home Page
app.get("/home", function(req, res) {
  console.log(req.session);
  if (!req.session.authenticated) {
    res.redirect("/login");
  } else {
    MongoClient.connect(
      mongourl,
      function(err, db) {
        assert.equal(err, null);
        console.log("Home: Connected to MongoDB\n");
        findRestaurants(db, function(restaurants) {
          db.close();
          console.log("Home: Disconnected MongoDB\n");
          res.render("home", {
            username: req.session.username,
            restaurants: restaurants
          });
          return restaurants;
        });
      }
    );
  }
});

//Display Data
app.get("/display", function(req, res) {
  if (!req.session.authenticated) {
    res.redirect("/login");
  } else {
    var _id = req.query._id;
    var ObjectId = require("mongodb").ObjectId;
    var o_id = new ObjectId(_id);
    MongoClient.connect(
      mongourl,
      function(err, db) {
        if (err) throw err;
        db.collection("restaurants").findOne({ _id: o_id }, function(
          err,
          result
        ) {
          if (!err) {
            console.log("Display: Result: ", result);
            if (result) {
              db.close();
              res.render("display", {
                result: result,
                username: req.session.username
              });
            } else {
              console.log("Display: No result");
            }
          }
          db.close();
        });
      }
    );
  }
});

//Create Restaurant
app.get("/create", function(req, res) {
  if (!req.session.username && !req.session.authenticated) {
    res.redirect("/login");
  } else {
    res.render("create");
  }
});

app.post("/create", function(req, res) {
  if (req.url == "/create" && req.method.toLowerCase() == "post") {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
      if (err) {
        console.log(err);
      }

      mongoose.connect(mongourl);
      var db = mongoose.connection;
      var name = fields.name;
      var borough = fields.borough;
      var cuisine = fields.cuisine;
      var street = fields.street;
      var building = fields.building;
      var zipcode = fields.zipcode;
      var lat = fields.lat;
      var lon = fields.lon;
      var photoMimetype = "";
      var photo = "";
      var filepath = files.photo.path;

      if (files.photo.type) {
        photoMimetype = files.photo.type;
      }

      if (files.type == "application/pdf") {
        photoMimetype = file.type;
        filepath = files.path;
      }

      fs.readFile(filepath, function(err, data) {
        photo = new Buffer(data).toString("base64");
      });

      db.on("error", console.error.bind(console, "connection error:"));
      db.once("open", function(callback) {
        var Restaurant = mongoose.model("Restaurant", restaurantSchema);
        var newRestaurant = new Restaurant({
          name: name,
          borough: borough,
          cuisine: cuisine,
          photo: photo,
          photoMimetype: photoMimetype,
          address: [
            {
              street: street,
              building: building,
              zipcode: zipcode,
              coord: [{ lat: lat, lon: lon }]
            }
          ],
          owner: req.session.username
        });

        newRestaurant.validate(function(err) {
          console.log(err);
        });

        newRestaurant.save(function(err, restaurantCreated) {
          if (err) {
            db.close();
            res.redirect("/createFailed");
          } else {
            console.log("New restaurant created!");

            db.close();
            res.redirect("/home");
          }
        });
      });
    });
    return;
  }
});

//Searching
app.get("/search", function(req, res) {
  if (!req.session.username && !req.session.authenticated) {
    res.redirect("/login");
  } else {
    res.render("search");
  }
});

app.get("/searchByKeyword", function(req, res) {
  var keyword = req.query.keyword;
  var output = null;
  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      db.collection("restaurants").ensureIndex({ "$**": "text" }, function(
        err,
        result
      ) {
        console.log("Result", result);
      });
      db.collection("restaurants")
        .find({ $text: { $search: keyword, $caseSensitive: false } })
        .toArray(function(err, docs) {
          assert.equal(err, null);

          if (docs) {
            res.render("searchResult", { docs: docs });
          }
          db.close();
        });
    }
  );
});

//Rating
app.get("/rate", function(req, res) {
  var _id = req.query._id;
  var ObjectId = require("mongodb").ObjectId;
  var o_id = new ObjectId(_id);
  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      db.collection("restaurants").findOne({ _id: o_id }, function(
        err,
        result
      ) {
        if (!err) {
          if (result) {
            var gradesArr = result.grades;
            var name = req.session.username;
            db.close();
            if (gradesArr.length == 0) {
              res.render("rate", { username: req.session.username, _id: _id });
            } else {
              for (var i = 0; i < gradesArr.length; i++) {
                if (gradesArr[i].user == name) {
                  res.render("rateFailed");
                }
              }
              res.render("rate", {
                username: req.session.username,
                _id: _id
              });
            }
          } else {
            console.log("Rating: No result");
          }
        }
        db.close();
      });
    }
  );
});

app.post("/rate", function(req, res) {
  var _id = req.query._id;
  var ObjectId = require("mongodb").ObjectId;
  var o_id = new ObjectId(_id);
  var form = new formidable.IncomingForm();
  var rate;
  form.parse(req, function(err, fields) {
    rate = fields.rate;
  });
  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      var gradeObj = {};
      gradeObj.user = req.query.rater;
      gradeObj.score = rate;

      db.collection("restaurants").update(
        { _id: o_id },
        { $push: { grades: gradeObj } },
        function(err, result) {
          if (err) {
            console.log("Rating: Error when updating object: " + err);

            res.render("ratedFailed");
          } else {
            console.log("Rating: Success!");

            var redirectURL = "/display?_id=" + _id;
            res.redirect(redirectURL);
          }
          db.close();
        }
      );
    }
  );
});

//DeleteData
app.get("/delete", function(req, res) {
  var _id = req.query._id;
  var ObjectId = require("mongodb").ObjectId;
  var o_id = new ObjectId(_id);
  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      findRestaurantsWithCriteria(db, o_id, function(restaurant) {
        if (restaurant[0].owner == req.session.username) {
          db.collection("restaurants").remove({ _id: o_id });
          console.log("Deleted: Success!");

          res.render("deleteSuccess");
        } else {
          console.log("Delete: Failed");
          res.render("deleteFailed");
        }
        db.close();
      });
    }
  );
});

//Editing
app.get("/edit", function(req, res) {
  var _id = req.query._id;
  var ObjectId = require("mongodb").ObjectId;
  var o_id = new ObjectId(_id);
  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      db.collection("restaurants").findOne({ _id: o_id }, function(
        err,
        result
      ) {
        if (!err) {
          if (result) {
            db.close();

            if (result.owner == req.session.username) {
              console.log("req.session.username == owner");
              res.render("edit", { result: result });
            } else {
              console.log("req.session.username != owner");
              res.render("notAuthorized");
            }
          } else {
            console.log("Editing: No Result");

            res.render("error", { err: err });
          }
        }
        db.close();
      });
    }
  );
});

app.post("/edit", function(req, res) {
  var _id = req.query._id;
  var ObjectId = require("mongodb").ObjectId;
  var o_id = new ObjectId(_id);

  if (req.url.startsWith("/edit") && req.method.toLowerCase() == "post") {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
      if (err) {
        console.log(err);
      }
      mongoose.connect(mongourl);
      var db = mongoose.connection;
      var name = fields.name;
      var borough = fields.borough;
      var cuisine = fields.cuisine;
      var street = fields.street;
      var building = fields.building;
      var zipcode = fields.zipcode;
      var lat = fields.lat;
      var lon = fields.lon;
      var photo = "";
      var filename = files.photo.path;
      var photoMimetype = "";

      if (files.photo.type) {
        photoMimetype = files.photo.type;
      }

      if (photoMimetype != "application/octet-stream") {
        fs.readFile(filename, function(err, data) {
          photo = new Buffer(data).toString("base64");
        });
      }

      db.on("error", console.error.bind(console, "Editing: Connection error:"));
      db.once("open", function(callback) {
        var Restaurants = mongoose.model("Restaurants", restaurantSchema);
        if (photo == null || photo == "" || photo == undefined) {
          console.log("Editing: Photo no need to update");
          Restaurants.updateOne(
            { _id: o_id },
            {
              $set: {
                name: name,
                borough: borough,
                cuisine: cuisine,
                photoMimetype: photoMimetype,
                address: [
                  {
                    street: street,
                    building: building,
                    zipcode: zipcode,
                    coord: [{ lat: lat, lon: lon }]
                  }
                ]
              }
            },
            function(err) {
              if (err) {
                console.log(err);

                res.render("error", { err: err });
              }
              res.redirect("/display?_id=" + _id);
              console.log("Editing: Update Completed!");
            }
          );
        } else {
          console.log("Editing: photo changed");
          Restaurants.updateOne(
            { _id: o_id },
            {
              $set: {
                name: name,
                borough: borough,
                cuisine: cuisine,
                photoMimetype: photoMimetype,
                photo: photo,
                address: [
                  {
                    street: street,
                    building: building,
                    zipcode: zipcode,
                    coord: [{ lat: lat, lon: lon }]
                  }
                ]
              }
            },
            function(err) {
              if (err) {
                console.log(err);

                res.render("error", { err: err });
              }
              res.redirect("/display?_id=" + _id);
              console.log("Edited: Update Success!\n");
            }
          );
        }
      });
    });
    return;
  }
});

//Google Map
app.get("/map", function(req, res) {
  res.render("gmap", {
    lat: req.query.lat,
    lon: req.query.lon
  });
  res.end();
});

app.get("/secrets", function(req, res) {
  if (!req.session.username && !req.session.authenticated) {
    res.redirect("/login");
  } else {
    res.render("secrets");
  }
});

function findRestaurants(db, callback) {
  var restaurants = [];
  cursor = db.collection("restaurants").find();
  cursor.each(function(err, doc) {
    assert.equal(err, null);
    if (doc != null) {
      restaurants.push(doc);
    } else {
      callback(restaurants);
    }
  });
}

function findRestaurantsWithCriteria(db, criteria, callback) {
  var restaurants = [];
  cursor = db.collection("restaurants").find(criteria);
  cursor.each(function(err, doc) {
    assert.equal(err, null);
    if (doc != null) {
      restaurants.push(doc);
    } else {
      callback(restaurants);
    }
  });
}

//API
app.get("/api/restaurant/name/:name", function(req, res) {
  var criteria = { name: req.params.name };

  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      findRestaurantsWithCriteria(db, criteria, function(restaurant) {
        if (restaurant.length > 0) {
          res.status(200).json(restaurant).end;
        } else {
          res.status(200).json({}).end;
        }
        db.close();
      });
    }
  );
});

app.get("/api/restaurant/borough/:borough", function(req, res) {
  var criteria = { borough: req.params.borough };

  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      findRestaurantsWithCriteria(db, criteria, function(restaurant) {
        if (restaurant.length > 0) {
          res.status(200).json(restaurant).end;
        } else {
          res.status(200).json({}).end;
        }
        db.close();
      });
    }
  );
});

app.get("/api/restaurant/cuisine/:cuisine", function(req, res) {
  var criteria = { cuisine: req.params.cuisine };

  MongoClient.connect(
    mongourl,
    function(err, db) {
      if (err) throw err;
      findRestaurantsWithCriteria(db, criteria, function(restaurant) {
        if (restaurant.length > 0) {
          res.status(200).json(restaurant).end;
        } else {
          res.status(200).json({}).end;
        }
        db.close();
      });
    }
  );
});

app.post("/api/restaurant", function(req, res) {
  mongoose.connect(mongourl);
  var db = mongoose.connection;
  var name = req.body.name;
  var owner = req.body.user;
  var borough = req.body.borough;
  var cuisine = req.body.cuisine;
  var street = req.body.street;
  var building = req.body.building;
  var zipcode = req.body.zipcode;
  var lat = req.body.lat;
  var lon = req.body.lon;
  var photoMimetype = "";
  var photo = "";

  db.on("error", console.error.bind(console, "connection error:"));
  db.once("open", function(callback) {
    var Restaurant = mongoose.model("Restaurant", restaurantSchema);
    var newRestaurant = new Restaurant({
      name: name,
      borough: borough,
      cuisine: cuisine,
      photo: photo,
      photoMimetype: photoMimetype,
      address: [
        {
          street: street,
          building: building,
          zipcode: zipcode,
          coord: [{ lat: lat, lon: lon }]
        }
      ],
      owner: owner
    });

    newRestaurant.validate(function(err) {
      console.log(err);
    });

    newRestaurant.save(function(err, restaurantCreated) {
      if (err) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.write(JSON.stringify({ status: "failed" }));
        db.close();
      } else {
        res.status(200).json({ status: "ok", _id: restaurantCreated._id });
        db.close();
      }
    });
  });
});

app.listen(process.env.PORT || 8099);

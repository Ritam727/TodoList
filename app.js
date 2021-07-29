require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth20').Strategy

const app = express()
app.use(express.urlencoded({extended: true}))
app.use(express.static(__dirname+'/public'))
app.set('view engine', 'ejs')
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

const optionsForMongoose = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true
}
mongoose.connect(process.env.MONGODB_URL, optionsForMongoose)

const itemSchema = new mongoose.Schema({
    text: String
})
itemSchema.plugin(passportLocalMongoose)
const Item = new mongoose.model('item', itemSchema)

const userItemSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleId: String,
    items: [itemSchema]
})
userItemSchema.plugin(passportLocalMongoose)

const User = new mongoose.model('user', userItemSchema)
passport.use(User.createStrategy())
passport.serializeUser(function(user, done) {
    done(null, user.id)
})
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user)
    })
})
passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    function(accessToken, refreshToken, profile, cb) {
        User.findOne({googleId: profile.id}, function(err, user) {
            if(!err) {
                if(user) {
                    return cb(null, user)
                } else {
                    const newUser = new User({
                        username: profile.emails[0].value,
                        googleId: profile.id
                    })
                    User.create(newUser, function(error) {
                        if(error) {
                            console.log(error)
                        } else {
                            return cb(null, newUser)
                        }
                    })
                }
            } else {
                console.log(err)
            }
        })
    })
)

app.get('/', function(req, res) {
    if(req.isAuthenticated()) {
        User.findById(req.user.id, function(err, user) {
            if(!err) {
                if(user) {
                    res.render('list', {
                        listItems: user.items
                    })
                } else {
                    console.log('User not found')
                    res.redirect('/register')
                }
            } else {
                res.redirect('/login')
            }
        })
    } else {
        res.redirect('/logorreg')
    }
})

app.get('/login', function(req, res) {
    res.render('login', {
        text: ""
    })
})

app.get('/loginfailure', function(req, res) {
    res.render('login', {
        text: "*Invalid Email or Password"
    })
})

app.get('/register', function(req, res) {
    res.render('register')
})

app.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }))

app.get('/auth/google/todolist', passport.authenticate('google', { failureRedirect: '/login' }), function(req, res) {
    res.redirect('/')
})

app.get('/logorreg', function(req, res) {
    res.render('option')
})

app.post('/login', function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })
    req.login(user, function(err) {
        if(err) {
            res.redirect('/login')
        } else {
            passport.authenticate('local', {failureRedirect: '/loginfailure'})(req, res, function() {
                res.redirect('/')
            })
        }
    })
})

app.post('/register', function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if(err) {
            console.log('Couldn\'t register')
            console.log(err)
            res.redirect('/register')
        } else {
            passport.authenticate('local')(req, res, function() {
                res.redirect('/')
            })
        }
    })
})

app.post('/', function(req, res) {
    User.findById(req.user.id, function(err, user) {
        if(!err) {
            if(user) {
                const item = new Item({
                    text: req.body.newListItem
                })
                user.items.push(item)
                user.save()
                res.redirect('/')
            }
        } else {
            res.send(err)
        }
    })
})

app.post('/delete', function(req, res) {
    User.findByIdAndUpdate(req.user.id, {$pull: {items: {_id: req.body.elemID}}}, function(err, result) {
        if(!err) {
            res.redirect('/')
        } else {
            console.log(err)
            res.redirect('/')
        }
    })
})

app.post('/logout', function(req, res) {
    req.logout()
    res.redirect('/')
})

app.listen(process.env.PORT || 3000, function() {
    console.log("Successfully started server")
})
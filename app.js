const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./config/db');
const bcrypt = require('bcrypt');

const app = express();

app.use(session({
    
    secret: 'start123',
    resave: false,
    saveUninitialized: false

}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true}));
app.use(express.json());

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {

    res.render('login');

})

app.post('/login', async (req, res) => {
    const {username, password } = req.body;

    try {
        const [rows] = await db.execute('Select * from user WHERE name = ?', [username]);
        if (rows.length === 0) {
            return res.render('login', {error: 'Ungültige Zugangsdaten'});
        }

        const user = row[0];

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.render('login', {error: 'Ungültige Zugangsdaten'});
        }
    
    req.session.user = {id: user.id, name: user.name};
    res.redirect('/profil');
}catch (err) {
    console.error(err);
    res.render('login', {error: 'Ein Fehler ist aufgetreten'});
}
});

app.post('/login', (req, res) => {
    const {username, password} = req.body;
    if (username === 'user' && password === 'pass') {
        req.session.user = { username };
        res.redirect('/profil');
    } else {
        res.render('login', { error: 'Ungültige Zugangsdaten'});
    }

});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const {username, password} = req.body;
    console.log('Neuer Benutzer registriert:', username);
    res.redirect('/login');
});



app.get('/profil', (req, res) => {

    const dummyUser = {
        name: "John Doe",
        birthday: "01.01.1990",
        gender: "männlich"
    };
    res.render('profil', { user: dummyUser });
});

app.get('/people', (req, res) => {
    const randomProfile = {
        name: 'John Doe',
        age: 28,
        imageUrl: 'https://example.com/path/to/avatar.jpg'
    };
    res.render('people', {profile: randomProfile});
});

app.get('/filter', (req, res) => {
    res.render('filter');
});

app.post('/filter', (req, res) => {
    const {genderPreference, minAge, maxAge } = req.body;
    console.log('Gespeicherte Filter:', genderPreference, minAge, maxAge);
    res.redirect('/people');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Läuft auf Port ${PORT}`);
});

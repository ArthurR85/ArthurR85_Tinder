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

        const user = rows[0];

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

/*app.post('/login', (req, res) => {
    const {username, password} = req.body;
    if (username === 'user' && password === 'pass') {
        req.session.user = { username };
        res.redirect('/profil');
    } else {
        res.render('login', { error: 'Ungültige Zugangsdaten'});
    }

});*/

app.post ('/like', async (req, res) => {
    if(!req.session.user) return res.status(401).send('Nicht autorisiert');

    const likerID = req.session.user.id;
    const {liked_id} =req.body;

    try {
        await db.execute('INSERT INTO liker_id, liked_id) VALUES (?, ?)', [likerID, liked_id]);

        const [rows] = await db.execute('SELECT * FROM likes WHERE liker_id = ? AND liked_id = ?' [liked_id, likerID] );
        
        if (rows.length > 0) {
            const user1_id = Math.min(likerID, liked_id);
            const user2_id = Math.max(likerID, liked_id);

            await db.execute('INSERT IGNORE INTO matches (user1_id, user2_id) VALUES (?,?)', [user1_id, user2_id]);
        }
        res.joson({success: true});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Fehler beim Verarbeiten des Likes'});
    }
});

app.get('/matches', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const userId = req.session.user.id;

    try {
        const [matches] = await db.execute(
            'SELECT m.id, u.name, u.image_url, m.matched_at ' + 'FROM matches m ' +
            'JOIN user u ON (u.id = CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END) ' +
            'WHERE m.user1_id = ? OR m.user2_id = ?',
            [userId, userId, userId]
        );
        res.render('matches', { matches });
    } catch (err) {
        console.error(err);
        res.render('matches', { error: 'Fehler beim Laden der Matches' });
    }
});


app.get ('/api/random', async (req, res ) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, name, TIMESTAMPDIFF(YEAR, birthday, CURDATE()) AS age, gender image_url FROM user ORDER BY RAND() LIMIT 1');
            if (rows.length === 0) {
                return res.status(404).json({error: 'Kein Profil gefunden' });
            }
            res.json(rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'FEhler beim Laden des Profils'});
        }
});



app.get('/register', (req, res) => {
    res.render('register');
});

app.post ('/register', async (req, res) => {
    const {username, password, confirmPassword, linkPicture, gender, birthday } = req.body;

    if (password !== confirmPassword) {
        return res.render('register', { error: 'Die Passwörter stimmen nicht überein'});
            }

        try {
            const [existingUser] = await db.execute('Select * from user Where name = ?', [username]);
            if (existingUser.length > 0){
                return res.render('register', { error: 'Der Benutzername ist bereits vergeben'});
            }

            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            const [result] = await db.execute(
                'INSERT INTO user (name, gender, birthday, image_url, password_hash, password) VALUES (?,?,?, ?, ?, ?)',
                [username, gender, birthday, linkPicture,  passwordHash, password]
            );

            console.log('Neuer Benutzer registriert, ID:', result.insertId);
            res.redirect('/login');
        } catch (err) {
            console.error(err);
            res.render('register', {error: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut'});
    }
});


/*app.post('/register', (req, res) => {
    const {username, password} = req.body;
    console.log('Neuer Benutzer registriert:', username);
    res.redirect('/login');
});*/



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

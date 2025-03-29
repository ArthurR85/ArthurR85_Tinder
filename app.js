const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./config/db');
const bcrypt = require('bcrypt');
const expressLayouts = require('express-ejs-layouts');

const app = express();

app.use(expressLayouts);
app.set('layout', 'layout');



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
        await db.execute('INSERT INTO likes (liker_id, liked_id) VALUES (?, ?)', [likerID, liked_id]);


        const [rows] = await db.execute('SELECT * FROM likes WHERE liker_id = ? AND liked_id = ?', [liked_id, likerID]);

        
        if (rows.length > 0) {
            const user1_id = Math.min(likerID, liked_id);
            const user2_id = Math.max(likerID, liked_id);

            await db.execute('INSERT IGNORE INTO matches (user1_id, user2_id) VALUES (?,?)', [user1_id, user2_id]);
        }
        res.json({success: true});
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
            'SELECT id, name, TIMESTAMPDIFF(YEAR, birthday, CURDATE()) AS age, gender, image_url FROM user ORDER BY RAND() LIMIT 1');
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



/*app.get('/profil', (req, res) => {

    const dummyUser = {
        name: "John Doe",
        birthday: "01.01.1990",
        gender: "männlich",
        image_url: "https://xsgames.co/randomusers/assets/avatars/male/74.jpg"
    };
    res.render('profil', { user: dummyUser });
});*/

app.get('/people', async (req, res) => {
    let query = 'SELECT id, name, TIMESTAMPDIFF(YEAR, birthday, CURDATE()) AS age, gender, image_url FROM user';
    const params = [];
    let filterActive = false;
    if (req.session.filter) {
        const { genderPreference, minAge, maxAge } = req.session.filter;
        const conditions = [];
        if (genderPreference) {
            conditions.push('gender = ?');
            params.push(genderPreference);
        }
        if (minAge) {
            conditions.push('TIMESTAMPDIFF(YEAR, birthday, CURDATE()) >= ?');
            params.push(Number(minAge));
        }
        if (maxAge) {
            conditions.push('TIMESTAMPDIFF(YEAR, birthday, CURDATE()) <= ?');
            params.push(Number(maxAge));
        }
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
            filterActive = true;
        }
    }
    query += ' ORDER BY RAND() LIMIT 1';
    
    console.log("Filter Query:", query, "Params:", params);
    try {
        const [rows] = await db.execute(query, params);
        const randomProfile = rows[0] || {};
        res.render('people', { profile: randomProfile, filterActive });
    } catch (err) {
        console.error(err);
        res.render('people', { error: 'Fehler beim Laden der Profile', profile: {}, filterActive });
    }
});




app.get('/filter', (req, res) => {
    res.render('filter', {error: null});
});

app.post('/filter', (req, res) => {
    const { genderPreference, minAge, maxAge } = req.body;
    req.session.filter = { genderPreference, minAge, maxAge };
    res.redirect('/people');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Läuft auf Port ${PORT}`);
});

app.get('/profil', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
  
    const userId = req.session.user.id;
    try {
      const [rows] = await db.execute('SELECT name, birthday, gender, image_url FROM user WHERE id = ?', [userId]);
      if (rows.length === 0) return res.redirect('/login');
      const user = rows[0];
      res.render('profil', { user });
    } catch (err) {
      console.error(err);
      res.render('profil', { error: 'Fehler beim Laden deines Profils' });
    }
  });

app.get('/profil/edit', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const userId = req.session.user.id;
    try {
      const [rows] = await db.execute('SELECT name, birthday, gender, image_url FROM user WHERE id = ?', [userId]);
      console.log("GET /profil/edit:", rows);
      if (rows.length === 0) {
        return res.redirect('/login');
      }
      const user = rows[0];
      res.render('profil_edit', { user });
    } catch (err) {
      console.error(err);
      res.render('profil_edit', { error: 'Fehler beim Laden deines Profils' });
    }
  });
  
  
  app.post('/profil/edit', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Nicht autorisiert');
  const userId = req.session.user.id;
  const { name, birthday, gender, image_url } = req.body;
  try {
    await db.execute(
      'UPDATE user SET name = ?, birthday = ?, gender = ?, image_url = ? WHERE id = ?',
      [name, birthday, gender, image_url, userId]
    );
    
    req.session.user.name = name;
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren deines Profils' });
  }
});

app.get('/api/random', async (req, res) => {
    let query = 'SELECT id, name, TIMESTAMPDIFF(YEAR, birthday, CURDATE()) AS age, gender, image_url FROM user';
    const params = [];
    
    if (req.session.filter) {
      const { genderPreference, minAge, maxAge } = req.session.filter;
      const conditions = [];
      if (genderPreference) {
        conditions.push('gender = ?');
        params.push(genderPreference);
      }
      if (minAge) {
        conditions.push('TIMESTAMPDIFF(YEAR, birthday, CURDATE()) >= ?');
        params.push(Number(minAge));
      }
      if (maxAge) {
        conditions.push('TIMESTAMPDIFF(YEAR, birthday, CURDATE()) <= ?');
        params.push(Number(maxAge));
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }
    
    query += ' ORDER BY RAND() LIMIT 1';
    
    try {
      const [rows] = await db.execute(query, params);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Kein passendes Profil gefunden' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Fehler beim Laden des Profils' });
    }
  });
  
  app.get('/filter/deactivate', (req, res) => {
    req.session.filter = null;
    res.redirect('/people');
});


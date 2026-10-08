const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3000;
const FILE_PATH = './baza.json';

app.use(express.json());
app.use(express.static('.'));

function wczytajDane() {
    if (!fs.existsSync(FILE_PATH)) return [];
    const rawData = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(rawData || '[]');
}

function zapiszDane(dane) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(dane, null, 2), 'utf-8');
}

// Walidacja danych gry (POST i PUT) - zwraca komunikat błędu lub null
function walidujGre(dane, gry, idEdytowanej = null) {
    const { tytul, cena, rok, ocena } = dane;
    const biezacyRok = new Date().getFullYear();

    if (typeof tytul !== 'string' || tytul.trim().length < 2 || tytul.trim().length > 50) {
        return "Błąd 400: Tytuł musi mieć od 2 do 50 znaków.";
    }
    const tytulMaly = tytul.trim().toLowerCase();
    if (gry.some(g => g.id !== idEdytowanej && g.tytul.trim().toLowerCase() === tytulMaly)) {
        return `Błąd 400: Gra o tytule "${tytul.trim()}" już istnieje w bazie.`;
    }
    if (typeof cena !== 'number' || cena <= 0) {
        return "Błąd 400: Cena musi być liczbą większą od 0.";
    }
    if (!Number.isInteger(rok) || rok < 1970 || rok > biezacyRok) {
        return `Błąd 400: Rok wydania musi mieścić się w przedziale 1970-${biezacyRok}.`;
    }
    if (!Number.isInteger(ocena) || ocena < 1 || ocena > 10) {
        return "Błąd 400: Ocena musi być liczbą całkowitą z przedziału 1-10.";
    }
    return null;
}

// 1. Pobieranie gier + filtrowanie po platformie (Zadanie A) i wyszukiwanie po tytule
app.get('/api/gry', (req, res) => {
    let gry = wczytajDane();
    const { platforma, szukaj } = req.query;

    if (platforma) {
        gry = gry.filter(g => g.platforma.toLowerCase() === platforma.toLowerCase());
    }

    if (szukaj) {
        gry = gry.filter(g => g.tytul.toLowerCase().includes(szukaj.toLowerCase()));
    }

    res.status(200).json(gry);
});

// 2. Statystyki w czasie rzeczywistym (Zadanie B)
app.get('/api/statystyki', (req, res) => {
    const gry = wczytajDane();
    if (gry.length === 0) {
        return res.json({ iloscGier: 0, sredniaCena: 0, sredniaOcena: 0 });
    }

    const iloscGier = gry.length;
    const sumaCen = gry.reduce((sum, g) => sum + g.cena, 0);
    const sredniaCena = (sumaCen / iloscGier).toFixed(2);

    const oceny = gry.filter(g => typeof g.ocena === 'number').map(g => g.ocena);
    const sredniaOcena = oceny.length > 0 ? (oceny.reduce((sum, o) => sum + o, 0) / oceny.length).toFixed(2) : 0;

    res.json({
        iloscGier: iloscGier,
        sredniaCena: parseFloat(sredniaCena),
        sredniaOcena: parseFloat(sredniaOcena)
    });
});

// 3. Pobieranie po ID
app.get('/api/gry/:id', (req, res) => {
    const gry = wczytajDane();
    const id = parseInt(req.params.id);
    const gra = gry.find(g => g.id === id);

    if (!gra) {
        return res.status(404).json({ komunikat: `Błąd 404: Nie odnaleziono gry o ID ${id}` });
    }

    res.status(200).json(gra);
});

// 4. Dodawanie nowej gry (Zadanie C - dodano walidację pola 'rok')
app.post('/api/gry', (req, res) => {
    const gry = wczytajDane();
    const { tytul, platforma, cena, rok, ocena } = req.body;

    const blad = walidujGre(req.body, gry);
    if (blad) {
        return res.status(400).json({ komunikat: blad });
    }

    const unikalneId = gry.length > 0 ? Math.max(...gry.map(g => g.id)) + 1 : 1;
   
    const rekordDoZapisu = {
        id: unikalneId,
        tytul: tytul.trim(),
        platforma: platforma ? platforma.trim() : "PC",
        cena: cena,
        rok: rok,
        ocena: ocena
    };

    gry.push(rekordDoZapisu);
    zapiszDane(gry);

    res.status(201).json({
        komunikat: "Gra została pomyślnie dodana",
        gra: rekordDoZapisu
    });
});

// 5. Pełna edycja gry PUT (Zadanie C - obsługa pola 'rok')
app.put('/api/gry/:id', (req, res) => {
    const gry = wczytajDane();
    const id = parseInt(req.params.id);
    const index = gry.findIndex(g => g.id === id);

    if (index === -1) {
        return res.status(404).json({ komunikat: `Błąd 404: Nie odnaleziono gry o ID ${id}` });
    }

    const { tytul, platforma, cena, rok, ocena } = req.body;

    const blad = walidujGre(req.body, gry, id);
    if (blad) {
        return res.status(400).json({ komunikat: blad });
    }

    gry[index] = {
        id: id,
        tytul: tytul.trim(),
        platforma: platforma ? platforma.trim() : "PC",
        cena: cena,
        rok: rok,
        ocena: ocena
    };

    zapiszDane(gry);

    res.status(200).json({
        komunikat: `Zaktualizowano dane gry o ID ${id}`,
        gra: gry[index]
    });
});

// 6. Usuwanie gry
app.delete('/api/gry/:id', (req, res) => {
    const gry = wczytajDane();
    const id = parseInt(req.params.id);
    const index = gry.findIndex(g => g.id === id);

    if (index === -1) {
        return res.status(404).json({ komunikat: `Błąd 404: Nie odnaleziono gry o ID ${id}` });
    }

    gry.splice(index, 1);
    zapiszDane(gry);

    res.status(200).json({ komunikat: `Gra o ID ${id} została trwale usunięta.` });
});

app.listen(PORT, () => {
    console.log(`Serwer API uruchomiony na http://localhost:${PORT}`);
});
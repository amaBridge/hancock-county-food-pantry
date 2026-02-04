const express = require('express');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const fs = require('fs');
const path = require('path');

// Middleware to parse JSON bodies
app.use(express.json());

// Serve the static HTML app from the project root.
// This allows opening http://localhost:3000/index.html (and related pages)
// while keeping the JSON API routes below.
app.use(express.static(__dirname));

// Path to the JSON file
const dataFilePath = path.join(__dirname, 'data.json');

// Function to read data from the JSON file
function readData() {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(data);
}

// Function to write data to the JSON file
function writeData(newData) {
    fs.writeFileSync(dataFilePath, JSON.stringify(newData, null, 2), 'utf8');
}

// Default route: load the Home page.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check route
app.get('/health', (req, res) => {
    res.type('text/plain').send('OK');
});

// Route to get all donations
app.get('/donations', (req, res) => {
    try {
        const data = readData();
        res.json(data.donations || []);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error reading data' });
    }
});

// Route to add a new donation
app.post('/donations', (req, res) => {
    const { donor_name, amount } = req.body;
    try {
        const data = readData();
        const newDonation = {
            id: data.donations.length + 1,
            donor_name,
            amount,
            date: new Date().toISOString()
        };
        data.donations.push(newDonation);
        writeData(data);
        res.status(201).json({ message: 'Donation added successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error writing data' });
    }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
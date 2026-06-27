// root-cause: intentional-flaw fixture for multi-llm-review E2E demo (not production code)
// Sample service with deliberate, verifiable defects so reviewers have real findings.
const express = require('express');
const mysql = require('mysql');

// FLAW 1 (security): hardcoded credential
const DB_PASSWORD = "P@ssw0rd123!";

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: DB_PASSWORD,
});

function getUser(req, res) {
  const id = req.query.id;
  // FLAW 2 (security): SQL injection via string concatenation
  const query = "SELECT * FROM users WHERE id = " + id;
  db.query(query, (err, rows) => {
    // FLAW 3 (reliability): err ignored; rows may be undefined
    res.json(rows[0]);
  });
}

function applyDiscount(price, percent) {
  // FLAW 4 (logic): percent is a whole number; should divide by 100
  return price - (price * percent);
}

const app = express();
app.get('/user', getUser);
app.listen(3000);

module.exports = { getUser, applyDiscount };

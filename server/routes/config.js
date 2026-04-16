const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  const teamId = process.env.TEAM_ID || '';
  const teamName = process.env.TEAM_NAME || 'Mein Team';
  res.json({ teamId, teamName });
});

module.exports = router;

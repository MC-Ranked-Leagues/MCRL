-- League 7 was retired. Its remaining players continue in League 6, the same
-- way a League 7 promotion did, so their (unused) history is cleared.
UPDATE `players` SET `league_number` = 6, `placements` = '[]' WHERE `league_number` = 7;

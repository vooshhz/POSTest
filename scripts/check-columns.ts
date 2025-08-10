// check-columns.ts
import * as fs from 'fs';
import Papa from 'papaparse';

const csvFile = fs.readFileSync('LiquorDatabase.csv', 'utf8');

const { data } = Papa.parse(csvFile, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,
  preview: 1  // Just get first row
});

console.log('CSV Column Names:');
console.log(Object.keys(data[0]));

console.log('\nFirst row sample:');
console.log(data[0]);
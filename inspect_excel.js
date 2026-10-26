const XLSX = require('xlsx');
const fs = require('fs');

const files = [
  'mass_update_basic_info_381421545_20260911100357.xlsx',
  'mass_update_sales_info_381421545_20260911100617.xlsx',
  'mass_update_shipping_info_381421545_20260911100313.xlsx',
  'mass_update_media_info_381421545_20260911100714.xlsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const wb = XLSX.readFile(f);
    console.log("=== FILE:", f, "Sheets:", wb.SheetNames);
    wb.SheetNames.forEach(s => {
      const ws = wb.Sheets[s];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      console.log("  Sheet:", s, "Total rows:", rows.length);
      for (let i = 0; i < Math.min(6, rows.length); i++) {
        console.log(`    Row ${i}:`, rows[i].slice(0, 8));
      }
    });
  }
});

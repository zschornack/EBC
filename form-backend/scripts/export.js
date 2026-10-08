import { allSubmissions } from '../src/db.js';
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const cols = ['id', 'created_at', 'form_type', 'email', 'source', 'email_status', 'data'];
console.log(cols.join(','));
for (const r of allSubmissions()) console.log(cols.map((c) => q(r[c])).join(','));

import csv,json,pathlib
src=pathlib.Path('/mnt/data/sumida_phase1/store_import_candidates.csv')
out=pathlib.Path(__file__).parent
with src.open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
for r in rows:
 r['area']=''
 a=r['address']
 if a.startswith('墨田区'): a=a[3:]
 import re
 m=re.match(r'^([^\d０-９\-－ー丁目番地号\s]+)',a)
 if m:r['area']=m.group(1)
(out/'stores.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(len(rows),len(set(r['area'] for r in rows)))

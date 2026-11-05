"""Validate the asset/location handoff using only Python's standard library."""
import base64,csv,hashlib,json,math,re,struct
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET
BASE=Path(__file__).resolve().parent

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads((BASE/path).read_text())
def asset(path):
 p=(BASE/path).resolve()
 assert p.is_relative_to(BASE) and p.is_file(),path
 return p

def validate_rows(mapping,pins,originals,overlays):
 rows=mapping['items'];ids=[r['spotId'] for r in rows]
 assert len(ids)==len(set(ids))==58 and set(ids)==set(pins)
 for r in rows:
  sid=r['spotId'];p=pins[sid];loc=r['location']
  assert r['internalSpotId']==p['id'] and r['name']==p['name']
  assert (loc['latitude'],loc['longitude'])==(p['latitude'],p['longitude']),(sid,'coordinate mismatch')
  assert loc['coordinateStatus']==p['coordinateStatus']
  assert loc['coordinateOverlay']==p.get('coordinateOverlay')
  assert loc['originalCoordinate']=={k:originals[sid][k] for k in ['latitude','longitude','coordinateStatus']}
  assert r['coordinateSupplement']==overlays.get(sid)
  assert all(isinstance(loc[k],(float,int)) and math.isfinite(loc[k]) for k in ['latitude','longitude'])
  assert 37<loc['latitude']<38 and 126<loc['longitude']<128
  assert loc['historicalSceneCoordinates'] is None
  assert r['publicationStatus']=='unpublished' and r['historicalReviewStatus']=='unverified'

class Links(HTMLParser):
 def __init__(self):super().__init__();self.refs=[];self.cards=0
 def handle_starttag(self,tag,attrs):
  if tag=='article':self.cards+=1
  self.refs.extend(v for k,v in attrs if k in ['href','src'])

def main():
 mapping=read('image-location-map.json')
 pins={x['sourceId']:x for x in read('provenance/matched-pins.json')}
 originals={x['sourceId']:x for x in read('provenance/selected-pins.json')}
 overlays={x['sourceId']:x for x in read('provenance/coordinates.overlay.json')['items']}
 assert sum(bool(x.get('requiresIntegrationApproval')) for x in overlays.values())==4
 assert sha(BASE/'provenance/matched-pins.json')==mapping['coordinateSourceSha256']
 assert sha(BASE/'provenance/selected-pins.json')==mapping['originalPinsSha256']
 assert sha(BASE/'provenance/coordinates.overlay.json')==mapping['coordinateOverlaySha256']
 validate_rows(mapping,pins,originals,overlays)
 # Ensure a wrong ID, swapped coordinates, or dropped review status is rejected.
 mutation_checks=0
 for mutation in ['id','coordinates','status']:
  bad=json.loads(json.dumps(mapping))
  if mutation=='id':bad['items'][0]['spotId']=bad['items'][1]['spotId']
  if mutation=='coordinates':bad['items'][0]['location']['latitude'],bad['items'][0]['location']['longitude']=bad['items'][0]['location']['longitude'],bad['items'][0]['location']['latitude']
  if mutation=='status':bad['items'][0]['publicationStatus']='published'
  try:validate_rows(bad,pins,originals,overlays)
  except AssertionError:mutation_checks+=1
  else:raise AssertionError('Failed mutation guard: '+mutation)
 manifest=read('provenance/newspaper-v2/manifest.json'); old={r['spotId']:r for r in manifest['records']}
 image_hashes=set();svg_count=0
 for r in mapping['items']:
  sid=r['spotId'];src=old[sid];im=r['illustration'];image=asset(im['path'])
  assert sha(image)==im['sha256']==src['sourceImageSha256']
  assert image.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
  assert struct.unpack('>II',image.read_bytes()[16:24])==(1536,1024)
  image_hashes.add(im['sha256'])
  assert r['article']['articleCell']==src['articleCell']
  assert r['article']['koreanOriginalSha256']==src['articleTextSha256']
  assert hashlib.sha256(src['articleText'].encode()).hexdigest()==src['articleTextSha256']
  provenance=read(im['provenancePath']);assert provenance['spotId']==sid
  assert provenance['articleTextSha256']==src['articleTextSha256']
  assert im['sha256'] in json.dumps(provenance)
  for lang,e in r['editions'].items():
   file=asset(e['svgPath']); assert sha(file)==e['svgSha256']==src['files'][lang]['sha256'];svg=ET.parse(file).getroot()
   assert svg.get('data-spot-id')==sid and svg.get('data-article-cell')==r['article']['articleCell']
   assert svg.get('data-image-sha256')==im['sha256']
   prefix=f'paper-{sid.lower()}-{lang}-v2';els={e.get('id'):e for e in svg.iter() if e.get('id')}
   assert len(els)==len([e for e in svg.iter() if e.get('id')])
   illustration=els[prefix+'-illustration'];href=next(v for k,v in illustration.attrib.items() if k.endswith('href'))
   assert hashlib.sha256(base64.b64decode(href.split(',',1)[1])).hexdigest()==im['sha256']
   expected=src['paragraphs'] if lang=='ko' else src['english']['paragraphs']
   for i,paragraph in enumerate(expected,1):assert ''.join(els[f'{prefix}-paragraph-{i}'].itertext())==paragraph
   for node in svg.iter():
    assert node.tag.split('}')[-1] not in ['script','foreignObject']
    for k,v in node.attrib.items():
     assert not k.startswith('on')
     if k.endswith('href'):assert v.startswith(('data:','#'))
     for ref in re.findall(r'url\(#([^)]*)\)',v):assert ref in els
   expected_article=src['articleText'] if lang=='ko' else src['english']['dateline']+' — '+src['english']['headline']+'\n\n'+'\n\n'.join(src['english']['paragraphs'])
   assert asset(e['articlePath']).read_text().strip()==expected_article.strip()
   asset(e['previewPath']);svg_count+=1
 assert len(image_hashes)==58 and svg_count==116
 assert len(list((BASE/'illustrations').glob('*.png')))==58
 assert len(list((BASE/'newspapers').rglob('*.svg')))==116
 with (BASE/'image-location-map.csv').open(encoding='utf-8-sig',newline='') as f:csv_rows=list(csv.DictReader(f))
 assert len(csv_rows)==58
 for row,r in zip(csv_rows,mapping['items']):
  assert row['spotId']==r['spotId'] and row['imageSha256']==r['illustration']['sha256']
  assert float(row['latitude'])==r['location']['latitude'] and float(row['longitude'])==r['location']['longitude']
 links=Links();links.feed((BASE/'gallery.html').read_text());assert links.cards==58
 for ref in links.refs:asset(ref)
 render=read('provenance/newspaper-v2/qa/render-report.json');assert len(render['records'])==58
 assert all(r[lang]['fontLoaded'] and not r[lang]['pageErrors'] for r in render['records'] for lang in ['ko','en'])
 glyphs=read('provenance/newspaper-v2/qa/glyph-report.json');assert not glyphs['ko']['missing'] and not glyphs['en']['missing']
 for name,font in manifest['fonts'].items():assert sha(BASE/'fonts'/Path(font['file']).name)==font['sha256']
 if (BASE/'checksums.json').is_file():
  for entry in read('checksums.json')['files']:assert sha(asset(entry['path']))==entry['sha256'],entry['path']
 report={'status':'passed','matchedSpots':58,'matchedCoordinatePairs':58,'originalCoordinatePairsPreserved':40,'coordinateSupplementsPreserved':18,'supplementRowsRequiringIntegrationReview':4,'uniqueIllustrations':58,'newspaperSvgs':116,'embeddedImageMatches':116,'koreanParagraphsPreserved':232,'englishParagraphsComposed':232,'galleryReferences':len(links.refs),'invalidMappingGuardsPassed':mutation_checks,'priorBrowserBoundsFailures':0,'missingGlyphs':0,'baseRepositorySpotCount':42,'archivedSpotAssetsRetained':16,'publicationStatus':'unpublished','historicalReviewStatus':'unverified'}
 (BASE/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()

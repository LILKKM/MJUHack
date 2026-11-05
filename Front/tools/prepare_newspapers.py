#!/usr/bin/env python3
"""Copy unchanged supplied SVGs and a small, exact-ID runtime index."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def prepare(source_root, check=False):
    front = Path(__file__).resolve().parents[1]
    manifest = json.loads((source_root / 'deliverables/images/newspapers-v2/manifest.json').read_text())
    places = json.loads((front / 'src/data/selectedPlaces.json').read_text())
    expected = {place['sourceId'] for place in places}
    records = manifest['records']
    assert len(records) == len(expected) == 58
    assert {record['spotId'] for record in records} == expected
    runtime = {}
    total = 0
    for record in records:
        spot_id = record['spotId']
        item = {key: record[key] for key in ('spotId', 'sourceReviewStatus', 'historicalReviewStatus', 'translationStatus', 'publicationStatus')}
        for language in ('ko', 'en'):
            file = record['files'][language]
            source = (source_root / file['path']).resolve()
            assert source.is_relative_to(source_root.resolve())
            target = front / 'public/assets/newspapers' / language / f'{spot_id}.svg'
            assert source.stat().st_size == file['bytes'] and digest(source) == file['sha256'], source
            if not check:
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists() or digest(target) != file['sha256']:
                    shutil.copyfile(source, target)
            assert target.stat().st_size == file['bytes'] and digest(target) == file['sha256'], target
            article = record if language == 'ko' else record['english']
            item[language] = {
                'headline': article['headline'], 'paragraphs': article['paragraphs'],
                'dateline': record['eventDateline'] if language == 'ko' else article['dateline'],
                'asset': f'/assets/newspapers/{language}/{spot_id}.svg',
                'sha256': file['sha256'], 'bytes': file['bytes'],
                'width': file['layout']['width'], 'height': file['layout']['height'],
            }
            total += file['bytes']
        runtime[spot_id] = item
    index = front / 'src/data/newspapers.json'
    encoded = json.dumps(runtime, ensure_ascii=False, indent=2) + '\n'
    if check:
        assert index.read_text() == encoded, 'Runtime index differs from source'
    else:
        index.write_text(encoded)
    for name in ('AbhayaLibre-OFL.txt', 'NotoSerifKR-OFL.txt', 'NotoSerifKR-source.txt'):
        source = source_root / 'deliverables/images/newspapers-v2/assets/fonts' / name
        target = front / 'public/assets/fonts' / name
        if not check:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        assert source.read_bytes() == target.read_bytes(), name
    print(f'PASS: {len(runtime)} exact spot IDs, {len(runtime) * 2} unchanged SVGs, {total:,} bytes; review statuses preserved')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    prepare(args.source_root, args.check)

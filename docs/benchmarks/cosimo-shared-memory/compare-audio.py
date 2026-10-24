import json, math, struct, sys, hashlib
from pathlib import Path
files=[Path(p) for p in sys.argv[1:]]
if len(files)<2: raise SystemExit('usage: compare-audio.py reference.f32 candidate.f32 ...')
def load(path):
 raw=path.read_bytes();values=struct.unpack('<'+'f'*(len(raw)//4),raw)
 return raw,values
raw,ref=load(files[0]);results=[]
for path in files[1:]:
 data,actual=load(path)
 n=min(len(ref),len(actual));delta=[a-b for a,b in zip(actual,ref)]
 results.append({'reference':str(files[0]),'candidate':str(path),'referenceSamples':len(ref),'candidateSamples':len(actual),'sameLength':len(ref)==len(actual),'maxAbsSampleDifference':max(map(abs,delta),default=0),'rmsDifference':math.sqrt(sum(d*d for d in delta)/n) if n else None,'referenceRms':math.sqrt(sum(x*x for x in ref)/len(ref)),'candidateRms':math.sqrt(sum(x*x for x in actual)/len(actual)),'nonfinite':sum(not math.isfinite(x) for x in actual),'referenceSha256':hashlib.sha256(raw).hexdigest(),'candidateSha256':hashlib.sha256(data).hexdigest(),'exactBytes':raw==data,'capture':'stereo interleavedfloat32,48kHz,16384frames; noteoff+2secondsunpacedsettle,thenMIDI60velocity100','tolerance':'reported measurements; no invented pass threshold'})
print(json.dumps(results,indent=2))

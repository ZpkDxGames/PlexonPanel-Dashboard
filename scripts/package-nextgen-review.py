"""Package the unpublished Strata branch and exact local verification evidence."""
from pathlib import Path
import argparse, datetime, hashlib, json, re, shutil, struct, subprocess, zipfile
p=argparse.ArgumentParser()
p.add_argument('--baseline',default='../baseline');p.add_argument('--output',default='../delivery')
a=p.parse_args();repo=Path.cwd();baseline=Path(a.baseline).resolve();out=Path(a.output).resolve();root=out/'review-content'
base='4357a66bc674fddce7432cbc27a4fead00ac8234';product='5ea142df03d9c0978887be95a56f4ab724f1489b'
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
def copy(src,dst):dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
head=git('rev-parse','HEAD');branch=git('branch','--show-current')
if git('status','--porcelain'):raise RuntimeError('Commit the review evidence before packaging')
if git('diff','--name-only',product,head,'--','src','public','package.json','package-lock.json','vite.config.ts','vercel.json'):raise RuntimeError('Product differs from verified build')
for d in ['recovery','reports/raw','logs','diagnostics','screenshots/baseline','screenshots/candidate']:(root/d).mkdir(parents=True,exist_ok=True)
copy(repo/'docs/next-gen/HANDOFF_README.md',root/'README.md')
for src in (repo/'docs/next-gen').glob('*.md'):copy(src,root/'reports'/src.name)
copy(repo/'AGENTS.md',root/'reports/AGENTS.md')
copy(repo/'docs/next-gen/proposals/NO_AUTODEPLOY.patch',root/'reports/proposals/NO_AUTODEPLOY.patch')
canonical=['source-boundary','matrix','states','widths-final','keyboard-final','regressions','isolation','action-parity','contrast','profile-final','profile-gates','bundle-comparison','input','endurance','accessibility-final','actual-zoom','render-diagnostic','steady-gates','suite']
for name in canonical:copy(repo/f'artifacts/nextgen/{name}.json',root/f'reports/raw/{name}.json')
for src in (repo/'artifacts/nextgen').glob('steady-repeat*.json'):copy(src,root/'reports/raw'/src.name)
copy(repo/'artifacts/telemetry-profile.json',root/'reports/raw/display-microbenchmark.json')
copy(repo/'artifacts/acceptance/production.json',root/'reports/raw/production.json')
logs=['baseline-check','baseline-build','baseline-perf','baseline-browser','candidate-audit','product-final-check','product-final-build','regressions-certified-final','isolation-final','keyboard-controls-final','prepared-targets-final-tip','widths-certified-final','matrix-certified-final','states-certified-final','input-feedback-final','production-product-final','bundle-product-final','display-microbenchmark-final','steady-gates-final','final-remote-refs','paired-final-five','endurance-certified-final','contracts-final','accessibility-certified-final','actual-zoom-final','render-diagnostic','steady-repeats-final']
for name in logs:copy(repo.parent/f'{name}.log',root/f'logs/{name}.log')
for src in (repo/'artifacts/nextgen/logs').glob('*.log'):
 if src.stem in ['browser-check','control-plane-check','reconstruction-check','reference-check','review-confirmation-check']:copy(src,root/'logs'/src.name)
for name in ['profile-initial-three','profile-interrupted-five','matrix-before-refinement','regressions-first-nine']:
 src=repo/f'artifacts/nextgen/{name}.json'
 if src.exists():copy(src,root/'diagnostics'/src.name)
for name in ['chromium-restore','chromium-shell-restore','input-certified-final','input-final','skip-reproduced-local']:
 src=repo.parent/f'{name}.log'
 if src.exists():copy(src,root/'diagnostics'/src.name)
copy(repo/'artifacts/nextgen/skip-before.json',root/'diagnostics/skip-before.json')
(root/'diagnostics/README.md').write_text('Earlier incomplete/noisy frame trials are not final passing gates. The old matrix/terminal failures were fixed and rerun. The input harness originally assumed one LumaCraft match; the real fixture contains four prefix matches. Final input checks validate actual source-matching rows. Chromium downloads failed with invalid/truncated archives. skip-before.json records the reproduced inherited hash/focus defect before its fix.\n')
records=[];routes=['fleet','overview','performance','players','console','backups','access','settings']
for kind,folder in [('baseline',baseline/'artifacts/previews'),('candidate',repo/'artifacts/nextgen/screenshots'),('candidate',repo/'artifacts/nextgen/states')]:
 for src in sorted(folder.glob('*.png')):
  m=re.fullmatch(r'(.+)-(1440|390|820)-(dark|light)(-viewport)?\.png',src.name)
  if not m:continue
  prefix,w,theme,viewport=m.groups();w=int(w);h={1440:900,390:844,820:1180}[w]
  scope='viewport' if viewport or prefix=='splash' else 'full'
  if prefix in routes:route,state=prefix,'healthy'
  elif prefix.startswith('profile-'):route,state='players',prefix[8:]
  elif prefix.startswith('settings-'):route,state='settings',prefix[9:]
  elif prefix in ['devices','authority']:route,state='access',prefix
  elif prefix in ['chat','plugins']:route,state='console',prefix
  elif prefix.startswith('backup-'):route,state='backups',prefix[7:]
  elif prefix.startswith('fleet-'):route,state='fleet',prefix[6:]
  else:route,state='shared',prefix
  if kind=='baseline':sha=base
  elif prefix in ['access','devices','authority'] or prefix.startswith('profile-'):sha=product
  elif prefix in routes:sha='4293d93d0565afae40043877a595c14cd7a88ecd'
  else:sha='bb1f811c4a72da0f537cf7361e20611941561255'
  name=f'{route}-{state}-{w}x{h}-{theme}-comfortable-standard-off-{scope}.png'
  target=root/'screenshots'/kind/name;copy(src,target)
  with src.open('rb') as f:header=f.read(24)
  pixels=struct.unpack('>II',header[16:24])
  records.append({'kind':kind,'route':route,'state':state,'width':w,'height':h,'theme':theme,'scope':scope,'path':str(target.relative_to(root)),'sourceHead':sha,'browser':'Firefox 157.0','zoom':'100%','density':'comfortable','text':'standard','motion':'off','accent':'teal','timezone':'browser','skins':'disabled','pixelSize':pixels,'captureCompletedAt':datetime.datetime.fromtimestamp(src.stat().st_mtime,datetime.timezone.utc).isoformat(),'evidence':'Labeled localhost synthetic fixture; nonlocal requests blocked'})
if len(records)!=292:raise RuntimeError(f'Unexpected screenshot count: {len(records)}')
(root/'screenshots/index.json').write_text(json.dumps(records,indent=2))
html=(repo/'docs/next-gen/evidence/gallery-template.html').read_text().replace('__IMAGE_INDEX__',json.dumps(records))
(root/'REVIEW.html').write_text(html)
review=root/'reports/REVIEW.md';text=review.read_text()
for r in records:
 if r['state']!='healthy':continue
 old=f"evidence/screenshots/{r['kind']}/{r['route']}-{r['width']}-{r['theme']}{'-viewport' if r['kind']=='candidate' else ''}.png"
 if r['kind']=='baseline' or r['scope']=='viewport':text=text.replace(old,'../'+r['path'])
review.write_text(text)
subprocess.run(['git','archive','--format=zip',f'--output={root}/recovery/source-snapshot.zip',head],check=True)
bundle=root/'recovery/strata-feature.bundle'
if bundle.exists():bundle.rename(out/'strata-feature-previous.bundle')
subprocess.run(['git','bundle','create',str(bundle),branch,'--not','main'],check=True)
verify=subprocess.run(['git','bundle','verify',str(bundle)],text=True,capture_output=True,check=True)
(root/'recovery/git-bundle-verify.txt').write_text(verify.stdout+verify.stderr)
restore=out/('restore-check-'+head[:12]);restore.mkdir(parents=True,exist_ok=True)
restore_log=[]
for command in [['git','init',str(restore)],['git','-C',str(restore),'fetch',str(repo),base],['git','-C',str(restore),'fetch',str(bundle),f'refs/heads/{branch}:refs/heads/{branch}']]:
 r=subprocess.run(command,text=True,capture_output=True,check=True);restore_log.append(r.stdout+r.stderr)
restored=subprocess.check_output(['git','-C',str(restore),'rev-parse',f'refs/heads/{branch}'],text=True).strip()
assert restored==head
(root/'recovery/restore-check.txt').write_text('Fresh independent repository recovered exact review HEAD '+restored+'\n'+'\n'.join(restore_log))

with (root/'recovery/frontend-change.patch').open('w') as f:subprocess.run(['git','diff','--binary',base,head,'--','.',':(exclude)docs/next-gen/evidence/screenshots'],stdout=f,check=True)
with zipfile.ZipFile(root/'recovery/production-build.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for src in sorted((repo/'dist').rglob('*')):
  if src.is_file():z.write(src,src.relative_to(repo/'dist'))
build=json.loads((repo/'dist/build.json').read_text());assert build['commit']==product
manifest={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'branch':branch,'base':base,'productHead':product,'reviewHead':head,'reviewTree':git('rev-parse','HEAD^{tree}'),'sourceTree':git('rev-parse','HEAD:src'),'backendReference':'209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128','build':build,'shortReplayHead':'41900d5e9de51d2220c6db7b60b8afd50d036768','screenshotCount':len(records),'status':'Frontend implemented locally; P7 steady timing FAIL and throttled-mobile/CLS/native-zoom/remote publication blocked. Not merged or deployed.','files':[]}
for src in sorted(root.rglob('*')):
 if src.is_file() and src.name not in ['MANIFEST.json','SHA256SUMS']:
  manifest['files'].append({'path':str(src.relative_to(root)),'bytes':src.stat().st_size,'sha256':hashlib.sha256(src.read_bytes()).hexdigest()})
(root/'MANIFEST.json').write_text(json.dumps(manifest,indent=2))
checks=[]
for src in sorted(root.rglob('*')):
 if src.is_file() and src.name!='SHA256SUMS':checks.append(hashlib.sha256(src.read_bytes()).hexdigest()+'  '+str(src.relative_to(root)))
(root/'SHA256SUMS').write_text('\n'.join(checks)+'\n')
archive=out/'PlexonPanel_Strata_Review_2026-10-16.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for src in sorted(root.rglob('*')):
  if src.is_file():z.write(src,src.relative_to(root))
print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'reviewHead':head,'screenshots':len(records)},indent=2))

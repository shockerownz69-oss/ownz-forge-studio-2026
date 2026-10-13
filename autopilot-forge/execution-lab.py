#!/usr/bin/env python3
"""OWNZ v1.5 guarded execution planning: NEVER executes archive code."""
import argparse, datetime, hashlib, io, json, os, pathlib, re, tarfile, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
HOME=pathlib.Path.home()
REPORT=ROOT/'.ownz-recovery/autopilot/execution-lab-v15.json'
def inspect(p):
    out={'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'status':'PASS','warnings':[],'execution':'NOT_RUN','entryCount':0,'fileCount':0,'totalBytes':0,'installers':[]}
    def flag(s,critical=False):
        out['warnings'].append(s)
        out['status']='FAIL' if critical else ('REVIEW' if out['status']=='PASS' else out['status'])
    if p.stat().st_size>100_000_000: flag('Archive exceeds 100 MB',True);return out
    try:
        with tarfile.open(p,'r:gz') as t:
            members=t.getmembers();out['entryCount']=len(members)
            if len(members)>1500: flag('Too many archive entries',True);return out
            for m in members:
                name=m.name
                parts=pathlib.PurePosixPath(name).parts
                if name.startswith('/') or '..' in parts or '\\' in name or not name.strip():flag('Unsafe entry path',True);continue
                if not(m.isfile() or m.isdir()):flag('Unsupported archive entry type',True);continue
                if m.isfile():
                    out['fileCount']+=1;out['totalBytes']+=m.size
                    if m.size>20_000_000 or out['totalBytes']>120_000_000:flag('Unpacked size limit exceeded',True);continue
                    if name.endswith(('install.sh','installer.sh','install.py','install.cjs','install.mjs')):
                        out['installers'].append(name)
            if not out['installers']:flag('No conventional installer entry point found')
    except (tarfile.TarError,OSError,ValueError,EOFError) as e:flag('Invalid archive: '+type(e).__name__,True)
    return out
def self_test():
    with tempfile.TemporaryDirectory() as td:
        td=pathlib.Path(td)
        for name,entry,expected in [('good','safe/install.sh','PASS'),('traversal','../escape','FAIL'),('noinstaller','safe/readme.txt','REVIEW')]:
            dest=td/(name+'.tar.gz')
            with tarfile.open(dest,'w:gz') as tf:
                content=b'echo test\n';i=tarfile.TarInfo(entry);i.size=len(content);tf.addfile(i,io.BytesIO(content))
            actual=inspect(dest)['status']
            assert actual==expected,(name,actual,expected)
    print('[OWNZ EXECUTION LAB] SELF-TEST PASS: 3 fixtures')
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--self-test',action='store_true');ap.add_argument('--directory',default=str(HOME/'storage/downloads'));args=ap.parse_args()
    if args.self_test:self_test();return
    folder=pathlib.Path(args.directory)
    archives=sorted((p for p in folder.glob('ownz-*.tar.gz') if p.is_file()),key=lambda p:p.stat().st_mtime,reverse=True)[:12] if folder.is_dir() else []
    results=[inspect(p) for p in archives]
    report={'version':'1.5','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'EXECUTION_PLAN_ONLY','executionTests':0,'isolationVerified':False,'notice':'No archive content executed. Plans and metadata only. Live installation, rollback and publishing disabled.','files':results,'summary':{s.lower():sum(r['status']==s for r in results) for s in ('PASS','REVIEW','FAIL')}}
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.execution-lab-',dir=REPORT.parent)
    try:
        with os.fdopen(fd,'w') as f:json.dump(report,f,indent=2);f.flush();os.fsync(f.fileno())
        os.replace(tmp,REPORT)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
    print('[OWNZ EXECUTION LAB]',json.dumps(report['summary']),'execution: NONE')
if __name__=='__main__':main()

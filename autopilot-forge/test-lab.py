#!/usr/bin/env python3
"""OWNZ Test Lab 1.4: guarded static inspection. Does not execute archive code."""
import argparse, ast, datetime, io, json, os, pathlib, re, tarfile, tempfile, tokenize
HOME=pathlib.Path.home()
ROOT=pathlib.Path(__file__).resolve().parents[1]
REPORT=ROOT/'.ownz-recovery'/'autopilot'/'installer-test-lab-v12.json'
PATTERNS=[('remote-shell',r'(?:curl|wget)\b[^\n]{0,240}\|\s*(?:ba)?sh\b'),('destructive-command',r'\brm\s+-[A-Za-z]*[rf][A-Za-z]*\s+(?:/|~|\$HOME|\$PREFIX)'),('filesystem-format',r'\b(?:mkfs\.|dd\s+if=|wipefs\b)'),('privilege-escalation',r'(?<![\w-])(?:sudo\b|su\s+-c\b)'),('git-force-push',r'\bgit\s+push\b[^\n]*\s--force\b')]
def scan_text(source,suffix):
    # In Python, skip non-executing strings (regex rules, documentation, fixtures),
    # but retain strings passed to execution functions, including subprocess calls.
    if suffix!='.py': return source
    try: tree=ast.parse(source)
    except SyntaxError: return source # fail conservatively on unparsable code
    lines=source.splitlines(keepends=True)
    masked=list(source)
    starts=[]; p=0
    for line in lines: starts.append(p);p+=len(line)
    def offset(line,col):
        # Python AST byte columns: convert bytes to characters for Unicode source.
        raw=lines[line-1].encode('utf-8')[:col]
        return starts[line-1]+len(raw.decode('utf-8','ignore'))
    literals=[]
    for node in ast.walk(tree):
        if isinstance(node,(ast.Constant,ast.JoinedStr)) and isinstance(getattr(node,'value',None),str) or isinstance(node,ast.JoinedStr):
            if hasattr(node,'end_lineno'):
                literals.append((offset(node.lineno,node.col_offset),offset(node.end_lineno,node.end_col_offset)))
    for a,b in literals:
        for i in range(a,min(b,len(masked))):
            if masked[i]!='\n': masked[i]=' '
    # Restore text from command execution calls, including nested string arguments.
    risky={'system','popen','run','call','check_call','check_output','Popen','exec','eval','spawn','spawnSync','execSync'}
    for node in ast.walk(tree):
        if not isinstance(node,ast.Call):continue
        f=node.func; name=f.id if isinstance(f,ast.Name) else f.attr if isinstance(f,ast.Attribute) else ''
        if name not in risky:continue
        for arg in [*node.args,*(kw.value for kw in node.keywords)]:
            if not hasattr(arg,'end_lineno'):continue
            a=offset(arg.lineno,arg.col_offset);b=offset(arg.end_lineno,arg.end_col_offset)
            masked[a:b]=list(source[a:b])
    return ''.join(masked)
def scan(archive):
    result={'name':archive.name,'status':'PASS','checks':[],'warnings':[],'entries':0,'execution':'NOT_RUN'}
    def flag(message,serious=True):
        result['checks'].append({'pass':not serious,'detail':message})
        if serious:result['status']='FAIL'
        else:
            if result['status']=='PASS':result['status']='REVIEW'
            result['warnings'].append(message)
    try:
        if archive.stat().st_size>100*1024*1024:flag('Archive exceeds 100 MB inspection limit');return result
        total=0
        with tarfile.open(archive,'r:gz') as tf:
            members=tf.getmembers();result['entries']=len(members)
            if len(members)>1500:flag('Too many entries');return result
            for m in members:
                p=pathlib.PurePosixPath(m.name)
                if m.name.startswith('/') or '..' in p.parts or '\\' in m.name or not m.name.strip():flag('Unsafe archive entry path');continue
                if not(m.isfile() or m.isdir()):flag('Archive contains link/device/special entry');continue
                if not m.isfile():continue
                total+=m.size
                if m.size>20*1024*1024:flag('Entry exceeds 20 MB limit');continue
                if total>120*1024*1024:flag('Unpacked content exceeds 120 MB');break
                if p.suffix in ('.sh','.bash','.cjs','.js','.py') and m.size<=2*1024*1024:
                    stream=tf.extractfile(m);content=stream.read().decode('utf-8','replace') if stream else ''
                    for label,regex in PATTERNS:
                        if re.search(regex,scan_text(content,p.suffix),re.I):flag('Review script '+str(p)+': '+label,False)
            if result['status']=='PASS':result['checks'].append({'pass':True,'detail':'Archive paths, types, size limits and script patterns passed'})
    except (tarfile.TarError,OSError,EOFError,ValueError) as exc:flag('Archive cannot be inspected: '+type(exc).__name__)
    return result
def self_test():
    with tempfile.TemporaryDirectory() as tmp:
        d=pathlib.Path(tmp)
        def fixture(name,content,path='safe/install.py'):
            out=d/name
            with tarfile.open(out,'w:gz') as tf:
                raw=content.encode();info=tarfile.TarInfo(path);info.size=len(raw);tf.addfile(info,io.BytesIO(raw))
            return scan(out)
        cases=[('safe','print("hello")\n','PASS'),('regex','PATTERNS=[("privilege-escalation", r"sudo|su -c"),("filesystem-format",r"mkfs\\.")]\n','PASS'),('doc','"""sudo rm -rf /"""\n','PASS'),('os_system','import os\nos.system("sudo whoami")\n','REVIEW'),('subprocess','import subprocess\nsubprocess.run(["su", "-c", "whoami"])\n','PASS'),('shell','sudo whoami\n','REVIEW')]
        for name,content,expected in cases:
            ext='.sh' if name=='shell' else '.py'
            actual=fixture(name+'.tar.gz',content,'safe/install'+ext)['status']
            assert actual==expected,(name,actual,expected)
        assert fixture('traversal.tar.gz','x','../escape')['status']=='FAIL'
        assert fixture('command.tar.gz','import subprocess\nsubprocess.run("su -c whoami",shell=True)\n')['status']=='REVIEW'
    print('[OWNZ TEST LAB] SELF-TEST PASS: 8 guarded fixtures')
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--self-test',action='store_true');ap.add_argument('--directory',default=str(HOME/'storage'/'downloads'));args=ap.parse_args()
    if args.self_test:self_test();return
    folder=pathlib.Path(args.directory)
    files=sorted((p for p in folder.glob('ownz-*.tar.gz') if p.is_file()),key=lambda p:p.stat().st_mtime,reverse=True)[:12] if folder.is_dir() else []
    results=[scan(p) for p in files]
    data={'version':'1.4','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'STATIC_INSPECTION_ONLY','executionTests':0,'files':results,'summary':{'pass':sum(x['status']=='PASS' for x in results),'review':sum(x['status']=='REVIEW' for x in results),'fail':sum(x['status']=='FAIL' for x in results)},'notice':'Static checks only. No installer code executed; no live files modified.'}
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.test-lab-',dir=REPORT.parent)
    try:
        with os.fdopen(fd,'w') as f:json.dump(data,f,indent=2);f.flush();os.fsync(f.fileno())
        os.replace(tmp,REPORT)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
    print('[OWNZ TEST LAB]',json.dumps(data['summary']),'archives:',len(results),'execution: NONE')
if __name__=='__main__':main()

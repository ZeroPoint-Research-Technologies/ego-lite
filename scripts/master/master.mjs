#!/usr/bin/env node
// Offline source diagnostic controller; never imports or runs application modules.
import { existsSync, mkdirSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const product="ego-lite";
const expectedBranch="integration/branch-of-truth-20261106-master-command-foundation";
const required=["README.md","package.json","pnpm-lock.yaml"];
const policies=["Never control browser tabs or agent sessions","Never expose browser credentials","Never install dependencies automatically"];
const domains=["agent-isolation","browser-bridge","session-safety"];
const args=process.argv.slice(2);
const action=args[0]||'doctor';
const json=args.includes('--json');
const approval=args.includes('--approve');
const outputFlag=args.indexOf('--output');
const outputDir=outputFlag>=0?args[outputFlag+1]:null;
function git(...values){try{return execFileSync('git',['-C',root,...values],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:3000,maxBuffer:262144}).trim()}catch{return null}}
function inventory(){return {product,root,branch:git('branch','--show-current'),expectedBranch,head:git('rev-parse','HEAD'),dirty:Boolean(git('status','--porcelain')),files:required.map(path=>({path,exists:existsSync(join(root,path))})),domains,verification:'DEFERRED'}}
function diagnose(i){const issues=[];if(i.branch!==expectedBranch)issues.push({code:'BRANCH_MISMATCH',severity:'blocked',repair:'Review checkout and branch governance; no automatic checkout'});if(i.dirty)issues.push({code:'DIRTY_WORKTREE',severity:'blocked',repair:'Preserve local modifications; never reset or stash'});for(const f of i.files)if(!f.exists)issues.push({code:'SOURCE_MISSING',severity:'review',path:f.path,repair:'Inspect actual source layout; no automatic restoration'});return issues}
function plan(i,issues){return {product,operation:'read-only source diagnostics',policies,issues,permittedRepair:['Create an explicitly approved isolated local report directory'],forbidden:['build','test','CI','deploy','sign','release','browser-control','git-write','user-data-write'],canResume:issues.length===0,verification:'UNVERIFIED'}}
function save(data){if(!outputDir)throw Error('Provide --output PATH. No implicit report directory.');const dir=resolve(outputDir);if(!existsSync(dir)){if(!approval)throw Error('Directory missing; --approve required for creation.');mkdirSync(dir,{recursive:true})}const body=JSON.stringify(data,null,2);if(Buffer.byteLength(body)>1048576)throw Error('Report exceeds 1 MiB limit');const path=join(dir,'master-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');const fd=openSync(path,'wx',0o600);try{writeSync(fd,body);fsyncSync(fd)}finally{closeSync(fd)}return path}
const i=inventory(),issues=diagnose(i),p=plan(i,issues),report={timestampUtc:new Date().toISOString(),inventory:i,issues,plan:p,status:'IMPLEMENTED_UNVERIFIED'};
function show(data){process.stdout.write((json?JSON.stringify(data,null,2):JSON.stringify(data,null,2))+'\n')}
try{switch(action){case 'help':show({actions:['help','inventory','doctor','plan','report','repair','resume','cancel'],domains,policies});break;case 'inventory':show(i);break;case 'doctor':show(report);break;case 'plan':show(p);break;case 'report':show(outputDir?{saved:save(report)}:report);break;case 'repair':if(!approval){show({approvalRequired:true,plan:p});break}show({saved:save(report),repair:'approved report custody only'});break;case 'resume':show({eligible:p.canResume,scope:'read-only inspection',deferred:['build','tests','runtime','deployment'],issues});break;case 'cancel':show({cancelled:true,mutations:0});break;default:throw Error('Unknown action; use help')}}catch(error){process.stderr.write(JSON.stringify({error:String(error.message),action,status:'BLOCKED'})+'\n');process.exitCode=1}

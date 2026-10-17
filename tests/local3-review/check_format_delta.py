#!/usr/bin/env python3
"""Read-only four-insertion/token audit; no C compiler or execution."""
from pathlib import Path
import hashlib,json,re,difflib
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
OLD=ROOT/'artifacts/firmware-local-v3/docs/prior-pages-ea578da1.c';NEW=ROOT/'artifacts/firmware-local-v3/source/main/badge_pages.c';DIFF=ROOT/'artifacts/firmware-local-v3/docs/gcc-format-fix.diff'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
oldsha=sha(OLD);newsha=sha(NEW)
assert oldsha=='ea578da18502e72aa4a2aab0a22065523b3c69b51fbb7eb82a776a1050732e17'
assert newsha=='89c1196c87d122d1e1b3ac220cfefffcc779aa00391803c70b8693fe980dde93'
a=OLD.read_text();b=NEW.read_text();ops=[]
for tag,i,j,k,l in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes():
 if tag!='equal':ops.append({'operation':tag,'oldLine':a.count('\n',0,i)+1,'newLine':b.count('\n',0,k)+1,'old':a[i:j],'new':b[k:l]})
assert len(ops)==4 and all(x['operation']=='insert' and x['old']=='' and x['new']=='\n    ' for x in ops)
assert len(b)-len(a)==20
# Quoted literals and comments are complete tokens, not whitespace stripped inside them.
lex=re.compile(r'''/\*.*?\*/|//[^\n]*|(?:u8|u|U|L)?"(?:\\.|[^"\\])*"|(?:u|U|L)?'(?:\\.|[^'\\])*'|[A-Za-z_]\w*|(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d*)?)(?:[uUlLfF]*)|>>=|<<=|\.\.\.|\+\+|--|->|&&|\|\||<=|>=|==|!=|\+=|-=|\*=|/=|%=|&=|\|=|\^=|<<|>>|\#\#|[^\s]''',re.S)
tokens_a=lex.findall(a);tokens_b=lex.findall(b);assert tokens_a==tokens_b
rendered=''.join(difflib.unified_diff(a.splitlines(True),b.splitlines(True),fromfile='prior-ea578da1/badge_pages.c',tofile='format-fixed/badge_pages.c'))
assert rendered.strip()==DIFF.read_text().strip()
assert len(re.findall(r'^@@ ',DIFF.read_text(),re.M))==4
report={'kind':'read_only_exact_four_format_insertions_not_build','passed':True,'oldSha256':oldsha,'newSha256':newsha,'diffSha256':sha(DIFF),'diffMatchesFullSources':True,'hunks':4,'insertions':ops,'sourceLengthIncreaseBytes':len(NEW.read_bytes())-len(OLD.read_bytes()),'lineIncrease':b.count('\n')-a.count('\n'),'tokenCountIncludingUnchangedCommentsAndLiterals':len(tokens_a),'tokensIdentical':True,'allQuotedLiteralsAndCommentsPreserved':True,'formatCheckScriptSha256':sha(Path(__file__)),'readEndSourceStable':sha(OLD)==oldsha and sha(NEW)==newsha}
(HERE/'format-delta-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))

import random
LOCK='<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="4.5" width="7" height="5" rx="1"/><path d="M3 4.5V3a2 2 0 0 1 4 0v1.5"/></svg>'
LOCKED=f'<span class="pill locked">{LOCK}Locked</span>'
def check(c="#fff",s=16): return f'<svg width="{s}" height="{s}" viewBox="0 0 16 16" fill="none" stroke="{c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>'
CHEV='<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#1A1A18" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l6 6-6 6"/></svg>'
BACK='<div class="iconbtn"><svg width="9" height="16" viewBox="0 0 8 14" fill="none" stroke="#1A1A18" stroke-width="1.8" stroke-linecap="round"><path d="M7 1L1 7l6 6"/></svg></div>'
PLUS='<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 1v12M1 7h12"/></svg>'
ICONS={'Home':'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 9l7-6 7 6v8H3z"/><path d="M8 17v-5h4v5"/></svg>',
'Group':'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7" cy="7.5" r="2.8"/><circle cx="14" cy="8.5" r="2.2"/><path d="M2 16.5c.6-2.8 2.7-4.3 5-4.3s4.4 1.5 5 4.3M12.5 13c2.6-.5 4.8.7 5.5 3.5"/></svg>',
'Me':'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="7" r="3.2"/><path d="M3.5 17c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5"/></svg>'}
STATUS='<div class="status"><span>9:41</span><span class="sig"><span class="bars"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:11px"></i></span><span class="batt"><i></i></span></span></div>'
def nav(a): return '<nav class="nav">'+''.join(f'<a class="{"active" if t==a else ""}">{ICONS[t]}{t}</a>' for t in ICONS)+'</nav><div class="home-ind"></div>'
def page(t,b,extra=''): return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=390"><title>Kept v5 · {t}</title><link rel="stylesheet" href="kept5.css">{extra}</head><body><div class="screen">{STATUS}{b}</div></body></html>'
def wm(size=20): return f'<span class="wordmark" style="font-size:{size}px"><span class="dot" style="width:{max(8,size*.32):.0f}px;height:{max(8,size*.32):.0f}px"></span>Kept</span>'

# ---------- 3D objects (kit palette, shading tints derived) ----------
def padlock(w,uid="p"):
  return f'''<svg width="{w}" height="{w*1.15:.0f}" viewBox="0 0 120 138">
<defs><linearGradient id="{uid}s" x1="0" x2="1"><stop offset="0" stop-color="#8E8E88"/><stop offset=".35" stop-color="#F4F2EC"/><stop offset=".6" stop-color="#C9C6BE"/><stop offset="1" stop-color="#77756F"/></linearGradient>
<radialGradient id="{uid}b" cx=".32" cy=".25" r=".95"><stop offset="0" stop-color="#9C86F5"/><stop offset=".45" stop-color="#4E3AA8"/><stop offset="1" stop-color="#241A50"/></radialGradient>
<radialGradient id="{uid}k" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFF4EC"/><stop offset=".55" stop-color="#FF9A66"/><stop offset="1" stop-color="#D9551C"/></radialGradient>
<filter id="{uid}f" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#2E2260" flood-opacity=".35"/></filter></defs>
<g filter="url(#{uid}f)"><path d="M32 62V42a28 28 0 0 1 56 0v20" fill="none" stroke="url(#{uid}s)" stroke-width="13" stroke-linecap="round"/>
<rect x="12" y="56" width="96" height="74" rx="22" fill="url(#{uid}b)"/>
<path d="M24 66c10-5 40-6 62-2" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"/>
<circle cx="60" cy="88" r="11" fill="url(#{uid}k)"/><rect x="56" y="92" width="8" height="18" rx="4" fill="url(#{uid}k)"/></g></svg>'''
def coin(w,uid="c"):
  return f'''<svg width="{w}" height="{w}" viewBox="0 0 100 100"><defs>
<radialGradient id="{uid}g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF4EC"/><stop offset=".3" stop-color="#FFB086"/><stop offset=".75" stop-color="#FF7A3D"/><stop offset="1" stop-color="#C24A14"/></radialGradient>
<linearGradient id="{uid}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C24A14"/><stop offset="1" stop-color="#FFE3D3"/></linearGradient>
<filter id="{uid}f" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity=".32"/></filter></defs>
<g filter="url(#{uid}f)"><circle cx="50" cy="50" r="42" fill="url(#{uid}g)"/><circle cx="50" cy="50" r="32" fill="none" stroke="url(#{uid}r)" stroke-width="3"/>
<text x="50" y="62" text-anchor="middle" font-family="Inter" font-weight="700" font-size="34" fill="#8A3410">$</text>
<ellipse cx="36" cy="30" rx="12" ry="6" fill="#fff" opacity=".5" transform="rotate(-30 36 30)"/></g></svg>'''
def ring(w,c1="#E4DAFF",c2="#8F78F0",uid="r"):
  return f'''<svg width="{w}" height="{w}" viewBox="0 0 100 100"><defs><radialGradient id="{uid}g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></radialGradient>
<filter id="{uid}f" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".2"/></filter></defs>
<g filter="url(#{uid}f)"><circle cx="50" cy="50" r="32" fill="none" stroke="url(#{uid}g)" stroke-width="22"/></g></svg>'''
def progress_ring(w,pct,uid="pr"):
  r=40; c=2*3.14159*r; off=c*(1-pct)
  return f'''<svg width="{w}" height="{w}" viewBox="0 0 100 100"><defs><linearGradient id="{uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6A52D6"/><stop offset=".5" stop-color="#3E2E8A"/><stop offset="1" stop-color="#2E2260"/></linearGradient>
<filter id="{uid}f" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#2E2260" flood-opacity=".25"/></filter></defs>
<circle cx="50" cy="50" r="{r}" fill="none" stroke="rgba(46,34,96,.14)" stroke-width="12"/>
<g filter="url(#{uid}f)"><circle cx="50" cy="50" r="{r}" fill="none" stroke="url(#{uid}g)" stroke-width="12" stroke-linecap="round" stroke-dasharray="{c:.1f}" stroke-dashoffset="{off:.1f}" transform="rotate(-90 50 50)"/></g></svg>'''
def medal(w,uid="md"):
  return f'''<svg width="{w}" height="{w*1.2:.0f}" viewBox="0 0 100 120"><defs>
<radialGradient id="{uid}g" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#FFE3D3"/><stop offset=".8" stop-color="#FF7A3D"/><stop offset="1" stop-color="#C24A14"/></radialGradient>
<filter id="{uid}f" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity=".3"/></filter></defs>
<g filter="url(#{uid}f)"><path d="M30 4h16l10 34H40z" fill="#1A1A18"/><path d="M70 4H54L44 38h16z" fill="#3A3A37"/>
<circle cx="50" cy="74" r="36" fill="url(#{uid}g)"/><circle cx="50" cy="74" r="26" fill="none" stroke="#8A3410" stroke-opacity=".35" stroke-width="2.5"/>
<path d="M38 74l8 8 16-17" fill="none" stroke="#1A1A18" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="37" cy="56" rx="11" ry="5" fill="#fff" opacity=".6" transform="rotate(-30 37 56)"/></g></svg>'''
def sph(sz,css,cls=""): return f'<div class="sphere {cls}" style="width:{sz}px;height:{sz}px;{css}"></div>'

AVC={"J":"var(--liltint)","S":"var(--butter)","M":"var(--peach)","A":"var(--sky)"}
def stack(items,sz=32,bd="#1F5F4A"):
  return '<div class="row">'+''.join(f'<div class="av" style="width:{sz}px;height:{sz}px;font-size:{sz*.4:.0f}px;background:{c};margin-left:{0 if i==0 else -8}px;border:2px solid {bd}">{t}</div>' for i,(t,c) in enumerate(items))+'</div>'
CREW4=[("J","#EEE8FF"),("S","#FFF0BF"),("M","#FFE3D3"),("A","#D6E6FF")]
TOP='<div class="row between" style="height:52px">'+wm()+'<div class="av m">JV</div></div>'
CATC={"Fitness":"var(--cfit)","Study":"var(--sky)","Screen time":"var(--lilac)","Habits":"var(--butter)","Followers":"var(--peach)","Other":"var(--stone2)"}
_ic=lambda p:'<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1A1A18" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'
CI={"Fitness":_ic('<circle cx="11" cy="3.2" r="1.6"/><path d="M6 16l2.5-5 2.5 2 1.5-4M5 8l3-2 3 1 2 3h2"/>'),"Study":_ic('<path d="M2 4.5c2.5-1 5-1 7 .8 2-1.8 4.5-1.8 7-.8v10c-2.5-1-5-1-7 .8-2-1.8-4.5-1.8-7-.8z"/><path d="M9 5.3v10"/>'),
"Screen time":_ic('<rect x="5" y="1.5" width="8" height="15" rx="2"/><path d="M8 13.5h2"/>'),"Habits":_ic('<circle cx="9" cy="9" r="6.5"/><path d="M9 5.5V9l2.5 1.5"/>'),
"Followers":_ic('<circle cx="7" cy="6" r="2.6"/><path d="M2.5 15c.5-2.8 2.3-4.2 4.5-4.2s4 1.4 4.5 4.2M13.5 5v5M11 7.5h5"/>'),"Other":_ic('<circle cx="4" cy="9" r="1.2" fill="#1A1A18"/><circle cx="9" cy="9" r="1.2" fill="#1A1A18"/><circle cx="14" cy="9" r="1.2" fill="#1A1A18"/>')}

def IC(n,w,css="",glow=False,rot=0):
  g=f'<div style="position:absolute;inset:6%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.75) 0%,rgba(255,255,255,.35) 40%,rgba(255,255,255,0) 70%)"></div>' if glow else ''
  return f'<div style="position:absolute;width:{w}px;height:{w}px;{css};transform:rotate({rot}deg);pointer-events:none">{g}<img src="icons/{n}.png" style="position:relative;width:100%;height:100%;display:block"></div>'
def ICi(n,w,css=""): return f'<img src="icons/{n}.png" style="width:{w}px;height:{w}px;display:block;flex:none;{css}">'
screens=[]

# 01 Login
login=f'''<div class="content">
<div class="tile lil" style="margin-top:8px;height:420px;box-shadow:0 14px 30px rgba(110,80,220,.30)">
 {sph(150,"left:-40px;top:250px","mandsph")}{sph(70,"right:26px;top:36px","mandsph")}{sph(38,"left:46px;top:70px","mintsph")}
 <div style="position:absolute;left:50%;top:92px;transform:translateX(-50%)">{padlock(170,"lp")}</div>
 <div style="position:absolute;right:30px;top:262px;transform:rotate(14deg)">{coin(92,"lc")}</div>
 <div style="position:absolute;left:20px;top:20px">{LOCKED}</div>
</div>
<div style="margin-top:32px">{wm(28)}</div>
<p class="h1" style="font-size:36px;margin-top:14px">Put something on the line.</p>
<p style="font-size:17px;color:var(--muted);margin-top:12px;line-height:1.4">Set a goal with friends. Your money is locked until the promise is kept.</p>
<div class="btn mand" style="margin-top:28px"><svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="#1A1A18" stroke-width="1.7"><rect x="1" y="1" width="18" height="14" rx="3"/><path d="M2 3l8 6 8-6"/></svg>Continue with email</div>
</div><div class="home-ind"></div>'''
screens.append(("01-login","Login",login,"No tab · first open"))

# 02 Home
home=f'''<div class="content">{TOP}
<p class="h1" style="margin-top:6px">Hi, Josué</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
 <div class="tile inkbg" style="height:86px;box-shadow:0 14px 30px rgba(26,26,24,.22)"><p style="font-size:14px;color:var(--onink)">Balance</p><p style="font-size:32px;font-weight:700;letter-spacing:-0.03em;color:var(--acc);margin-top:6px">$45.00</p></div>
 <div class="tile" style="background:var(--peach);height:86px"><p style="font-size:14px">On the line</p><p style="font-size:32px;font-weight:700;letter-spacing:-0.03em;margin-top:6px">$30</p>{IC("coins-stack",78,"right:-8px;bottom:-10px",rot=6)}</div>
</div>
<div class="row between" style="margin-top:16px"><p class="sec">Active goals</p><div class="btn mand sm" style="height:42px;font-size:14px;padding:0 14px">{PLUS}New goal</div></div>
<div class="tile lil" style="margin-top:12px;padding:20px;box-shadow:0 14px 30px rgba(110,80,220,.30)">
 {IC("padlock-key",104,"right:2px;top:2px",True)}
 <div class="row" style="gap:8px">{LOCKED}<span class="pill" style="background:var(--cfit);color:var(--ink)">{CI["Fitness"]}Fitness</span></div>
 <p style="font-size:22px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;margin-top:10px;max-width:210px">Run 21 km by Sunday</p>
 <div class="row" style="gap:12px;margin-top:10px"><span class="big" style="font-size:52px">$20</span><span class="pill locked" style="background:#fff;color:var(--ink)">2 days left</span></div>
 <div style="margin-top:12px"><div class="row between" style="font-size:14px;font-weight:500;margin-bottom:8px"><span>14 of 21 km</span><span>67%</span></div><div class="progbar"><i style="width:66.6%"></i></div></div>
</div>
<div class="tile" style="background:var(--sky);margin-top:10px;padding:14px 16px"><div class="row between"><div class="row" style="gap:12px"><span class="ci" style="width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.75);display:flex;align-items:center;justify-content:center">{CI["Study"]}</span><div><p style="font-weight:500">Read 2 books by Nov 30</p><p style="font-size:14px;color:var(--ink);margin-top:2px">$10 · 10 days left</p></div></div><span class="pill prog">1 of 2</span></div></div>
<div class="row between" style="margin-top:14px"><p class="sec">Groups</p><span class="label">1 group</span></div>
<div class="card row between" style="margin-top:8px;padding:10px 16px"><div class="row" style="gap:12px">{stack(CREW4,30,"#fff")}<div><p style="font-weight:500">Sunday runners</p><p style="font-size:14px;color:var(--muted)">4 people · $80 pot</p></div></div><div class="row" style="gap:4px">{ICi("money-bag",48,"margin:-8px 0")}{CHEV}</div></div>
</div>{nav("Home")}'''
screens.append(("02-home","Home",home,"Tab 1"))

# 03 wizard
def wizhdr(step,title):
  return f'''<div class="content"><div class="hdr">{BACK}<span style="font-weight:500">New goal</span><span class="label" style="width:44px;text-align:right">{step}/3</span></div>
<div class="steps" style="margin-top:8px">{''.join(f'<i class="{"on" if i<step else ""}"></i>' for i in range(3))}</div>
<p class="h1" style="margin-top:24px">{title}</p>'''
cats=[("Fitness",1),("Study",0),("Screen time",0),("Habits",0),("Followers",0),("Other",0)]
w1=wizhdr(1,"What do you want to do?")+f'''
<div class="field" style="margin-top:20px;border:2px solid var(--ink)"><span>I want to run more</span><span style="width:2px;height:22px;background:var(--violet)"></span></div>
<p class="label" style="margin-top:20px">Category</p>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">{''.join(f'<div class="cat{" sel" if s else ""}" style="background:{CATC[c]}"><span class="ci">{CI[c]}</span>{c}{('<span class="ck">'+check("#fff",12)+'</span>') if s else ''}</div>' for c,s in cats)}</div>
<div class="tile inkbg" style="margin-top:20px;padding:20px;box-shadow:0 14px 30px rgba(26,26,24,.22)">
 {IC("chat-check",92,"right:-4px;top:-6px",rot=6)}
 <span class="pill grok"><span class="dot" style="background:var(--lil)"></span>Grok coach</span>
 <p style="font-size:14px;color:var(--onink);margin-top:14px">Make it measurable</p>
 <p style="font-size:22px;font-weight:500;letter-spacing:-0.02em;line-height:1.25;margin-top:4px;color:#fff;max-width:280px">Run 21 km by Sun, Nov 22</p>
 <p style="font-size:14px;color:var(--onink);margin-top:10px">Proof: a Strava screenshot. Most people start with $20.</p>
 <div class="row" style="gap:10px;margin-top:16px"><div class="btn" style="flex:1;height:48px;background:var(--lil);color:var(--ink);border-radius:14px;font-size:16px">Use this</div><div class="btn" style="flex:1;height:48px;background:transparent;color:#fff;border:1.5px solid #fff;border-radius:14px;font-size:16px">Edit</div></div>
</div>
<div class="btn mand" style="margin-top:16px">Continue</div></div><div class="home-ind"></div>'''
screens.append(("03a-new-goal-what","New goal · 1",w1,"Wizard step 1 · what"))

def opt(title,sub,state,icon=None):
  if state=="on": mark=f'<span style="width:28px;height:28px;border-radius:8px;background:var(--violet);display:flex;align-items:center;justify-content:center">{check()}</span>'; st="border:2px solid var(--lild);background:var(--liltint)"
  elif state=="soon": mark='<span class="pill soon">Coming soon</span>'; st="background:var(--stone2);box-shadow:none"
  else: mark='<span style="width:28px;height:28px;border-radius:8px;border:2px solid var(--stone)"></span>'; st=""
  col="var(--muted)" if state=="soon" else "var(--ink)"
  ic=(ICi(icon,48,"margin:-8px 0 -8px -8px")) if icon else ''
  return f'<div class="card row between" style="padding:14px 16px;margin-top:10px;{st}"><div class="row" style="gap:10px">{ic}<div><p style="font-weight:500;color:{col}">{title}</p><p style="font-size:14px;color:var(--muted);margin-top:2px">{sub}</p></div></div>{mark}</div>'
w2=wizhdr(2,"When and how?")+f'''
<p class="label" style="margin-top:20px">Deadline</p>
<div class="field" style="margin-top:10px"><span class="row" style="gap:8px">{ICi("calendar",40,"margin:-8px -4px -8px -8px")}Sun, Nov 22</span><span class="row" style="gap:10px"><span class="label">11:59 pm</span>{CHEV}</span></div>
<p class="label" style="margin-top:20px">How will it be checked?</p>
{opt("Friends vote","Your crew approves or disputes","on","friends")}
{opt("Photo proof","Upload a photo or screenshot","on","camera")}
{opt("Strava","Proof comes in by itself","soon")}
{opt("Screen Time","Proof comes in by itself","soon")}
<div class="btn mand" style="margin-top:22px">Continue</div></div><div class="home-ind"></div>'''
screens.append(("03b-new-goal-rules","New goal · 2",w2,"Wizard step 2 · deadline and proof"))

w3=wizhdr(3,"How much is on the line?")+f'''
<div class="row" style="gap:8px;margin-top:20px"><div class="chip">$10</div><div class="chip sel">$20</div><div class="chip">$50</div><div class="chip" style="font-size:15px">Custom</div></div>
<div class="tile lil" style="margin-top:18px;padding:20px;box-shadow:0 14px 30px rgba(110,80,220,.30)">
 {IC("padlock-key",118,"right:0px;top:-2px",True)}
 <p style="font-size:14px;color:var(--acc)">Summary</p>
 <p style="font-size:22px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;margin-top:6px;max-width:200px">Run 21 km by Sun, Nov 22</p>
 <div class="row" style="gap:10px;margin-top:12px"><span class="big" style="font-size:52px">$20</span>{LOCKED}</div>
 <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--hair)">
  <div class="row" style="gap:10px;align-items:flex-start"><span style="width:22px;height:22px;border-radius:50%;background:var(--mint);flex:none;display:flex;align-items:center;justify-content:center;margin-top:1px">{check("#1F5F4A",13)}</span><p style="font-size:15px;line-height:1.35"><b>Keep it</b> and your $20 comes back. Missed stakes are split with friends who kept theirs.</p></div>
  <div class="row" style="gap:10px;align-items:flex-start;margin-top:10px"><span style="width:22px;height:22px;border-radius:50%;background:rgba(46,34,96,.15);flex:none;display:flex;align-items:center;justify-content:center;margin-top:1px;font-size:13px">×</span><p style="font-size:15px;line-height:1.35"><b>Miss it:</b> 60% goes to friends who kept theirs, 40% to Kept.</p></div>
 </div>
</div>
<p class="label" style="margin-top:14px;text-align:center">Paid from your balance · $45.00</p>
<div class="btn mand" style="margin-top:12px">{LOCK.replace('viewBox','width="18" height="18" viewBox')}Lock it in</div>
<p class="label" style="margin-top:10px;text-align:center;font-size:13px">Locked by code, not held by us.</p></div><div class="home-ind"></div>'''
screens.append(("03c-new-goal-stake","New goal · 3",w3,"Wizard step 3 · stake and summary"))

# 04 Group
def mtile(ini,name,goal,amt,status,bg):
  pill={"ok":'<span class="pill ok">Kept</span>',"prog":'<span class="pill prog">In progress</span>',"miss":'<span class="pill missed" style="background:#fff">Missed</span>'}[status]
  return f'<div class="tile" style="background:{bg};height:124px;display:flex;flex-direction:column;justify-content:space-between"><div class="row between"><div class="av" style="width:36px;height:36px;font-size:15px">{ini}</div>{pill.replace('class="pill','style="height:28px;font-size:13px;padding:0 10px" class="pill')}</div><div><p style="font-weight:500;font-size:17px">{name}</p><p style="font-size:14px;line-height:1.25;white-space:nowrap">{goal} · ${amt}</p></div></div>'
def grouphdr(seg):
  return f'''<div class="row between" style="height:60px;margin-top:4px"><p class="h1">Sunday runners</p><div class="iconbtn"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1A1A18" stroke-width="1.7" stroke-linecap="round"><circle cx="4" cy="9" r="1.3" fill="#1A1A18"/><circle cx="9" cy="9" r="1.3" fill="#1A1A18"/><circle cx="14" cy="9" r="1.3" fill="#1A1A18"/></svg></div></div>
<div class="seg" style="margin-top:6px"><a class="{"on" if seg=="m" else ""}">Members</a><a class="{"on" if seg=="f" else ""}">Feed</a></div>'''
group=f'''<div class="content">{grouphdr("m")}
<div class="tile lil" style="margin-top:14px;padding:20px;height:168px;box-shadow:0 14px 30px rgba(110,80,220,.30)">
 {IC("money-bag",124,"right:-2px;top:-6px",True)}
 <div class="row" style="gap:10px"><p style="font-size:14px;color:var(--onink)">Group pot</p>{LOCKED}</div>
 <p class="big" style="color:var(--acc);margin-top:10px">$80</p>
 <div class="row between" style="margin-top:14px"><span style="font-size:14px;color:var(--onink)">4 people · Ends Sun, Nov 22</span>{stack(CREW4,30,"#B9A4FF")}</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
{mtile("J","You","Run 21 km",20,"prog","var(--cfit)")}{mtile("S","Sandra","Gym 3x",20,"ok","var(--butter)")}{mtile("M","Mateo","Off by 11pm",10,"miss","var(--lilac)")}{mtile("A","Ana","Study 10 h",30,"prog","var(--sky)")}
</div>
<div class="btn mand" style="margin-top:14px"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1A1A18" stroke-width="1.7" stroke-linecap="round"><path d="M7.5 10.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L9 4"/><path d="M10.5 7.5a3.5 3.5 0 0 0-5 0L3 10a3.5 3.5 0 0 0 5 5l1-1"/></svg>Invite friends</div>
</div>{nav("Group")}'''
screens.append(("04-group","Group",group,"Tab 2 · members"))

# 05 Goal detail
def tl(title,sub,o=False): return f'<div class="tl"><span class="b{" o" if o else ""}"></span><div><p style="font-weight:500;font-size:15px">{title}</p><p style="font-size:13px;color:var(--muted)">{sub}</p></div></div>'
def voter(ini,name,state,bg):
  p={"ok":f'<span style="width:26px;height:26px;border-radius:50%;background:var(--forest);display:flex;align-items:center;justify-content:center">{check("#fff",13)}</span>',"wait":'<span style="width:26px;height:26px;border-radius:50%;border:2px dashed #B9B6AC"></span>'}[state]
  return f'<div class="row between" style="padding:7px 0"><div class="row" style="gap:10px"><div class="av sm" style="background:{bg}">{ini}</div><span style="font-weight:500;font-size:15px">{name}</span></div>{p}</div>'
detail=f'''<div class="content"><div class="hdr">{BACK}<span style="font-weight:500">Your goal</span><div style="width:44px"></div></div>
<div class="tile lil" style="margin-top:8px;padding:20px;box-shadow:0 14px 30px rgba(110,80,220,.30)">
 {IC("padlock-key",92,"right:4px;top:34px",True)}
 <div class="row between" style="position:relative">{LOCKED}<span style="font-size:14px;color:var(--acc)">$20 on the line</span></div>
 <p style="font-size:22px;font-weight:500;letter-spacing:-0.02em;margin-top:12px">Run 21 km by Sunday</p>
 <div class="row" style="gap:18px;margin-top:14px">
  <div style="position:relative;width:116px;height:116px;flex:none">{progress_ring(116,.667)}<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:32px;font-weight:700;letter-spacing:-0.03em">67%</span></div></div>
  <div><p class="row" style="font-size:14px;color:var(--acc);gap:4px">{ICi("clock",26,"margin:-4px 0 -4px -4px")}Time left</p><p style="font-size:40px;font-weight:700;letter-spacing:-0.04em;line-height:1.05;margin-top:2px">2d 14h</p><p style="font-size:14px;margin-top:4px">Ends Sun, 11:59 pm</p><p style="font-size:14px;margin-top:2px;color:var(--acc)">14 of 21 km</p></div>
 </div>
 <div class="btn mand" style="margin-top:16px;height:54px">{ICi("camera",40,"margin:-10px -2px -10px -6px")}Upload proof</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
 <div class="card" style="padding:14px 14px 4px"><p style="font-weight:500;margin-bottom:10px">Timeline</p>{tl("Locked $20","Tue, Nov 17")}{tl("3 friends joined","Tue, Nov 17")}{tl("Check-in 14 km","Thu, Nov 19")}{tl("Deadline","Sun, Nov 22",True)}</div>
 <div class="card" style="padding:14px"><div class="row between"><p style="font-weight:500">Friends</p><span class="label" style="font-size:13px">2 of 3</span></div><p style="font-size:13px;color:var(--muted);margin-top:2px">Approved your check-in</p>
 <div style="margin-top:6px">{voter("S","Sandra","ok","var(--butter)")}{voter("A","Ana","ok","var(--sky)")}{voter("M","Mateo","wait","var(--stone)")}</div></div>
</div>
</div>{nav("Home")}'''
screens.append(("05-goal-detail","Goal detail",detail,"From Home · goal card"))

# 06 Feed
ROUTE='<svg width="100%" height="100%" viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice"><rect width="300" height="120" fill="#EEE8FF"/><path d="M0 40h300M0 85h300M70 0v120M160 0v120M240 0v120" stroke="#DCD2FF" stroke-width="10"/><path d="M28 96C50 60 80 92 104 66s40-42 70-30 34 46 62 38 30-40 44-46" fill="none" stroke="#2E2260" stroke-width="5" stroke-linecap="round"/><circle cx="28" cy="96" r="7" fill="#1A1A18"/><circle cx="280" cy="28" r="7" fill="#fff" stroke="#FF7A3D" stroke-width="4"/></svg>'
def grokmsg(t): return f'<div class="row" style="gap:10px;align-items:flex-start;margin-top:12px"><div class="av sm" style="background:var(--ink);color:var(--acc);font-size:12px">G</div><div class="tile inkbg" style="padding:12px 14px;border-radius:18px 18px 18px 6px;flex:1"><p style="font-size:13px;color:var(--acc);font-weight:500">Grok · group agent</p><p style="font-size:15px;margin-top:2px;line-height:1.35">{t}</p></div></div>'
feed=f'''<div class="content">{grouphdr("f")}
{grokmsg("Two days left until Sunday. Sandra kept hers today. Nice work, Sandra.")}
<div class="card" style="margin-top:12px;padding:14px">
 <div class="row between"><div class="row" style="gap:10px"><div class="av sm" style="background:var(--liltint)">J</div><div><p style="font-weight:500;font-size:15px">Josué · check-in</p><p style="font-size:13px;color:var(--muted)">Run 21 km · 8 min ago</p></div></div><span class="pill peach" style="height:26px;font-size:13px">14 km so far</span></div>
 <div style="height:120px;border-radius:16px;overflow:hidden;margin-top:12px;position:relative">{ROUTE}<span class="pill dark" style="position:absolute;left:10px;bottom:10px;height:26px;font-size:13px">8.2 km · Fri 7:12 am</span></div>
 <div class="row" style="gap:10px;margin-top:12px"><div class="btn fo" style="flex:1;height:52px">Approve</div><div class="btn white" style="flex:1;height:52px">Dispute</div></div>
</div>
<div class="tile" style="background:var(--cfit);margin-top:10px;padding:12px 14px"><div class="row" style="gap:10px"><div class="av sm" style="background:#fff">S</div><p style="font-size:15px;flex:1"><b>Sandra</b> kept “Gym 3x this week”.</p>{ICi("trophy",44,"margin:-10px 0")}</div></div>
<div class="field" style="margin-top:12px;height:52px;border-radius:999px;padding:0 8px 0 18px"><span class="label" style="font-size:15px">Message the group</span><span style="width:38px;height:38px;border-radius:50%;background:var(--ink);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M4 7l4-4 4 4"/></svg></span></div>
</div>{nav("Group")}'''
screens.append(("06-group-feed","Group feed",feed,"Tab 2 · feed and chat"))

# 07 Vote
vote=f'''<div class="content"><div class="hdr">{BACK}<span style="font-weight:500">Vote</span><span class="label" style="width:44px;text-align:right">1 of 2</span></div>
<p class="h1" style="margin-top:12px">Did Ana keep it?</p>
<p class="label" style="margin-top:6px;font-size:15px">Study 10 hours by Sunday · $30</p>
<div class="tile" style="background:var(--sky);margin-top:16px;height:300px;padding:20px;box-shadow:0 14px 30px rgba(31,95,74,.18)">
 {IC("camera",128,"right:-10px;bottom:-8px",rot=-6)}
 <div class="row" style="gap:10px"><div class="av sm" style="background:#fff">A</div><span style="font-weight:500">Ana’s proof</span><span class="label" style="color:var(--ink)">· screenshot</span></div>
 <div class="card" style="margin-top:16px;padding:16px;width:220px;border-radius:20px">
  <p style="font-size:13px;color:var(--muted)">Focus timer · this week</p>
  <p style="font-size:44px;font-weight:700;letter-spacing:-0.04em;margin-top:4px">10h 12m</p>
  <div class="row" style="gap:4px;align-items:flex-end;height:54px;margin-top:10px">{''.join(f'<i style="flex:1;height:{h}%;background:{"var(--violet)" if h>60 else "var(--lil)"};border-radius:4px;display:block"></i>' for h in [40,70,55,90,65,100,30])}</div>
  <div class="row between" style="font-size:12px;color:var(--muted);margin-top:6px"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
 </div>
</div>
<div class="card row between" style="margin-top:12px;padding:12px 16px"><div><p style="font-weight:500">2 of 3 voted</p><div class="steps" style="width:150px;margin-top:8px"><i class="on"></i><i class="on"></i><i></i></div></div>{stack([("S","#C6E4D5"),("M","#E6E4DD")],32,"#fff")}</div>
<div class="row" style="gap:10px;margin-top:12px"><div class="btn fo" style="flex:1">{check()}Approve</div><div class="btn white" style="flex:1">Dispute</div></div>
</div>{nav("Group")}'''
screens.append(("07-vote","Vote",vote,"From feed · after deadline"))

# 08 dispute & appeal
disp_card='''<div class="card" style="margin-top:12px;padding:16px"><div class="row" style="gap:12px"><div class="av" style="background:var(--stone)">M</div><div style="flex:1"><p style="font-weight:500">Mateo disputed it</p><p style="font-size:14px;color:var(--muted)">Sun, Nov 22 · 9:05 am</p></div></div>
<p style="margin-top:12px;font-size:16px;line-height:1.4">“The distance looks short to me.”</p></div>'''
d1=f'''<div class="content"><div class="hdr">{BACK}<span style="font-weight:500">Run 21 km</span><div style="width:44px"></div></div>
<div class="tile inkbg" style="margin-top:8px;padding:20px;box-shadow:0 14px 30px rgba(26,26,24,.25)">
 {IC("chat-check",96,"right:-4px;top:-8px",rot=6)}
 <span class="pill missed" style="background:var(--stone)">Disputed</span>
 <p class="h2" style="margin-top:10px;font-size:26px;color:#fff;max-width:240px">Your proof was disputed</p>
 <p style="font-size:15px;color:var(--onink);margin-top:8px">Your $20 stays locked until this is resolved.</p>
</div>
{disp_card}
<p class="sec" style="margin-top:20px">Appeal with Grok</p>
<p class="label" style="margin-top:4px">Add a screenshot. Grok checks distance, date, route and signs of editing.</p>
<div class="card row between" style="margin-top:12px;padding:12px 14px"><div class="row" style="gap:12px"><div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex:none">{ROUTE}</div><div><p style="font-weight:500;font-size:15px">strava-sunday-run.png</p><p style="font-size:13px;color:var(--muted)">Uploaded · 1.2 MB</p></div></div><span style="width:28px;height:28px;border-radius:50%;background:var(--forest);display:flex;align-items:center;justify-content:center">{check("#fff",14)}</span></div>
<div class="card" style="margin-top:10px;height:46px;display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed #B9B6AC;box-shadow:none;background:transparent;font-weight:500">{PLUS}Add another screenshot</div>
<div class="btn mand" style="margin-top:12px"><span class="dot" style="background:var(--ink)"></span>Appeal with Grok</div>
</div>{nav("Home")}'''
screens.append(("08a-dispute","Dispute",d1,"From Home · proof disputed"))

def chk(t,state):
  if state=="ok": m=f'<span style="width:24px;height:24px;border-radius:50%;background:var(--lil);display:flex;align-items:center;justify-content:center">{check("#2E2260",13)}</span>'
  elif state=="run": m='<span style="width:24px;height:24px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:var(--acc)"></span>'
  else: m='<span style="width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.25)"></span>'
  col="#fff" if state!="wait" else "var(--onink)"
  return f'<div class="row between" style="padding:9px 0;border-top:1px solid rgba(255,255,255,.12)"><span style="color:{col}">{t}</span>{m}</div>'
d2=f'''<div class="content"><div class="hdr">{BACK}<span style="font-weight:500">Appeal</span><div style="width:44px"></div></div>
<div class="tile inkbg" style="margin-top:8px;padding:22px;box-shadow:0 14px 30px rgba(26,26,24,.25)">
 {IC("clock",86,"right:2px;top:2px",rot=8)}
 <span class="pill grok"><span class="dot" style="background:var(--lil)"></span>Grok</span>
 <p class="h2" style="margin-top:14px;font-size:26px;color:#fff">Grok is reviewing…</p>
 <p style="font-size:15px;color:var(--onink);margin-top:6px">Usually under a minute.</p>
 <div style="margin-top:18px">{chk("Distance","ok")}{chk("Date","ok")}{chk("Route","run")}{chk("Signs of editing","wait")}</div>
</div>
<div class="card" style="margin-top:12px;padding:14px"><div class="row" style="gap:12px"><div style="width:64px;height:64px;border-radius:14px;overflow:hidden;flex:none">{ROUTE}</div><div><p style="font-weight:500;font-size:15px">Your screenshot</p><p style="font-size:13px;color:var(--muted);margin-top:2px">21.3 km · Sun, Nov 22 · 7:12 am</p></div></div></div>
{disp_card}
</div>{nav("Home")}'''
screens.append(("08b-grok-reviewing","Grok reviewing",d2,"Appeal in progress"))

def reason(k,v): return f'<div class="row" style="gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--hair)"><span style="width:22px;height:22px;border-radius:50%;background:var(--mint);flex:none;display:flex;align-items:center;justify-content:center;margin-top:1px">{check("#1F5F4A",13)}</span><p style="font-size:15px;line-height:1.35"><b>{k}:</b> {v}</p></div>'
d3=f'''<div class="content"><div class="hdr">{BACK}<span style="font-weight:500">Appeal</span><div style="width:44px"></div></div>
<div class="tile lil" style="margin-top:8px;padding:22px;box-shadow:0 14px 30px rgba(110,80,220,.30)">
 {IC("shield-check",104,"right:4px;top:0px",rot=6)}
 <span class="pill grok"><span class="dot" style="background:var(--lil)"></span>Grok verdict</span>
 <p class="h2" style="margin-top:14px;font-size:30px">Approved</p>
 <p style="font-size:15px;color:var(--acc);margin-top:4px;max-width:220px">Your proof holds up. The dispute is closed.</p>
 <div style="margin-top:18px">{reason("Distance","21.3 km, above the 21 km goal.")}{reason("Date","Sun, Nov 22, before the deadline.")}{reason("Route","One continuous GPS track.")}{reason("Editing","No signs found in the image.")}</div>
</div>
<div class="card row between" style="margin-top:12px;padding:14px 16px"><div><p style="font-weight:500">Locked record saved</p><p class="mono" style="font-size:13px;color:var(--muted);margin-top:2px">Verdict saved · Sun 9:21 am</p></div><span class="row" style="gap:8px;font-weight:500;color:var(--ink);font-size:15px">View{CHEV}</span></div>
<div class="btn ink" style="margin-top:14px">See results</div>
</div>{nav("Home")}'''
screens.append(("08c-grok-verdict","Grok verdict",d3,"Appeal resolved"))

# 09 Results
random.seed(7)
def _c(x0,x1,y0,y1,n): return ''.join(f'<i class="conf" style="left:{random.randint(x0,x1)}px;top:{random.randint(y0,y1)}px;width:{random.choice([6,8,10])}px;height:{random.choice([10,14,6])}px;background:{random.choice(cols)};transform:rotate({random.randint(0,90)}deg)"></i>' for _ in range(n))
cols=["#FF7A3D","#8F78F0","#1A1A18","#B9A4FF"]
conf=_c(112,270,56,104,16)
cols=["#FFFFFF","#1A1A18","#EEE8FF","#2E2260"]
# second confetti cluster removed: coins-stack icon now sits there
def res(ini,name,goal,kept,bg,amt):
  p='<span class="pill ok" style="height:26px;font-size:13px">Kept</span>' if kept else '<span class="pill missed" style="height:26px;font-size:13px">Missed</span>'
  return f'<div class="row between" style="padding:7px 0"><div class="row" style="gap:10px"><div class="av sm" style="background:{bg}">{ini}</div><div><p style="font-weight:500;font-size:15px">{name}</p><p style="font-size:13px;color:var(--muted);white-space:nowrap">${amt} stake</p></div></div>{p}</div>'
results=f'''<div class="content" style="position:relative">
<div class="row between" style="height:52px">{wm()}<span class="label">Sun, Nov 22</span></div>
<div class="tile mandbg" style="margin-top:8px;padding:20px;box-shadow:0 14px 30px rgba(217,85,28,.3)">
 {IC("trophy",118,"right:0px;top:-4px",rot=8)}{IC("coins-stack",84,"right:4px;bottom:-6px",rot=-6)}
 <p class="h2" style="font-size:28px">You kept it.</p>
 <p style="font-size:14px;color:var(--ink);margin-top:4px">Run 21 km by Sunday</p>
 <p class="big" style="margin-top:14px">$22</p>
 <div class="row" style="gap:8px;margin-top:12px"><span class="pill" style="background:#fff;color:var(--ink)">$20 stake</span><span class="pill dark">+ $2 share</span></div>
</div>
<div style="display:grid;grid-template-columns:1.35fr 1fr;gap:10px;margin-top:10px">
 <div class="card" style="padding:10px 14px">{res("J","You","Run 21 km",True,"var(--liltint)",20)}{res("S","Sandra","Gym 3x",True,"var(--butter)",20)}{res("A","Ana","Study 10 h",True,"var(--sky)",30)}{res("M","Mateo","Phone off",False,"var(--stone)",10)}</div>
 <div class="tile inkbg" style="padding:14px;display:flex;flex-direction:column"><p style="font-size:13px;color:var(--onink)">Forfeited</p><p style="font-size:32px;font-weight:500;color:var(--acc);letter-spacing:-0.03em">$10</p>
  <div style="margin-top:auto"><div class="row" style="height:10px;border-radius:999px;overflow:hidden"><i style="width:60%;height:100%;background:var(--lil);display:block"></i><i style="width:40%;height:100%;background:#5C5C58;display:block"></i></div>
  <p style="font-size:13px;margin-top:8px"><b>60%</b> · $6 to the 3 who kept it</p><p style="font-size:13px;color:var(--onink);margin-top:2px"><b>40%</b> · $4 to Kept</p></div></div>
</div>
<div class="btn mand" style="margin-top:12px">Collect $22</div>
<p style="text-align:center;margin-top:10px;font-size:15px;font-weight:500;color:var(--ink);text-decoration:underline;text-underline-offset:3px">View receipt</p>
</div>{conf}{nav("Home")}'''
screens.append(("09-results","Results",results,"After the deadline"))

# 10 Profile
def hist(t,s,amt,pos):
  return f'<div class="row between" style="padding:9px 0;border-top:1px solid var(--stone)"><div><p style="font-weight:500;font-size:15px">{t}</p><p style="font-size:13px;color:var(--muted)">{s}</p></div><span style="font-weight:500;color:{"var(--forest)" if pos else "var(--ink)"}">{amt}</span></div>'
profile=f'''<div class="content">
<div class="row" style="gap:16px;margin-top:12px"><div class="av lg m" style="box-shadow:0 0 0 4px #FAFAF7,0 0 0 6px #8F78F0">JV</div><div><p class="h1" style="font-size:26px">Josué Valles</p><p class="label">1 group · since Nov 2026</p></div></div>
<div style="display:grid;grid-template-columns:1.2fr 1fr;grid-template-rows:92px 92px;gap:10px;margin-top:20px">
 <div class="tile lil" style="grid-row:span 2;display:flex;flex-direction:column;justify-content:flex-end;box-shadow:0 14px 30px rgba(26,26,24,.25)">{IC("piggy-bank",108,"right:-8px;top:-10px",True)}<p style="font-size:14px;color:var(--onink)">Balance</p><p style="font-size:40px;font-weight:500;color:var(--acc);letter-spacing:-0.04em;line-height:1.05">$67.00</p></div>
 <div class="tile inkbg">{IC("trophy",64,"right:-4px;top:-6px",rot=8)}<p style="font-size:30px;font-weight:700;letter-spacing:-0.03em;line-height:1.1;color:var(--lil);position:relative">88%</p><p style="font-size:14px;margin-top:4px">Kept rate</p></div>
 <div class="tile" style="background:var(--peach)"><p style="font-size:30px;font-weight:700;letter-spacing:-0.03em;line-height:1.1">7 of 8</p><p style="font-size:14px;margin-top:4px">Goals kept</p></div>
</div>
<div class="row" style="gap:10px;margin-top:12px"><div class="btn ink" style="flex:1">{PLUS}Add funds</div><div class="btn white" style="flex:1">Withdraw</div></div>
<p class="label" style="text-align:center;margin-top:8px;font-size:13px">Add funds with a card or Apple Pay</p>
<div class="card" style="margin-top:12px;padding:6px 16px 4px">
 <div class="row between" style="padding:8px 0"><p style="font-weight:500">History</p><span class="label">See all</span></div>
 {hist("Collected · Run 21 km","Sun, Nov 22","+$22.00",True)}{hist("Locked · Run 21 km","Tue, Nov 17","−$20.00",False)}{hist("Added funds · Apple Pay","Tue, Nov 17","+$50.00",True)}
</div>
</div>{nav("Me")}'''
screens.append(("10-profile","Profile",profile,"Tab 3"))

for f,t,b,_ in screens: open(f+".html","w").write(page(t,b))
# overview: 2 rows
frames=lambda L:''.join(f'<figure><div class="bezel"><iframe src="{f}.html" width="390" height="844" scrolling="no"></iframe></div><figcaption><b>{i}. {t}</b><span>{c}</span></figcaption></figure>' for i,(f,t,_,c) in L)
idx=list(enumerate(screens,1)); idx=[(f"{['1','2','3a','3b','3c','4','5','6','7','8a','8b','8c','9','10'][i-1]}",s) for i,s in idx]
r1,r2=idx[:7],idx[7:]
spheres=sph(300,"left:-150px;top:1180px","mandsph")+sph(180,"right:140px;top:-60px")+sph(110,"right:-40px;top:1000px","mandsph")+sph(90,"left:1430px;top:1830px","mandsph")+sph(160,"left:2560px;top:1990px")+f'<div style="position:absolute;left:2960px;top:-50px">{ring(200,"#FFE3D3","#FF7A3D","ovr")}</div>'+f'<div style="position:absolute;left:1700px;top:1800px">{ring(130,"#E4DAFF","#8F78F0","ovr2")}</div>'
open("index.html","w").write(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kept v5 · UI examples</title><link rel="stylesheet" href="kept5.css"><style>
html{{background:#F2EEFA}} body{{background:#F2EEFA;padding:56px 72px 64px;width:max-content;position:relative;overflow:hidden}} .head{{display:flex;align-items:baseline;gap:16px;margin-bottom:40px;position:relative}}
.wrap{{display:flex;gap:44px;position:relative;margin-bottom:48px}} figure{{display:flex;flex-direction:column;gap:14px}}
.bezel{{width:406px;height:860px;border-radius:54px;border:8px solid #1A1A18;overflow:hidden;background:#FAFAF7;box-shadow:0 30px 60px rgba(90,60,180,.16)}}
iframe{{border:0;display:block}} figcaption{{display:flex;gap:8px;font-size:16px}} figcaption b{{font-weight:500}} figcaption span{{color:#5C5C58}}
</style></head><body>{spheres}<div class="head">{wm(28)}<span class="label" style="font-size:16px">UI examples v5 · 10 screens from the Drive spec · sample data only · internal draft</span></div><div class="wrap">{frames(r1)}</div><div class="wrap">{frames(r2)}</div></body></html>''')
print(len(screens))

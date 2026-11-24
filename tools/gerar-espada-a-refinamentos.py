from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import base64, io, runpy

out=Path(__file__).resolve().parent
original=runpy.run_path(str(out/'gerar-espadas-icones.py'))['icons']['A']
outline='#273038'; dark='#56616a'; mid='#9ba8ad'; light='#d7e0dd'; bright='#f1f3e9'; steel='#78868c'; wood='#79583d'; wooddark='#48372b'; woodlight='#a87b50'

def refined(kind):
 im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im)
 d.rectangle((29,42,35,56),fill=outline);d.rectangle((30,43,34,55),fill=wood);d.rectangle((31,44,32,54),fill=woodlight);d.rectangle((34,43,34,54),fill=wooddark)
 d.rectangle((28,56,36,59),fill=outline);d.rectangle((29,56,35,57),fill=wooddark);d.rectangle((30,58,34,58),fill=wood)
 d.polygon([(27,39),(27,12),(31,5),(33,5),(37,12),(37,39)],fill=outline)
 d.polygon([(29,38),(29,13),(32,8),(35,13),(35,38)],fill=mid)
 d.polygon([(29,13),(32,8),(32,38),(29,38)],fill=light)
 d.line([(30,14),(30,35)],fill=bright,width=1)
 d.rectangle((22,39,42,43),fill=outline);d.rectangle((23,39,41,41),fill=steel);d.line((25,39,39,39),fill=light)
 if kind=='B':
  # Aresta direita em tom intermediário e brilho contínuo na esquerda.
  d.line((34,14,34,35),fill='#b9c6c5');d.line((35,15,35,36),fill='#73838b');d.line((30,16,30,33),fill='#f4f5eb')
  d.line((29,36,34,36),fill='#a9b7b8')
 elif kind=='C':
  # Guarda da mesma silhueta, com relevo metálico discreto e centralização.
  d.line((24,40,40,40),fill='#a8b7b7');d.line((24,41,40,41),fill='#64737a')
  d.rectangle((30,39,34,42),fill=dark);d.rectangle((30,39,33,40),fill=light);d.point((32,40),fill=bright)
  d.line((30,15,30,33),fill=bright)
 elif kind=='D':
  # Combinação moderada do fio e guarda; ênfase em contraste no 16x16.
  d.line((34,14,34,35),fill='#bac7c5');d.line((35,15,35,35),fill='#708087')
  d.line((24,40,40,40),fill='#aab9b9');d.rectangle((30,39,34,42),fill=dark);d.rectangle((30,39,33,40),fill=light)
  d.line((31,47,31,52),fill='#c19360');d.line((30,56,34,56),fill='#9f7850')
 rotated=im.rotate(-45,resample=Image.Resampling.NEAREST,expand=True)
 crop=rotated.crop(rotated.getbbox());crop.thumbnail((57,57),Image.Resampling.NEAREST)
 canvas=Image.new('RGBA',(64,64));canvas.alpha_composite(crop,((64-crop.width)//2,(64-crop.height)//2));return canvas
icons={'A':original,'B':refined('B'),'C':refined('C'),'D':refined('D')}
labels={'A':'Original escolhida','B':'Arestas e brilho','C':'Guarda com relevo','D':'Fio e guarda combinados'}
for k,img in icons.items():img.save(out/f'espada-a-refino-{k.lower()}.png')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
bold=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
sheet=Image.new('RGB',(1200,640),'#232922');d=ImageDraw.Draw(sheet)
d.text((30,20),'ESPADA A • REFINAMENTOS',font=bold,fill='#f0f2e7');d.text((30,53),'Mesma silhueta; pequenas mudanças nos detalhes',font=font,fill='#c6d1c2')
for i,(k,im) in enumerate(icons.items()):
 x=22+i*296;d.rounded_rectangle((x,95,x+275,600),radius=8,fill='#303a30',outline='#788a73',width=2)
 d.text((x+16,105),f'OPÇÃO {k}',font=bold,fill='#ecf2e8');d.text((x+16,134),labels[k],font=font,fill='#c6d1c2')
 d.rectangle((x+25,170,x+249,394),fill='#1d251f',outline='#71816e');large=im.resize((224,224),Image.Resampling.NEAREST);sheet.paste(large,(x+25,170),large)
 d.text((x+17,414),'Redução a 16 × 16',font=font,fill='#c6d1c2');small=im.resize((16,16),Image.Resampling.NEAREST).resize((128,128),Image.Resampling.NEAREST)
 d.rectangle((x+73,450,x+201,578),fill='#1d251f');sheet.paste(small,(x+73,450),small)
sheet.save(out/'espada-a-refinamentos.png')
def uri(im):
 b=io.BytesIO();im.save(b,'PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
cards=[]
for k,im in icons.items():
 sm=im.resize((16,16),Image.Resampling.NEAREST)
 cards.append(f'<article><h2>Opção {k}</h2><p>{labels[k]}</p><img class="big" src="{uri(im)}" alt="Espada A refinamento {k}"><h3>Redução a 16 × 16</h3><img class="small" src="{uri(sm)}" alt="Redução 16 por 16"><p><small>Tamanho real: <img class="actual" src="{uri(sm)}" alt="Ícone tamanho real"></small></p></article>')
html='''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Espada A — refinamentos</title><style>body{font:16px/1.5 system-ui;margin:auto;padding:24px;max-width:1250px;background:#1c241d;color:#ecf2e8}p{color:#c6d1c2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}article{padding:16px;background:#303a30;border:1px solid #71816e;border-radius:8px}h2{margin:0}h3{font-size:15px;margin-bottom:8px}img.big{width:100%;max-width:240px;aspect-ratio:1;background:#1d251f;image-rendering:pixelated}img.small{width:128px;height:128px;background:#1d251f;image-rendering:pixelated}img.actual{width:16px;height:16px;background:#1d251f;image-rendering:pixelated}</style></head><body><h1>Espada A · refinamentos</h1><p>O desenho da opção A foi mantido. Compare a original com pequenos ajustes no fio, na guarda e no acabamento. Nada foi implementado no jogo.</p><div class="grid">'''+''.join(cards)+'''</div></body></html>'''
(out/'espada-a-refinamentos.html').write_text(html,encoding='utf8')

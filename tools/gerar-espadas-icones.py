from PIL import Image, ImageDraw, ImageFont
import base64, io
from pathlib import Path

out=Path(__file__).resolve().parent
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
bold=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',23)
outline='#273038'; dark='#56616a'; mid='#9ba8ad'; light='#d7e0dd'; bright='#f1f3e9'; steel='#78868c'; wood='#79583d'; wooddark='#48372b'; woodlight='#a87b50'

def sprite(kind):
 im=Image.new('RGBA',(64,64)); d=ImageDraw.Draw(im)
 # Cabos de madeira como as outras ferramentas, sem couro ou costura.
 d.rectangle((29,42,35,56), fill=outline)
 d.rectangle((30,43,34,55), fill=wood)
 d.rectangle((31,44,32,54), fill=woodlight)
 d.rectangle((34,43,34,54), fill=wooddark)
 d.rectangle((28,56,36,59),fill=outline); d.rectangle((29,56,35,57),fill=wooddark);d.rectangle((30,58,34,58),fill=wood)
 if kind=='A':
  # lâmina reta estreita, ponta simétrica e guarda curta horizontal
  d.polygon([(27,39),(27,12),(31,5),(33,5),(37,12),(37,39)],fill=outline)
  d.polygon([(29,38),(29,13),(32,8),(35,13),(35,38)],fill=mid)
  d.polygon([(29,13),(32,8),(32,38),(29,38)],fill=light)
  d.line([(30,14),(30,35)],fill=bright,width=1)
  d.rectangle((22,39,42,43),fill=outline);d.rectangle((23,39,41,41),fill=steel);d.line((25,39,39,39),fill=light)
 elif kind=='B':
  # lâmina larga, ombros retos e faceta central marcada
  d.polygon([(25,39),(25,16),(27,12),(31,5),(33,5),(37,12),(39,16),(39,39)],fill=outline)
  d.polygon([(27,37),(27,16),(32,8),(37,16),(37,37)],fill=steel)
  d.polygon([(28,16),(32,9),(32,37),(28,37)],fill=light)
  d.polygon([(33,12),(36,17),(36,37),(33,37)],fill=mid)
  d.rectangle((30,16,31,33),fill=bright)
  d.rectangle((21,39,43,43),fill=outline);d.rectangle((22,40,42,41),fill=mid);d.rectangle((29,38,35,43),fill=dark);d.rectangle((30,39,34,40),fill=light)
 elif kind=='C':
  # guarda recurvada em degraus e fio longo afilado
  d.polygon([(27,39),(27,17),(29,12),(32,4),(35,12),(37,17),(37,39)],fill=outline)
  d.polygon([(29,37),(29,16),(32,8),(35,16),(35,37)],fill=mid)
  d.polygon([(29,16),(32,8),(32,37),(29,37)],fill=light)
  d.line((30,17,30,34),fill=bright)
  d.polygon([(21,36),(24,36),(24,39),(29,39),(29,40),(35,40),(35,39),(40,39),(40,36),(43,36),(43,41),(40,44),(24,44),(21,41)],fill=outline)
  d.polygon([(22,37),(23,37),(23,40),(29,40),(35,40),(41,40),(41,37),(42,37),(42,40),(39,42),(25,42),(22,40)],fill=steel)
  d.line((26,40,38,40),fill=light)
 elif kind=='D':
  # lâmina com degrau na base e sulco longitudinal; guarda inclinada
  d.polygon([(25,39),(25,33),(27,31),(27,14),(31,5),(33,5),(37,14),(37,31),(39,33),(39,39)],fill=outline)
  d.polygon([(27,37),(27,34),(29,32),(29,14),(32,8),(35,14),(35,32),(37,34),(37,37)],fill=steel)
  d.polygon([(29,14),(32,8),(32,37),(28,37),(28,34),(29,32)],fill=light)
  d.rectangle((32,15,33,32),fill=dark);d.line((30,16,30,30),fill=bright)
  d.polygon([(21,37),(24,37),(28,40),(36,40),(40,37),(43,37),(43,41),(38,44),(26,44),(21,41)],fill=outline)
  d.polygon([(22,38),(24,38),(28,41),(36,41),(40,38),(42,38),(42,40),(37,43),(27,43),(22,40)],fill=mid)
  d.line((28,41,36,41),fill=light)
 # Rotação pixelada sem antialias, ocupando o mesmo espaço entre opções.
 rotated=im.rotate(-45,resample=Image.Resampling.NEAREST,expand=True)
 bb=rotated.getbbox(); crop=rotated.crop(bb)
 crop.thumbnail((57,57),Image.Resampling.NEAREST)
 canvas=Image.new('RGBA',(64,64));canvas.alpha_composite(crop,((64-crop.width)//2,(64-crop.height)//2))
 return canvas

icons={k:sprite(k) for k in 'ABCD'}
for k,im in icons.items(): im.save(out/f'espada-icone-{k.lower()}.png')
# Comparação ampliada e amostra efetiva de 16 x 16, ambas sem interpolação.
sheet=Image.new('RGB',(1200,640),'#232922'); dr=ImageDraw.Draw(sheet)
dr.text((30,20),'ESPADAS • ÍCONES PARA ANÁLISE',font=bold,fill='#f0f2e7')
dr.text((30,53),'Mesma paleta de ferro e madeira para comparar a forma',font=font,fill='#c6d1c2')
for i,(k,im) in enumerate(icons.items()):
 x=22+i*296; dr.rounded_rectangle((x,95,x+275,600),radius=8,fill='#303a30',outline='#788a73',width=2)
 dr.text((x+16,106),f'OPÇÃO {k}',font=bold,fill='#ecf2e8')
 dr.rectangle((x+25,150,x+249,374),fill='#1d251f',outline='#71816e')
 sheet.paste(im.resize((224,224),Image.Resampling.NEAREST),(x+25,150),im.resize((224,224),Image.Resampling.NEAREST))
 dr.text((x+17,399),'Tamanho de inventário',font=font,fill='#c6d1c2')
 native=im.resize((16,16),Image.Resampling.NEAREST)
 enlarged=native.resize((128,128),Image.Resampling.NEAREST)
 dr.rectangle((x+73,437,x+201,565),fill='#1d251f');sheet.paste(enlarged,(x+73,437),enlarged)
sheet.save(out/'espada-icones-comparacao.png')

def uri(image):
 b=io.BytesIO();image.save(b,'PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
descriptions={'A':'Lâmina estreita e guarda curta reta.','B':'Lâmina mais larga, faceta central e guarda reta.','C':'Lâmina afilada e guarda curva em degraus.','D':'Lâmina com base escalonada, sulco e guarda inclinada.'}
cards=[]
for k,im in icons.items():
 small=im.resize((16,16),Image.Resampling.NEAREST)
 cards.append(f'<article><h2>Opção {k}</h2><p>{descriptions[k]}</p><img class="big" src="{uri(im)}" alt="Espada {k}, ampliada"><h3>Redução a 16 × 16</h3><img class="small" src="{uri(small)}" alt="Espada {k}, imagem reduzida a 16 pixels"><p><small>Veja também o tamanho real: <img class="actual" src="{uri(small)}" alt="Espada {k} em 16 pixels"></small></p></article>')
html='''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Espadas — estudo de ícones</title><style>body{font:16px/1.5 system-ui;margin:auto;padding:24px;max-width:1250px;background:#1c241d;color:#ecf2e8}p{color:#c6d1c2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}article{padding:16px;background:#303a30;border:1px solid #71816e;border-radius:8px}h2{margin:0}h3{font-size:15px;margin-bottom:8px}img.big{width:100%;max-width:240px;aspect-ratio:1;background:#1d251f;image-rendering:pixelated}img.small{width:128px;height:128px;background:#1d251f;image-rendering:pixelated}img.actual{width:16px;height:16px;background:#1d251f;image-rendering:pixelated}a{color:#a9d7a7}</style></head><body><h1>Espadas · estudo de ícones</h1><p>Quatro desenhos autorais na mesma paleta de ferro e madeira, para comparar as silhuetas. Cada proposta aparece ampliada e reduzida a 16 × 16; as cores podem ser adaptadas aos materiais depois.</p><div class="grid">'''+''.join(cards)+'''</div><p>Referências: <a href="https://www.pngall.com/diamond-sword-png/download/140719/">espada pixelada do Minecraft</a> e <a href="https://pixie.haus/pixelart/330164/silvery-blue-sword-orange-guard-sprite">espada pixel art de fantasia</a>. Somente inspiração; não utilizamos os arquivos das referências. Nenhuma opção foi implementada no jogo.</p></body></html>'''
(out/'espada-icones-opcoes.html').write_text(html,encoding='utf8')

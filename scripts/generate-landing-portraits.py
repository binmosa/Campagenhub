"""
Generate the illustrative creator portraits for the public home page.

  python3 scripts/generate-landing-portraits.py "$OPENROUTER_API_KEY" /tmp/portraits
  for f in /tmp/portraits/*.png; do sips -s format jpeg -s formatOptions 82 -Z 640 "$f" \
      --out frontend/public/images/creators/$(basename "$f" .png).jpg; done

Uses OpenRouter's google/gemini-2.5-flash-image (~$0.04 per image). Already
generated files are skipped, so re-running only fills in what is missing.
Keys match frontend/src/pages/landing/mocks/portraits.ts.
"""
import json, base64, os, sys, urllib.request
KEY=sys.argv[1]; OUT=sys.argv[2]
os.makedirs(OUT, exist_ok=True)
BASE="Photorealistic, high-resolution portrait photograph of a social media content creator, looking at camera with a warm genuine smile, natural daylight, shallow depth of field, clean softly blurred modern background, head-and-shoulders, square 1:1 crop, editorial quality, no text, no watermark, no logos. Subject: "
SUBJECTS={
 'selam':  'a smiling young Ethiopian woman content creator with braided hair, holding a smartphone as if filming a story, bright room with plants',
 'amara':  'a young Black Ethiopian woman in her early 20s with natural curly hair, small gold earrings, holding a phone as if filming a story',
 'kofi':   'a Black man in his late 20s with a short beard, casual streetwear, ring light reflection in his eyes, creator studio behind him',
 'leila':  'a Middle Eastern woman in her 30s wearing a stylish hijab, laughing, cafe setting, holding a coffee cup',
 'ravi':   'a South Asian man in his mid 30s, glasses, neat beard, tech reviewer at a desk with soft LED lights',
 'mei':    'an East Asian woman in her mid 20s with shoulder-length dark hair, beauty creator, soft pink studio light',
 'sofia':  'a Latina woman in her 40s with wavy brown hair, confident, fitness creator in athletic wear outdoors at golden hour',
 'jonas':  'a white man in his 20s with blue eyes and light brown hair, travel vlogger with a camera strap, mountain backdrop out of focus',
 'grace':  'a Black woman in her early 50s with short natural grey-streaked hair, elegant, food creator in a bright kitchen',
}
for name, desc in SUBJECTS.items():
    path=os.path.join(OUT, f'{name}.png')
    if os.path.exists(path): continue
    body=json.dumps({"model":"google/gemini-2.5-flash-image","modalities":["image","text"],"messages":[{"role":"user","content":BASE+desc+"."}]}).encode()
    req=urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=body, headers={"Authorization":f"Bearer {KEY}","Content-Type":"application/json"})
    try:
        d=json.load(urllib.request.urlopen(req, timeout=180))
        imgs=d['choices'][0]['message'].get('images') or []
        if not imgs: print(name,'NO IMAGE', json.dumps(d)[:200]); continue
        b=base64.b64decode(imgs[0]['image_url']['url'].split(',',1)[1]); open(path,'wb').write(b)
        print(name,'ok',len(b),'cost',d.get('usage',{}).get('cost'))
    except Exception as e:
        print(name,'ERR',e)

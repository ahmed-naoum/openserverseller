#!/usr/bin/env python
"""
Generate the photographs the store themes and the OpenDesign niches ship with.

    python scripts/theme-images.py --list                 # what would be made
    python scripts/theme-images.py --set themes           # the 12 themes
    python scripts/theme-images.py --set niches           # the 12 OpenDesign niches
    python scripts/theme-images.py --set all --only souk  # one set, one theme
    python scripts/theme-images.py --set all --key hero   # one picture per set
    python scripts/theme-images.py --set all --force      # redo existing files

Two providers. With GEMINI_API_KEY set, Gemini (gemini-2.5-flash-image by
default; --model gemini-3-pro-image-preview for the higher-quality model).
Without a key, Pollinations (https://pollinations.ai, open source, no key):
the same prompts, fetched by URL and stored locally, so the storefront never
hotlinks a third-party generator. --provider forces one or the other.

Each picture is written to backend/uploads/themes/<set>/<key>.jpg, resized to
at most 1600px wide, and the manifest backend/src/shared/templates/assets.ts
is rewritten from what is on disk — so a theme never references a picture
that does not exist. Existing files are kept unless --force is given, which
makes the script safe to rerun after a failure.

Every prompt asks for a text-free photograph: the themes put their own words
over and beside the pictures, and generated text in a picture is the one thing
a seller cannot edit.
"""

import argparse
import io
import os
import re
import sys
import time
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'uploads' / 'themes'
MANIFEST = ROOT / 'src' / 'shared' / 'templates' / 'assets.ts'

KEYS = {
    'hero': ('16:9', 'a wide hero banner'),
    'story': ('4:3', 'an editorial photograph beside a paragraph about the brand'),
    'promo': ('3:2', 'a promotional photograph beside an offer'),
    'h1': ('1:1', 'a square card picture'),
    'h2': ('1:1', 'a square card picture'),
    'h3': ('1:1', 'a square card picture'),
}

# Pixel sizes per aspect ratio for the URL provider.
SIZES = {'16:9': (1280, 720), '4:3': (1200, 900), '3:2': (1200, 800), '1:1': (1024, 1024)}


def pollinations(prompt: str, aspect: str, out: Path, seed: int) -> None:
    """Fetches one picture from Pollinations (open source, no key) into `out`."""
    w, h = SIZES[aspect]
    url = (
        'https://image.pollinations.ai/prompt/' + urllib.parse.quote(prompt)
        + f'?width={w}&height={h}&seed={seed}&nologo=true&model=flux'
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'silacod-theme-images/1.0'})
    with urllib.request.urlopen(req, timeout=180) as res:
        data = res.read()
    if len(data) < 5000:
        raise RuntimeError(f'response too small ({len(data)} bytes)')
    out.write_bytes(data)

# A store sells things, so every picture is a still life of the thing. The
# first run asked for "no people looking at the camera" and got portraits in
# half the tech set; the generator reads any mention of a person as a subject.
# Nobody is mentioned anywhere now — not in the style, not in a scene.
# ── Unsplash: short search queries per picture (a search engine wants keywords, not prose).
UNSPLASH_QUERIES = {
    'novatrade': {'hero': 'abstract 3d sphere neon purple blue dark', 'story': 'stock trading dashboard screen dark', 'promo': 'headphones neon light dark', 'h1': 'wireless earbuds neon', 'h2': 'smartwatch closeup dark', 'h3': 'gaming setup rgb neon'},
    'estateo': {'hero': 'modern villa infinity pool sunset', 'story': 'luxury interior living room designer', 'promo': 'architect blueprint desk samples', 'h1': 'marble side table interior', 'h2': 'velvet armchair elegant', 'h3': 'modern house pool night lights'},
    'cleanenergy': {'hero': 'wind turbines solar panels field sunrise', 'story': 'solar installer rooftop worker', 'promo': 'home battery storage wall', 'h1': 'solar panels house roof', 'h2': 'solar farm aerial', 'h3': 'electric car charging home'},
    'matcha': {'hero': 'iced matcha latte wooden tray berries', 'story': 'tea plantation terraces green', 'promo': 'matcha ceremony set gift', 'h1': 'matcha powder bowl whisk', 'h2': 'matcha latte glass', 'h3': 'ceramic tea cups japanese'},
    'growplus': {'hero': 'runner sprinting city street motion', 'story': 'sneakers on shelves store', 'promo': 'black hoodie sneakers streetwear', 'h1': 'running shoes orange black', 'h2': 'athlete stretching rooftop city', 'h3': 'gym equipment bench dark'},
    'chronotask': {'hero': 'laptop desk planner productivity bright', 'story': 'startup team meeting office', 'promo': 'macbook notebook coffee flat lay', 'h1': 'keyboard closeup minimal', 'h2': 'sticky notes planning board', 'h3': 'office monitors team working'},
    'hideaway': {'hero': 'cabin forest night warm lights', 'story': 'woodworker workshop tools', 'promo': 'craftsman wood furniture making', 'h1': 'wooden bench cabin blanket', 'h2': 'cabin bedroom wooden bed', 'h3': 'wooden kitchen utensils bowls'},
    'finpay': {'hero': 'smartphone banking app hand teal', 'story': 'gift cards colorful stack', 'promo': 'phone laptop desk finance minimal', 'h1': 'credit cards fan', 'h2': 'courier delivery scooter city', 'h3': 'mobile payment phone tap'},
    'casablanca': {'hero': 'luxury watch gold dark background macro', 'story': 'perfume boutique interior luxury', 'promo': 'jewelry gift box gold ribbon', 'h1': 'gold bracelet jewelry macro', 'h2': 'oud perfume bottle amber', 'h3': 'mens luxury watch macro'},
    'jasmine': {'hero': 'skincare oil dropper bottle pink flowers', 'story': 'botanical ingredients rose petals oil', 'promo': 'skincare products pink background', 'h1': 'serum bottle glass dropper', 'h2': 'cream jar cosmetic white', 'h3': 'facial mist spray bottle'},
    'souk': {'hero': 'moroccan ceramics tajine market colorful', 'story': 'moroccan women cooperative argan', 'promo': 'moroccan spices market cones', 'h1': 'argan oil bottle', 'h2': 'tajine pottery moroccan', 'h3': 'moroccan rug pattern'},
    'atlas': {'hero': 'minimal fashion neutral tones studio model', 'story': 'tailor measuring shirt', 'promo': 'wool sweater flat lay neutral', 'h1': 'white shirt hanger minimal', 'h2': 'black loafers leather', 'h3': 'wool coat texture grey'},
    'niche-beauty': {'hero': 'skincare bottles flowers stone minimal', 'story': 'rose petals argan oil ingredients', 'promo': 'skincare mini bottles box', 'h1': 'serum dropper glass', 'h2': 'night oil bottle candle warm', 'h3': 'face mist droplets'},
    'niche-fashion': {'hero': 'clothing rack boutique loft light', 'story': 'seamstress sewing machine atelier', 'promo': 'folded clothes shoe box neutral', 'h1': 'sneakers white studio', 'h2': 'hoodie cap streetwear flat lay', 'h3': 'leather handbag chair'},
    'niche-tech': {'hero': 'gadgets earbuds smartwatch phone dark flat lay', 'story': 'technician repair electronics workshop', 'promo': 'headphones dark studio', 'h1': 'earbuds charging case', 'h2': 'smartwatch on wrist', 'h3': 'gaming controller neon'},
    'niche-food': {'hero': 'honey olive oil spices rustic table', 'story': 'olive harvest farmer', 'promo': 'gourmet gift basket', 'h1': 'honey jar wooden', 'h2': 'iced tea mint lemon', 'h3': 'dates nuts bowl'},
    'niche-home': {'hero': 'living room linen sofa wooden table plants', 'story': 'carpenter assembling chair workshop', 'promo': 'bedroom linen bed morning', 'h1': 'linen sofa cushions', 'h2': 'wooden bed sheets', 'h3': 'dining table ceramic plates'},
    'niche-kids': {'hero': 'nursery crib toys pastel', 'story': 'baby shoes tiny hands', 'promo': 'newborn essentials blanket', 'h1': 'wooden stacking toy', 'h2': 'stroller park walk', 'h3': 'kids backpack school'},
    'niche-sport': {'hero': 'home gym dumbbells bench dark', 'story': 'runner lacing shoes track sunrise', 'promo': 'dumbbells yoga mat wooden floor', 'h1': 'kettlebell gym floor', 'h2': 'stationary bike window', 'h3': 'protein shaker gym bag'},
    'niche-jewelry': {'hero': 'gold necklace velvet dark luxury', 'story': 'jeweler workbench loupe ring', 'promo': 'jewelry gift box ribbon', 'h1': 'gold ring macro', 'h2': 'luxury watch macro dark', 'h3': 'gift box ribbon elegant'},
    'niche-saas': {'hero': 'laptop dashboard desk coffee bright', 'story': 'two people laptop coworking', 'promo': 'laptop phone notebook white desk', 'h1': 'laptop keyboard closeup', 'h2': 'tablet notes desk', 'h3': 'team laptops table'},
    'niche-energy': {'hero': 'solar panels rooftop mountains sky', 'story': 'technician installing solar panels', 'promo': 'home battery inverter garage', 'h1': 'rooftop solar kit house', 'h2': 'solar water pump field', 'h3': 'home battery unit wall'},
    'niche-artisan': {'hero': 'moroccan handicraft market pottery baskets', 'story': 'artisan painting ceramics hands', 'promo': 'moroccan gift box spices argan', 'h1': 'argan nuts oil', 'h2': 'stacked tajines market', 'h3': 'berber rug woven'},
    'niche-general': {'hero': 'courier handing parcel doorstep', 'story': 'warehouse packing boxes team', 'promo': 'wrapped parcel kraft ribbon', 'h1': 'shipping boxes stack', 'h2': 'delivery scooter city', 'h3': 'phone shopping app hand'},
}

PICKS = ROOT / 'uploads' / 'themes' / 'unsplash-picks.json'
CREDITS = ROOT / 'uploads' / 'themes' / 'CREDITS.md'


def unsplash_download(pick: dict, aspect: str, out: Path) -> None:
    """Fetches one chosen Unsplash photo from its CDN at 1600px wide (Unsplash License: free to use, credit appreciated)."""
    w, h = SIZES[aspect]
    url = f"{pick['raw']}?fm=jpg&q=82&w=1600&h={round(1600 * h / w)}&fit=crop&crop=entropy"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 silacod-theme-images/1.0'})
    with urllib.request.urlopen(req, timeout=180) as res:
        data = res.read()
    if len(data) < 5000:
        raise RuntimeError(f'response too small ({len(data)} bytes)')
    out.write_bytes(data)


def unsplash_search(query: str, aspect: str, used: set, key: str):
    """The official API, when UNSPLASH_ACCESS_KEY is set: the first free photo not used yet."""
    orientation = 'squarish' if aspect == '1:1' else 'landscape'
    url = 'https://api.unsplash.com/search/photos?' + urllib.parse.urlencode({'query': query, 'per_page': 15, 'orientation': orientation, 'content_filter': 'high'})
    req = urllib.request.Request(url, headers={'Authorization': f'Client-ID {key}', 'Accept-Version': 'v1'})
    with urllib.request.urlopen(req, timeout=60) as res:
        data = json.loads(res.read().decode('utf-8'))
    for p in data.get('results', []):
        raw = p['urls']['raw'].split('?')[0]
        if 'plus.unsplash.com' in raw or p.get('premium') or p['id'] in used or p['width'] < 1400:
            continue
        return {'id': p['id'], 'raw': raw, 'by': p['user']['name'], 'username': p['user']['username']}
    return None


def write_credits(picks: dict) -> None:
    lines = ['# Theme photographs', '', 'Photos from Unsplash (https://unsplash.com/license). Credit is appreciated by the photographers:', '']
    for k in sorted(picks):
        p = picks[k]
        lines.append(f"- `{k}` - {p.get('by', '?')} (https://unsplash.com/@{p.get('username', '')}) - https://unsplash.com/photos/{p.get('id', '')}")
    CREDITS.write_text('\n'.join(lines) + '\n', encoding='utf-8')

STYLE = (
    'Photorealistic commercial product still life, product only, empty scene, nobody, no people, no person, no face, no hands, '
    'sharp focus, studio lighting, shallow depth of field, rich but true colours, '
    'absolutely no text, no letters, no logos, no watermarks, no UI, no borders.'
)

# One scene per theme and per niche; the key says which subject the picture carries.
SETS = {
    # ── the twelve themes ──────────────────────────────────────────────────
    'novatrade': {
        'mood': 'dark studio, deep navy background, cyan and violet neon rim light, futuristic',
        'hero': 'premium wireless earbuds, a smartwatch and a small drone arranged on a dark glass surface',
        'story': 'a sealed gadget box, a multimeter and a smartphone on a dark workbench under blue light',
        'promo': 'flagship over-ear headphones on a dark reflective surface with neon reflections',
        'h1': 'wireless earbuds in an open charging case', 'h2': 'a smartwatch standing on a dark charging dock, glowing screen', 'h3': 'a gaming controller and mechanical keyboard, neon glow',
    },
    'estateo': {
        'mood': 'bright architectural interior, white walls, warm oak floor, golden hour, refined',
        'hero': 'a luxurious modern villa living room with floor-to-ceiling windows and designer furniture',
        'story': 'a designer console table with a sculptural lamp in a sunlit gallery-like room',
        'promo': 'a private consultation table with architectural drawings, samples of marble and brass',
        'h1': 'a marble and brass side table', 'h2': 'a curved velvet armchair in a bright room', 'h3': 'a modern villa exterior at dusk with a pool',
    },
    'cleanenergy': {
        'mood': 'clean daylight, Moroccan countryside, fresh greens and blue sky, optimistic',
        'hero': 'solar panels on the flat roof of a white Moroccan house under a bright blue sky',
        'story': 'a solar panel, mounting rails and an inverter laid out on a flat rooftop with tools beside them',
        'promo': 'a home battery unit and inverter mounted on a clean white wall',
        'h1': 'a boxed residential solar kit: two panels, an inverter and coiled cables on a rooftop', 'h2': 'a solar water pump unit with its small panel beside an irrigation channel', 'h3': 'a slim lithium home battery unit mounted on a white wall, close-up',
    },
    'matcha': {
        'mood': 'soft natural light, ceramics, olive green and cream tones, calm',
        'hero': 'a bowl of freshly whisked matcha with a bamboo whisk on a linen cloth, ceramic cups around',
        'story': 'terraced green tea fields in soft morning mist',
        'promo': 'a gift box with a tin of matcha, a bamboo whisk and a ceramic bowl, opened on a wooden table',
        'h1': 'ceremonial matcha powder in a ceramic bowl', 'h2': 'an iced matcha latte in a tall glass', 'h3': 'a wooden tea set with a bamboo scoop',
    },
    'growplus': {
        'mood': 'moody urban, black and orange, hard flash, concrete and metal, streetwear',
        'hero': 'a pair of fresh sneakers on wet concrete under orange street light, low angle',
        'story': 'a stack of folded hoodies and boxed sneakers in a dark stockroom with a single orange light',
        'promo': 'a heavyweight black hoodie and cap laid flat on dark concrete',
        'h1': 'a single sneaker floating on black background with orange rim light', 'h2': 'a black hoodie, running shorts and sneakers laid flat on a rooftop at night', 'h3': 'a gym bag, skipping rope and water bottle on a bench',
    },
    'chronotask': {
        'mood': 'bright modern office, blue accents, clean desk, productive',
        'hero': 'a clean desk with a laptop showing a blurred dashboard, coffee and notebook, morning light',
        'story': 'a desk setup with a laptop stand, mechanical keyboard, lamp and notebook in a bright office',
        'promo': 'a laptop, a smartphone and headphones neatly arranged on a white desk',
        'h1': 'a laptop keyboard close-up with soft blue light', 'h2': 'a planner notebook, a pen and a tablet on a white desk', 'h3': 'a row of monitors in a modern office',
    },
    'hideaway': {
        'mood': 'warm evening light, cedar wood, amber and charcoal, cosy mountain cabin',
        'hero': 'a solid cedar dining table in a mountain cabin with a fireplace and warm lamps',
        'story': 'a sanded oak plank, a hand plane and wood shavings on a workshop bench',
        'promo': 'a wooden board with a carpenter pencil, a ruler and an oil tin on a workbench',
        'h1': 'a raw oak bench with a wool blanket', 'h2': 'a wooden bed frame with linen sheets in a cabin', 'h3': 'wooden bowls, a candle holder and a cutting board',
    },
    'finpay': {
        'mood': 'clean, mint and teal, bright, trustworthy, minimal',
        'hero': 'a fanned set of gift cards and a sealed envelope on a bright white table',
        'story': 'a neat stack of gift cards and an invoice on a white desk with a teal pen',
        'promo': 'a smartphone showing a blurred balance screen next to a coffee cup on a white table',
        'h1': 'a fanned set of colourful gift cards', 'h2': 'a courier scooter in a Moroccan street', 'h3': 'a smartphone on a white table showing a blurred app screen',
    },
    'casablanca': {
        'mood': 'midnight blue and gold, luxurious, velvet, dramatic soft light',
        'hero': 'a luxury watch and a bottle of oud perfume on dark velvet with gold accents',
        'story': 'an elegant boutique interior with glass cabinets and warm brass lighting',
        'promo': 'an opened gift box with a gold ribbon revealing a jewellery case on dark velvet',
        'h1': 'a gold bracelet on dark velvet', 'h2': 'an amber perfume bottle with gold cap', 'h3': 'a men’s watch with a leather strap, close-up',
    },
    'jasmine': {
        'mood': 'soft pink and cream, botanical, gentle morning light, feminine',
        'hero': 'skincare bottles and a dropper with rose petals and saffron threads on a marble surface',
        'story': 'a laboratory bench with glass beakers, botanical ingredients and a notebook, soft light',
        'promo': 'a travel-size skincare set in a pink box with a ribbon, rose petals around',
        'h1': 'a serum dropper bottle with golden liquid', 'h2': 'a jar of cream with argan nuts', 'h3': 'a facial mist bottle with water droplets',
    },
    'souk': {
        'mood': 'warm ochre and terracotta, sunlit Moroccan souk, handmade textures',
        'hero': 'argan oil bottles, saffron in a glass jar and painted Safi pottery on a wooden table in a sunlit riad',
        'story': 'argan nuts, a stone grinder and a bowl of argan paste on a wooden table in a bright workshop',
        'promo': 'a wooden gift box with argan oil, saffron, honey and a small painted bowl',
        'h1': 'a bottle of argan oil with argan nuts', 'h2': 'a stack of painted Safi ceramic tajines', 'h3': 'a folded Berber wool rug with geometric pattern',
    },
    'atlas': {
        'mood': 'black and white with a touch of warm grey, minimal, high-key studio',
        'hero': 'a minimalist rail of neutral wool coats and cotton shirts in a white studio',
        'story': 'a folded white cotton shirt with a measuring tape on a clean table, monochrome',
        'promo': 'a folded merino sweater and leather belt on a white surface',
        'h1': 'a white cotton shirt on a wooden hanger', 'h2': 'a pair of black leather loafers', 'h3': 'a grey wool coat detail, close-up of the fabric',
    },
    # ── the twelve OpenDesign niches ──────────────────────────────────────
    'niche-beauty': {
        'mood': 'soft pastel, botanical, clean morning light',
        'hero': 'a curated set of skincare bottles with fresh flowers on a stone surface',
        'story': 'natural ingredients — argan nuts, rose petals, saffron — beside small glass bottles',
        'promo': 'a discovery skincare box opened with three mini bottles',
        'h1': 'a serum bottle with a dropper', 'h2': 'a night oil bottle beside a candle', 'h3': 'a face mist with water droplets',
    },
    'niche-fashion': {
        'mood': 'bright studio, neutral tones, editorial fashion',
        'hero': 'a rail of contemporary clothes and a pair of sneakers in a bright loft',
        'story': 'a sewing machine with fabric and thread spools in a small atelier',
        'promo': 'folded clothes and a shoe box with a sale-free clean look on a white table',
        'h1': 'a fresh pair of sneakers on white', 'h2': 'a hoodie and cap flat lay', 'h3': 'a leather bag on a chair',
    },
    'niche-tech': {
        'mood': 'dark studio, blue and cyan light, futuristic',
        'hero': 'earbuds, a smartwatch and a phone on a dark glass surface with blue light',
        'story': 'a sealed device box and a multimeter on a dark workbench',
        'promo': 'headphones on a dark reflective surface',
        'h1': 'earbuds in a case', 'h2': 'a smartwatch on a charging dock', 'h3': 'a gaming controller with neon light',
    },
    'niche-food': {
        'mood': 'warm natural light, wooden table, rustic',
        'hero': 'jars of honey, olive oil, tea and spices on a rustic wooden table',
        'story': 'a basket of freshly harvested olives under an olive tree in a sunlit grove',
        'promo': 'a gift basket with honey, oil and tea tins',
        'h1': 'a jar of golden honey', 'h2': 'a glass of iced tea with mint', 'h3': 'a bowl of dates and nuts',
    },
    'niche-home': {
        'mood': 'bright interior, warm wood and linen, cosy',
        'hero': 'a modern living room with a wooden table, linen sofa and warm lamps',
        'story': 'a half-assembled wooden chair with tools in a workshop',
        'promo': 'a bedroom with a wooden bed and linen sheets in soft light',
        'h1': 'a linen sofa with cushions', 'h2': 'a wooden bed with folded sheets', 'h3': 'a dining table set with ceramic plates',
    },
    'niche-kids': {
        'mood': 'bright, sky blue and soft pink, playful, safe',
        'hero': 'a nursery with a wooden crib, plush toys and a stroller in soft daylight',
        'story': 'tiny baby shoes on a soft knitted blanket',
        'promo': 'a newborn essentials box with a blanket, bottle and plush toy',
        'h1': 'a wooden stacking toy', 'h2': 'a stroller in a park', 'h3': 'a small backpack and water bottle for school',
    },
    'niche-sport': {
        'mood': 'high contrast, red and black, energetic gym light',
        'hero': 'a home gym corner with dumbbells, a bench and a kettlebell, dramatic light',
        'story': 'running shoes on a track lane at sunrise',
        'promo': 'adjustable dumbbells and a yoga mat on a wooden floor',
        'h1': 'a kettlebell on rubber floor', 'h2': 'a stationary bike by a window', 'h3': 'a protein shaker and towel on a bench',
    },
    'niche-jewelry': {
        'mood': 'midnight blue and gold, velvet, dramatic soft light, luxury',
        'hero': 'a gold necklace, a watch and a perfume bottle on dark velvet',
        'story': 'a gold ring beside a jeweller loupe on a workbench',
        'promo': 'an open gift box with a gold ribbon and a jewellery case',
        'h1': 'a gold ring on velvet', 'h2': 'a men’s watch close-up', 'h3': 'a gift box with a ribbon',
    },
    'niche-saas': {
        'mood': 'bright office, blue accents, clean',
        'hero': 'a clean desk with a laptop showing a blurred dashboard and a coffee cup',
        'story': 'a laptop and a notebook on a desk in a bright coworking space',
        'promo': 'a laptop and a phone on a white desk with a notebook',
        'h1': 'a laptop keyboard close-up', 'h2': 'a notebook and pen beside a tablet', 'h3': 'two laptops and a coffee cup on a meeting table',
    },
    'niche-energy': {
        'mood': 'bright daylight, green fields, blue sky, optimistic',
        'hero': 'solar panels on a white rooftop under a blue sky with a distant Atlas mountain',
        'story': 'a solar panel with mounting rails and tools laid on a rooftop',
        'promo': 'a home battery and inverter on a clean wall',
        'h1': 'a rooftop solar kit', 'h2': 'a solar pump by an irrigation channel', 'h3': 'a home battery unit',
    },
    'niche-artisan': {
        'mood': 'warm ochre, sunlit riad, handmade textures',
        'hero': 'argan oil, saffron, painted pottery and a woven basket on a wooden table in a riad',
        'story': 'painted ceramic bowls and brushes drying in a sunlit workshop',
        'promo': 'a wooden gift box with argan oil, saffron and a small painted bowl',
        'h1': 'a bottle of argan oil with nuts', 'h2': 'stacked painted tajines', 'h3': 'a folded Berber rug',
    },
    'niche-general': {
        'mood': 'bright, clean, orange accents, friendly',
        'hero': 'a stack of wrapped parcels on a doorstep in a Moroccan city, bright day',
        'story': 'parcels, tape and a label printer on a packing table in a bright warehouse',
        'promo': 'a neatly wrapped parcel with a ribbon on a white table',
        'h1': 'a stack of parcels ready to ship', 'h2': 'a delivery scooter in a sunny street', 'h3': 'a phone on a table with a blurred shop screen',
    },
}


def prompt_for(set_id: str, key: str) -> str:
    scene = SETS[set_id]
    _, use = KEYS[key]
    return f"Commercial product still life: {scene[key]}, centered. Scene mood: {scene['mood']}. Intended as {use} for an online store. {STYLE}"


def write_manifest() -> dict:
    entries = {}
    if OUT.exists():
        for folder in sorted(OUT.iterdir()):
            if not folder.is_dir():
                continue
            files = {}
            for key in KEYS:
                f = folder / f'{key}.jpg'
                if f.exists() and f.stat().st_size > 0:
                    files[key] = f'/uploads/themes/{folder.name}/{key}.jpg'
            if files:
                entries[folder.name] = files
    src = MANIFEST.read_text(encoding='utf-8')
    body = '{\n' + ''.join(
        f"  '{name}': {{ " + ', '.join(f"{k}: '{v}'" for k, v in files.items()) + ' },\n'
        for name, files in entries.items()
    ) + '}'
    src = re.sub(
        r'export const THEME_ASSETS: Record<string, Partial<Record<AssetKey, string>>> = \{.*?\n\};',
        f'export const THEME_ASSETS: Record<string, Partial<Record<AssetKey, string>>> = {body};',
        src,
        flags=re.S,
    ) if '= {' in src and '\n};' in src else re.sub(
        r'export const THEME_ASSETS: Record<string, Partial<Record<AssetKey, string>>> = \{\};',
        f'export const THEME_ASSETS: Record<string, Partial<Record<AssetKey, string>>> = {body};',
        src,
    )
    MANIFEST.write_text(src, encoding='utf-8')
    return entries


def save_jpeg(png_path: Path, jpg_path: Path, max_width: int = 1600) -> None:
    from PIL import Image
    img = Image.open(png_path).convert('RGB')
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)), Image.LANCZOS)
    img.save(jpg_path, 'JPEG', quality=84, optimize=True, progressive=True)
    png_path.unlink(missing_ok=True)
    # The compiler builds -w400/-w640/-w960 variants beside an original the
    # first time it renders it; a replaced original must not keep serving the
    # old picture at small widths, so its stale variants go with it.
    for variant in jpg_path.parent.glob(f'{jpg_path.stem}-w*{jpg_path.suffix}'):
        variant.unlink(missing_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--set', choices=['themes', 'niches', 'all'], default='all')
    ap.add_argument('--only', help='one set id, e.g. souk or niche-beauty')
    ap.add_argument('--key', choices=list(KEYS), help='one picture key')
    ap.add_argument('--model', default='gemini-2.5-flash-image')
    ap.add_argument('--provider', choices=['auto', 'gemini', 'pollinations', 'unsplash'], default='auto', help='auto: Unsplash picks file if present, else Gemini when GEMINI_API_KEY is set, else Pollinations')
    ap.add_argument('--seed', type=int, default=11, help='base seed for the URL provider; change it to get different pictures')
    ap.add_argument('--force', action='store_true', help='regenerate files that exist')
    ap.add_argument('--list', action='store_true', help='print the plan and exit')
    ap.add_argument('--manifest-only', action='store_true', help='rewrite assets.ts from disk and exit')
    args = ap.parse_args()

    if args.manifest_only:
        entries = write_manifest()
        print(f'manifest: {sum(len(v) for v in entries.values())} pictures in {len(entries)} sets')
        return 0

    ids = [i for i in SETS if (args.set == 'all' or (args.set == 'niches') == i.startswith('niche-'))]
    if args.only:
        ids = [i for i in ids if i == args.only]
        if not ids:
            print(f'unknown set: {args.only}', file=sys.stderr)
            return 2
    keys = [args.key] if args.key else list(KEYS)
    jobs = [(i, k) for i in ids for k in keys if args.force or not (OUT / i / f'{k}.jpg').exists()]

    if args.list:
        for i, k in jobs:
            print(f'{i:16} {k:6} {KEYS[k][0]:5} {prompt_for(i, k)[:110]}…')
        print(f'{len(jobs)} pictures to generate')
        return 0

    provider = args.provider
    if provider == 'auto':
        provider = 'unsplash' if (PICKS.exists() or os.environ.get('UNSPLASH_ACCESS_KEY')) else 'gemini' if os.environ.get('GEMINI_API_KEY') else 'pollinations'
    if provider == 'gemini' and not os.environ.get('GEMINI_API_KEY'):
        print('GEMINI_API_KEY is not set. Get one at https://aistudio.google.com/apikey, or run with --provider pollinations.', file=sys.stderr)
        return 1
    print(f'provider: {provider}', flush=True)

    picks = json.loads(PICKS.read_text(encoding='utf-8')) if PICKS.exists() else {}
    used = {p['id'] for p in picks.values() if isinstance(p, dict) and p.get('id')}
    gen = None
    if provider == 'gemini':
        sys.path.insert(0, str(Path.home() / '.claude' / 'skills' / 'gemini-imagegen' / 'scripts'))
        from gemini_images import GeminiImageGenerator  # type: ignore
        gen = GeminiImageGenerator(model=args.model)
    failed = []
    for n, (i, k) in enumerate(jobs, 1):
        folder = OUT / i
        folder.mkdir(parents=True, exist_ok=True)
        png = folder / f'{k}.png'
        jpg = folder / f'{k}.jpg'
        print(f'[{n}/{len(jobs)}] {i}/{k} ({KEYS[k][0]}) …', end=' ', flush=True)
        for attempt in range(3):
            try:
                if provider == 'unsplash':
                    pick = picks.get(f'{i}/{k}')
                    if not pick and os.environ.get('UNSPLASH_ACCESS_KEY'):
                        pick = unsplash_search(UNSPLASH_QUERIES[i][k], KEYS[k][0], used, os.environ['UNSPLASH_ACCESS_KEY'])
                        if pick:
                            picks[f'{i}/{k}'] = pick
                            used.add(pick['id'])
                            PICKS.write_text(json.dumps(picks, indent=1), encoding='utf-8')
                    if not pick:
                        raise RuntimeError('no Unsplash pick for this picture (run the search step or set UNSPLASH_ACCESS_KEY)')
                    unsplash_download(pick, KEYS[k][0], png)
                elif gen is not None:
                    gen.generate(prompt_for(i, k), png, aspect_ratio=KEYS[k][0])
                else:
                    # A different seed per picture and per attempt, so a retry is a new draw.
                    pollinations(prompt_for(i, k), KEYS[k][0], png, args.seed + n * 7 + attempt)
                if not png.exists():
                    raise RuntimeError('no image in the response')
                save_jpeg(png, jpg)
                print(f'ok ({jpg.stat().st_size // 1024} KB)')
                break
            except Exception as err:  # noqa: BLE001 — retried, then reported
                wait = 4 * (attempt + 1)
                print(f'\n   attempt {attempt + 1} failed: {err} — retrying in {wait}s', flush=True)
                time.sleep(wait)
        else:
            failed.append(f'{i}/{k}')
            print('FAILED')
        write_manifest()  # after every picture, so a crash keeps what was made

    entries = write_manifest()
    if provider == 'unsplash' and picks:
        write_credits(picks)
    print(f'manifest: {sum(len(v) for v in entries.values())} pictures in {len(entries)} sets')
    if failed:
        print('failed: ' + ', '.join(failed), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

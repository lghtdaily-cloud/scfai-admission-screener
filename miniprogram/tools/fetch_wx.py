#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""下载微信公众号文章图片到本地（微信图片有 Referer 防盗链，必须带 Referer 落本地后才能在网页引用）。

用法:
  python tools/fetch_wx.py                       # 下载 config 里默认的两个链接
  python tools/fetch_wx.py <url> [<url2> ...]    # 下载指定链接

产出:
  web/cache/meta.json     抓取到的标题/封面/正文图/正文文本
  web/posters/<slug>_NN.jpg  按顺序编号的正文图 + _cover.jpg 封面
"""
import os
import re
import sys
import json
import urllib.request
import urllib.parse
import gzip
import zlib
import html as _h

UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003123) NetType/WIFI Language/zh_CN")
REFERER = "https://mp.weixin.qq.com/"
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(BASE, 'web', 'cache')
POSTERS = os.path.join(BASE, 'web', 'posters')
os.makedirs(CACHE, exist_ok=True)
os.makedirs(POSTERS, exist_ok=True)

DEFAULT_URLS = [
    "https://mp.weixin.qq.com/s/qD1AMiRfk1xEaUtJcYS2nQ",
    "https://mp.weixin.qq.com/s/AwqF_MTp7-ImkwN8_pW_DA",
]


def _decode(raw, enc):
    if 'gzip' in enc:
        raw = gzip.decompress(raw)
    elif 'deflate' in enc:
        try:
            raw = zlib.decompress(raw)
        except Exception:
            raw = zlib.decompress(raw, -15)
    return raw


def http(url, referer=None, binary=False, timeout=45):
    req = urllib.request.Request(url)
    req.add_header('User-Agent', UA)
    req.add_header('Accept', '*/*')
    req.add_header('Accept-Language', 'zh-CN,zh;q=0.9')
    req.add_header('Accept-Encoding', 'gzip, deflate')
    req.add_header('Referer', referer or REFERER)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        raw = _decode(raw, r.headers.get('Content-Encoding', ''))
        ctype = r.headers.get('Content-Type', '')
    if binary:
        return raw, ctype
    cs = 'utf-8'
    m = re.search(r'charset=([\w\-]+)', ctype)
    if m:
        cs = m.group(1)
    return raw.decode(cs, 'ignore'), ctype


def pick(pats, s, group=1):
    for p in pats:
        m = re.search(p, s, re.S | re.I)
        if m:
            return m.group(group).strip()
    return ''


def unesc(s):
    return s.replace('\\/', '/').replace('\\"', '"').replace('&amp;', '&').replace('&quot;', '"')


def slug(url):
    m = re.search(r'/s[/?]([A-Za-z0-9_\-]+)', url)
    return m.group(1) if m else 'page'


def ext_of(u, ctype):
    m = re.search(r'wx_fmt=(\w+)', u)
    if m:
        return '.' + ('jpg' if m.group(1) == 'jpeg' else m.group(1))
    if 'png' in ctype:
        return '.png'
    if 'gif' in ctype:
        return '.gif'
    if 'webp' in ctype:
        return '.webp'
    return '.jpg'


def analyze(url):
    page, _ = http(url, referer=REFERER)
    s = page
    title = pick([r'<meta property="og:title" content="([^"]+)"',
                  r'var msg_title\s*=\s*[\'"]([^\'"]*)[\'"]',
                  r'<h1[^>]*class="rich_media_title"[^>]*>(.*?)</h1>',
                  r'<title>(.*?)</title>'], s)
    title = re.sub(r'<[^>]+>', '', title).strip()
    title = _h.unescape(title)

    desc = _h.unescape(pick([r'<meta property="og:description" content="([^"]*)"',
                             r'<meta name="description" content="([^"]*)"'], s))

    cover = unesc(pick([r'var msg_cdn_url\s*=\s*[\'"]([^\'"]+)[\'"]',
                        r'<meta property="og:image" content="([^"]+)"',
                        r'var cover_img\s*=\s*[\'"]([^\'"]+)[\'"]'], s))

    m = re.search(r'<div[^>]+id="js_content"[^>]*>(.*?)</div>\s*(?:<script|<div[^>]+id="js_)', s, re.S)
    body = m.group(1) if m else s

    imgs = [unesc(x) for x in re.findall(r'data-src="([^"]+)"', body)]
    if not imgs:
        imgs = [unesc(x) for x in re.findall(r'<img[^>]+src="([^"]+)"', body)]

    txt = re.sub(r'<script[\s\S]*?</script>', '', body)
    txt = re.sub(r'<style[\s\S]*?</style>', '', txt)
    txt = re.sub(r'<br\s*/?>', '\n', txt)
    txt = re.sub(r'</(p|div|section|h\d|li|tr)>', '\n', txt)
    txt = re.sub(r'<[^>]+>', '', txt)
    txt = _h.unescape(txt)
    txt = re.sub(r'[ \t\u00a0]+', ' ', txt)
    txt = re.sub(r'\n{3,}', '\n\n', txt).strip()

    return dict(url=url, title=title, desc=desc, cover=cover, images=imgs, text=txt)


def download(info):
    s = slug(info['url'])
    saved = []
    # 封面
    if info['cover']:
        try:
            b, ct = http(info['cover'], binary=True)
            if len(b) > 1024:
                fp = os.path.join(POSTERS, s + '_cover' + ext_of(info['cover'], ct))
                open(fp, 'wb').write(b)
                saved.append(os.path.basename(fp))
        except Exception as e:
            print('  封面失败', e)
    # 正文图（去掉与封面重复的）
    seen = {info['cover']}
    for i, u in enumerate(info['images'][:20]):
        if u in seen:
            continue
        seen.add(u)
        try:
            b, ct = http(u, binary=True)
            if len(b) < 1024:
                continue
            fp = os.path.join(POSTERS, '%s_%02d%s' % (s, i, ext_of(u, ct)))
            open(fp, 'wb').write(b)
            saved.append(os.path.basename(fp))
        except Exception as e:
            print('  图 %02d 失败 %s' % (i, e))
    info['saved'] = saved
    return saved


def main():
    urls = sys.argv[1:] or DEFAULT_URLS
    out = []
    for u in urls:
        print('处理', u)
        info = analyze(u)
        print('  标题:', info['title'])
        print('  正文图:', len(info['images']), '张 / 正文', len(info['text']), '字')
        download(info)
        print('  已保存:', len(info['saved']), '张 -> web/posters/')
        out.append(info)
    open(os.path.join(CACHE, 'meta.json'), 'w', encoding='utf-8').write(
        json.dumps(out, ensure_ascii=False, indent=2))
    for i in out:
        open(os.path.join(CACHE, slug(i['url']) + '.txt'), 'w', encoding='utf-8').write(
            i['title'] + '\n\n' + i['text'])
    print('完成 ->', os.path.relpath(os.path.join(CACHE, 'meta.json'), BASE))


if __name__ == '__main__':
    main()

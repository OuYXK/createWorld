#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
农产品图片批量过滤工具

过滤规则（任一命中即判为不合格，移入 _rejected 对应分类目录）：
  1. 重复：文件内容完全相同，或解码后的像素完全一致（同图换格式/重压缩但像素不变）
  2. 人脸：检测到任意人脸（YuNet，低阈值）
  3. 车牌：OCR 命中中国车牌号格式
  4. 文字：OCR 识别出任何中英文文字（严格模式，默认）

用法示例：
  python3 filter_images.py /workspace/新数据
  python3 filter_images.py /workspace/新数据 --dry-run
  python3 filter_images.py /workspace/新数据 --text-keywords-only
"""

import argparse
import csv
import hashlib
import os
import re
import shutil
import signal
import sys
import time
from concurrent.futures import ProcessPoolExecutor

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageOps

IMAGE_EXTS = {".jpg", ".jpeg", ".jfif", ".png", ".bmp", ".webp", ".tif", ".tiff", ".gif"}

CAT_DUP = "重复"
CAT_FACE = "人脸"
CAT_PLATE = "车牌"
CAT_TEXT = "文字"
CAT_BAD = "无法解码"

# 分类优先级（同一张图命中多个原因时，按此顺序落入最靠前的目录，报告里仍记录全部原因）
PRIORITY = [CAT_DUP, CAT_FACE, CAT_PLATE, CAT_TEXT]

PROVINCES = "京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领"
PLATE_RE = re.compile(
    rf"[{PROVINCES}][A-HJ-NP-Z][A-HJ-NP-Z0-9]{{4,6}}"
)
# 省份字被 OCR 误识时的宽松车牌：6~7 位字母数字、至少 1 个字母、至少 4 个数字
PLATE_LOOSE_RE = re.compile(r"^[A-Z0-9]{6,7}$")

# 描述类关键词（仅在 --text-keywords-only 时用于判定文字违规，默认严格模式不使用）
KEYWORD_GROUPS = {
    "地名": [
        "省", "市", "县", "镇", "村", "区", "路", "街", "巷", "产地", "产区", "基地",
        "农场", "果园", "合作社", "市场", "批发", "直发", "发货", "新疆", "云南", "山东",
        "陕西", "广西", "海南", "四川", "福建", "赣南", "烟台", "褚橙", "赣州", "洛川",
    ],
    "重量": [
        "kg", "KG", "Kg", "公斤", "千克", "克", "g", "斤", "两", "吨", "磅", "lb",
        "净重", "毛重", "规格", "装", "箱", "件",
    ],
    "种类": [
        "苹果", "橙", "脐橙", "橘", "柑", "柚", "梨", "桃", "李", "杏", "枣", "葡萄",
        "草莓", "蓝莓", "樱桃", "荔枝", "龙眼", "芒果", "香蕉", "猕猴桃", "柿", "石榴",
        "火龙果", "菠萝", "哈密瓜", "西瓜", "蔬菜", "水果", "土豆", "番茄", "西红柿",
        "黄瓜", "辣椒", "大蒜", "生姜", "洋葱", "胡萝卜", "白菜", "萝卜", "玉米", "大米",
    ],
    "新鲜度": [
        "新鲜", "现摘", "现采", "当日", "当天", "刚摘", "新鲜采摘", "特级", "一级", "二级",
        "精品", "优选", "优质", "鲜", "嫩", "甜", "多汁", "脆", "包邮", "产地直供",
    ],
    "颜色": [
        "红", "绿", "黄", "紫", "白", "黑", "青", "橙", "蓝", "褐", "色",
    ],
}

OCR_LANG = "chi_sim+eng"
CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def _core(t):
    """去掉标点空白，仅保留汉字/字母/数字。"""
    return re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", t)


# ----------------------------- 基础工具 -----------------------------

def list_images(root):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith("_rejected")]
        for name in filenames:
            if os.path.splitext(name)[1].lower() in IMAGE_EXTS:
                out.append(os.path.join(dirpath, name))
    out.sort()
    return out


def sha256_file(path, buf_size=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(buf_size)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def load_rgb(path):
    """按 EXIF 方向解码为 RGB numpy 数组；失败返回 None。"""
    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)
            if getattr(im, "is_animated", False):
                im.seek(0)
            return np.asarray(im.convert("RGB"))
    except Exception:
        return None


def pixel_hash(rgb):
    """像素级指纹：尺寸 + 像素字节。像素完全相同才视为一模一样。"""
    h = hashlib.sha256()
    h.update(str(rgb.shape).encode())
    h.update(np.ascontiguousarray(rgb).tobytes())
    return h.hexdigest()


def _resize_long_side(img, target):
    h, w = img.shape[:2]
    long_side = max(h, w)
    if long_side <= target:
        return img, 1.0
    scale = target / float(long_side)
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA), scale


# ----------------------------- 人脸检测 -----------------------------

_FACE_DET = None


def _get_face_detector(model_path):
    global _FACE_DET
    if _FACE_DET is None:
        _FACE_DET = cv2.FaceDetectorYN.create(
            model_path, "", (320, 320),
            score_threshold=0.5,   # 低阈值：任何可检测到的人脸都过滤
            nms_threshold=0.3, top_k=5000,
        )
    return _FACE_DET


def detect_faces(bgr, model_path):
    det = _get_face_detector(model_path)
    img, _ = _resize_long_side(bgr, 1024)
    h, w = img.shape[:2]
    det.setInputSize((w, h))
    try:
        _, faces = det.detect(img)
    except Exception:
        return []
    if faces is None:
        return []
    res = []
    for f in faces:
        x, y, fw, fh = f[:4]
        score = float(f[-1])
        if score >= 0.5 and fw >= 8 and fh >= 8:
            res.append({"score": round(score, 3), "box": [int(x), int(y), int(fw), int(fh)]})
    return res


# ----------------------------- OCR -----------------------------

def _prep_for_ocr(rgb):
    """返回用于 OCR 的灰度变体：尺度归一图 + 反色二值图（兼顾深底浅字）。"""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape[:2]
    long_side = max(h, w)
    # 小图放大到 1600（最多 2 倍），大图压到 1600，兼顾小字号识别与速度
    scale = 1.0
    if long_side > 1600:
        scale = 1600.0 / long_side
    elif long_side < 1600:
        scale = min(2.0, 1600.0 / long_side)
    if scale != 1.0:
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    otsu_inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    return [("up", gray, (3, 11)), ("otsu_inv", otsu_inv, (11,))]


def ocr_tokens(rgb):
    """返回 OCR 词条列表 [(text, conf)]，取各变体/模式下的最高置信度并去重。"""
    tokens = {}
    for _, img, psms in _prep_for_ocr(rgb):
        if min(img.shape[:2]) < 12:
            continue
        for psm in psms:
            try:
                data = pytesseract.image_to_data(
                    img, lang=OCR_LANG, config=f"--psm {psm}",
                    output_type=pytesseract.Output.DICT,
                )
            except Exception:
                continue
            for i, txt in enumerate(data.get("text", [])):
                t = (txt or "").strip()
                core = _core(t)
                if not core:
                    continue
                try:
                    conf = float(data["conf"][i])
                except (ValueError, TypeError):
                    continue
                if conf < 0:
                    continue
                if core not in tokens or conf > tokens[core]:
                    tokens[core] = conf
    return list(tokens.items())


def is_meaningful_text(tokens, min_conf=55):
    """严格模式：识别出像样的中文/英文词条即算有文字。

    抑制纹理噪声：噪声常是 1~3 个字符的碎片或重复字符（ee/OO），
    因此要求中文 >= 2 字且置信度 >= 60，纯字母/字母数字 >= 4 位且置信度 >= 65。
    """
    for t, conf in tokens:
        core = _core(t)
        if len(core) < 2:
            continue
        # 重复单字符噪声：OO / eee
        if len(core) <= 3 and len(set(core)) == 1:
            continue
        cjk = len(CJK_RE.findall(core))
        letters = len(re.findall(r"[A-Za-z]", core))
        if cjk >= 2 and conf >= 60:
            return True, t
        if letters >= 4 and len(core) >= 4 and conf >= 65:
            return True, t
    return False, ""


def match_keywords(tokens, min_conf=55):
    seen = []
    for t, conf in tokens:
        if conf < min_conf:
            continue
        for group, words in KEYWORD_GROUPS.items():
            for w in words:
                if w in t:
                    seen.append(f"{group}:{w}")
    return sorted(set(seen))


def match_plates(tokens, min_conf=50):
    hits = set()
    for t, conf in tokens:
        if conf < min_conf:
            continue
        core = _core(t).upper()
        if not core:
            continue
        for m in PLATE_RE.finditer(core):
            hits.add(m.group(0))
        if PLATE_LOOSE_RE.match(core):
            letters = len(re.findall(r"[A-Z]", core))
            digits = len(re.findall(r"\d", core))
            if letters >= 1 and digits >= 4:
                hits.add(core)
    return sorted(hits)


# ----------------------------- 单图检查 -----------------------------

def inspect_image(job):
    path, rel, model_path, kwargs = job
    rgb = load_rgb(path)
    if rgb is None:
        return {"rel": rel, "ok": False, "error": "无法解码", "size": os.path.getsize(path)}
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    h, w = rgb.shape[:2]

    faces = detect_faces(bgr, model_path)
    tokens = ocr_tokens(rgb)
    has_text, text_sample = is_meaningful_text(tokens, kwargs["min_conf"])
    plates = match_plates(tokens)
    keywords = match_keywords(tokens)

    reasons = []
    if faces:
        reasons.append(CAT_FACE)
    if plates and kwargs["plate"]:
        reasons.append(CAT_PLATE)
    if kwargs["text_mode"] == "strict":
        if has_text:
            reasons.append(CAT_TEXT)
    else:
        if keywords:
            reasons.append(CAT_TEXT)

    return {
        "rel": rel,
        "ok": True,
        "error": "",
        "size": os.path.getsize(path),
        "w": w,
        "h": h,
        "faces": len(faces),
        "face_max": max([f["score"] for f in faces], default=0),
        "plates": plates,
        "text_sample": text_sample if reasons and CAT_TEXT in reasons else "",
        "keywords": keywords,
        "reasons": reasons,
        "pix": pixel_hash(rgb),
        "sha": sha256_file(path),
    }


# ----------------------------- 主流程 -----------------------------

def main():
    ap = argparse.ArgumentParser(description="农产品图片批量过滤")
    ap.add_argument("root", help="待处理根目录")
    ap.add_argument("--reject-dir", default="_rejected", help="不合格图片目录名")
    ap.add_argument("--report", default=None, help="CSV 报告路径（默认写到根目录 _rejected/report.csv）")
    ap.add_argument("--workers", type=int, default=max(1, min(4, os.cpu_count() or 2)))
    ap.add_argument("--face-model", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "face_detection_yunet_2023mar.onnx"))
    ap.add_argument("--text-mode", choices=["strict", "keywords"], default="strict",
                    help="strict=任何中英文文字都过滤；keywords=仅描述性关键词")
    ap.add_argument("--min-conf", type=float, default=55, help="OCR 词条置信度下限")
    ap.add_argument("--no-plate", action="store_true", help="关闭车牌检测（文字规则仍会覆盖）")
    ap.add_argument("--dry-run", action="store_true", help="只输出报告，不移动文件")
    ap.add_argument("--limit", type=int, default=0, help="仅处理前 N 张（调试用）")
    args = ap.parse_args()

    root = os.path.abspath(os.path.expanduser(args.root))
    if not os.path.isdir(root):
        sys.exit(f"目录不存在：{root}")

    model_path = os.path.abspath(args.face_model)
    if not os.path.exists(model_path):
        sys.exit(f"人脸模型缺失：{model_path}")

    files = list_images(root)
    if args.limit:
        files = files[: args.limit]
    if not files:
        sys.exit("未找到图片文件")

    reject_root = os.path.join(root, args.reject_dir)
    report_path = args.report or os.path.join(reject_root, "report.csv")
    os.makedirs(os.path.dirname(report_path) or ".", exist_ok=True)

    t0 = time.time()
    print(f"共发现 {len(files)} 张图片，开始处理（workers={args.workers}，文字模式={args.text_mode}）", flush=True)

    kwargs = {
        "min_conf": args.min_conf,
        "text_mode": args.text_mode,
        "plate": not args.no_plate,
    }
    jobs = [(p, os.path.relpath(p, root), model_path, kwargs) for p in files]

    results = []
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        for i, res in enumerate(ex.map(inspect_image, jobs, chunksize=4), 1):
            results.append(res)
            if i % 20 == 0 or i == len(jobs):
                print(f"  进度 {i}/{len(jobs)}  用时 {time.time() - t0:.0f}s", flush=True)

    # ---- 去重：文件哈希相同或像素指纹相同 ----
    by_sha, by_pix = {}, {}
    for r in results:
        if not r["ok"]:
            continue
        by_sha.setdefault(r["sha"], []).append(r)
        by_pix.setdefault(r["pix"], []).append(r)

    dup_of = {}
    for group in list(by_sha.values()) + list(by_pix.values()):
        if len(group) < 2:
            continue
        # 保留体积最大（通常为原始图）的一张，其余判为重复
        group.sort(key=lambda r: (-r["size"], r["rel"]))
        keeper = group[0]["rel"]
        for r in group[1:]:
            if r["rel"] not in dup_of:
                dup_of[r["rel"]] = keeper

    # ---- 归类与移动 ----
    rows = []
    counts = {CAT_DUP: 0, CAT_FACE: 0, CAT_PLATE: 0, CAT_TEXT: 0, CAT_BAD: 0}
    kept = 0
    for r in results:
        reasons = list(r["reasons"]) if r["ok"] else [CAT_BAD]
        if r["rel"] in dup_of:
            reasons.insert(0, CAT_DUP)
        primary = next((c for c in PRIORITY if c in reasons), "") if r["ok"] else CAT_BAD
        moved_to = ""
        if primary:
            counts[primary] += 1
            src = os.path.join(root, r["rel"])
            dst = os.path.join(reject_root, primary, r["rel"])
            if not args.dry_run:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                base, ext = os.path.splitext(dst)
                n = 1
                while os.path.exists(dst):
                    dst = f"{base}__{n}{ext}"
                    n += 1
                shutil.move(src, dst)
            moved_to = os.path.relpath(dst, root)
        else:
            kept += 1

        rows.append({
            "相对路径": r["rel"],
            "判定": "保留" if r["ok"] and not primary else ("无法解码" if not r["ok"] else "过滤"),
            "主要原因": primary,
            "全部原因": "|".join(reasons),
            "重复于": dup_of.get(r["rel"], ""),
            "人脸数": r.get("faces", 0) if r["ok"] else "",
            "人脸最高分": r.get("face_max", 0) if r["ok"] else "",
            "车牌": " ".join(r.get("plates", [])) if r["ok"] else "",
            "命中关键词": " ".join(r.get("keywords", [])) if r["ok"] else "",
            "OCR文字样例": (r.get("text_sample", "") if r["ok"] else r.get("error", "")),
            "宽": r.get("w", ""),
            "高": r.get("h", ""),
            "文件大小": r.get("size", ""),
            "移至": moved_to,
        })

    with open(report_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["相对路径"])
        writer.writeheader()
        writer.writerows(rows)

    print("\n===== 处理完成 =====")
    print(f"总计      : {len(files)}")
    print(f"保留      : {kept}")
    print(f"过滤-重复 : {counts[CAT_DUP]}")
    print(f"过滤-人脸 : {counts[CAT_FACE]}")
    print(f"过滤-车牌 : {counts[CAT_PLATE]}")
    print(f"过滤-文字 : {counts[CAT_TEXT]}")
    if counts[CAT_BAD]:
        print(f"过滤-无法解码 : {counts[CAT_BAD]}")
    print(f"报告      : {report_path}")
    if args.dry_run:
        print("（dry-run：未移动任何文件）")
    print(f"耗时      : {time.time() - t0:.1f}s")


if __name__ == "__main__":
    signal.signal(signal.SIGINT, lambda *_: sys.exit(130))
    main()

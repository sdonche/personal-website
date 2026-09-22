#!/usr/bin/env python3
"""Mechanically split assets/js/plant.js IIFE into Plant.* ES modules."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/js/plant.js"
OUT_DIR = ROOT / "assets/js/plant"
ENTRY = ROOT / "assets/js/plant.js"

MODULE_FUNCS = {
    "util": [
        "isStubTag", "isSisterSiteTag", "isHeuvellandSiteTag", "isMixingTag",
        "isRefiningTag", "isConchingTag", "isTemperingTag", "isMouldingTag",
        "isProcessAreaTag", "isPackagingTag", "drawingForTag", "pathOf",
        "drift", "clamp", "batchStepIndex", "formatValue", "escapeHtml",
        "equipState", "getActiveFault", "setDrawingFault", "areaHealth",
        "plantModeSummary", "timeAgo", "liveReadout", "sparklineSvg",
        "tagFromAlarmPath", "firstOutAlarmId",
    ],
    "state": ["defaultState", "loadState", "saveState"],
    "sim": ["computeLive", "recordTrends", "syncScenarioAlarms"],
    "tree": [
        "tagsUnder", "stubTagsRelative", "tagsUnderStub", "renderTagButton",
        "renderFolder", "renderEquipFolder", "renderLine3Folder",
        "renderStubLineFolder", "mixingTagsUnder", "renderMixingFolder",
        "temperingTagsUnder", "renderTemperingFolder", "areaTagsUnder",
        "renderRefiningFolder", "renderConchingFolder", "renderMouldingFolder",
        "renderSisterSiteFolder", "buildTree", "updateTreeValues", "renderTree",
        "paintSisterSpark",
    ],
    "pid": [
        "portsFor", "equipKeyForTag", "balloon", "flange", "flowArrow",
        "equipBlock", "divertValve", "mixValve", "batchBadge", "pumpSymbol",
        "massFlowLine", "buildPackagingPid", "buildMixingPid", "buildTemperingPid",
        "buildRefiningPid", "buildConchingPid", "buildMouldingPid",
        "buildOverviewPid", "buildPid", "clearPidHover", "applyPidHover",
        "paintPid", "renderPid",
    ],
    "faceplate": ["renderDetail", "writeSpeedSp"],
    "alarms": ["navigateToAlarm", "renderAlarms", "updateAlarmTimes", "ackAll", "ackOne"],
    "routing": [
        "parseHash", "drawingFromHash", "syncHash", "applyHashState",
        "setActiveDrawing", "selectTag",
    ],
    "actions": [
        "setScenario", "setMixScenario", "setTemperScenario", "setRefineScenario",
        "setConcheScenario", "setMouldScenario", "recoverAll", "resetReject",
        "clearCartonerJam", "resetLine",
    ],
    "ui": [
        "renderKpis", "renderBatchTrail", "renderAll", "wire", "tickOnce", "startClock",
    ],
    "main": ["init"],
}

MUTABLES = {
    "state", "live", "trends", "tick", "timer", "treeBuilt", "pidBuilt",
    "pidHover", "reducedMotion",
}

SKIP_RENAME = {
    "window", "document", "location", "history", "localStorage", "Math", "Date",
    "Map", "Set", "JSON", "Number", "String", "Object", "Array", "CSS",
    "URLSearchParams", "HTMLDetailsElement", "undefined", "NaN", "Infinity",
}


def extract_iife_body(text: str) -> str:
    m = re.search(r"^\(\(\)\s*=>\s*\{", text, re.M)
    if not m:
        raise SystemExit("IIFE start not found")
    body = text[m.end():]
    body = re.sub(r"\n\}\)\(\);\s*$", "\n", body)
    return body


def find_top_level_names(body: str):
    consts = re.findall(r"^  const ([A-Za-z_][A-Za-z0-9_]*)\s*=", body, re.M)
    lets = re.findall(r"^  let ([A-Za-z_][A-Za-z0-9_]*)\s*=", body, re.M)
    fns = re.findall(r"^  function ([A-Za-z_][A-Za-z0-9_]*)\s*\(", body, re.M)
    return consts, lets, fns


def better_split(body: str):
    lines = body.splitlines(keepends=True)
    n = len(lines)
    i = 0
    blocks = []

    def read_fn(start_idx, preface):
        depth = 0
        started = False
        j = start_idx
        while j < n:
            for ch in lines[j]:
                if ch == "{":
                    depth += 1
                    started = True
                elif ch == "}":
                    depth -= 1
            j += 1
            if started and depth == 0:
                break
        return preface + "".join(lines[start_idx:j]), j

    def read_const(start_idx, preface):
        j = start_idx
        depth_b = depth_p = depth_k = 0
        chunk = preface
        while j < n:
            line = lines[j]
            chunk += line
            # Ignore braces inside line comments when checking balance / terminator
            code_part = line.split("//", 1)[0]
            depth_b += code_part.count("{") - code_part.count("}")
            depth_p += code_part.count("(") - code_part.count(")")
            depth_k += code_part.count("[") - code_part.count("]")
            j += 1
            # Terminator: a statement-ending ; outside comments
            code_so_far = "".join(
                (ln.split("//", 1)[0] for ln in chunk.splitlines(True))
            )
            if depth_b <= 0 and depth_p <= 0 and depth_k <= 0 and code_so_far.rstrip().endswith(";"):
                break
        return chunk, j

    while i < n:
        preface_start = i
        while i < n:
            stripped = lines[i].strip()
            if stripped == "" or stripped.startswith("//"):
                i += 1
                continue
            if stripped.startswith("/*") or stripped.startswith("*") or stripped.startswith("*/"):
                i += 1
                continue
            if stripped.startswith("/**"):
                while i < n and "*/" not in lines[i]:
                    i += 1
                if i < n:
                    i += 1
                continue
            break
        preface = "".join(lines[preface_start:i])
        if i >= n:
            if preface.strip():
                blocks.append(("raw", "", preface))
            break

        line = lines[i]
        m = re.match(r"  const ([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
        if m:
            chunk, i = read_const(i, preface)
            blocks.append(("const", m.group(1), chunk))
            continue
        m = re.match(r"  let ([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
        if m:
            chunk, i = read_const(i, preface)
            blocks.append(("let", m.group(1), chunk))
            continue
        m = re.match(r"  function ([A-Za-z_][A-Za-z0-9_]*)\s*\(", line)
        if m:
            chunk, i = read_fn(i, preface)
            blocks.append(("function", m.group(1), chunk))
            continue
        blocks.append(("raw", "", preface + line))
        i += 1
    return blocks


def strip_strings_and_comments(text: str):
    """Yield (is_code, chunk) preserving order."""
    out = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            if j < 0:
                out.append((False, text[i:])); break
            out.append((False, text[i:j])); i = j; continue
        if ch == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            if j < 0:
                out.append((False, text[i:])); break
            out.append((False, text[i:j+2])); i = j + 2; continue
        if ch in "'\"`":
            quote = ch
            j = i + 1
            buf = [ch]
            while j < n:
                if text[j] == "\\":
                    buf.append(text[j:j+2]); j += 2; continue
                if text[j] == quote:
                    buf.append(quote); j += 1; break
                if quote == "`" and text[j] == "$" and j + 1 < n and text[j+1] == "{":
                    # flush string so far, then code expr
                    out.append((False, "".join(buf)))
                    out.append((False, "${"))
                    j += 2
                    depth = 1
                    start = j
                    while j < n and depth:
                        if text[j] == "{": depth += 1; j += 1
                        elif text[j] == "}":
                            depth -= 1
                            if depth == 0: break
                            j += 1
                        elif text[j] in "'\"":
                            q2 = text[j]; j += 1
                            while j < n and text[j] != q2:
                                j += 2 if text[j] == "\\" else 1
                            j += 1
                        else:
                            j += 1
                    out.append((True, text[start:j]))
                    if j < n and text[j] == "}":
                        out.append((False, "}")); j += 1
                    buf = []
                    continue
                buf.append(text[j]); j += 1
            out.append((False, "".join(buf)))
            i = j
            continue
        # code run
        j = i + 1
        while j < n:
            c = text[j]
            if c == "/" and j + 1 < n and text[j+1] in "/*":
                break
            if c in "'\"`":
                break
            j += 1
        out.append((True, text[i:j]))
        i = j
    return out


def collect_local_bindings(code: str) -> set[str]:
    """Find local const/let/function/param names in a function body (shallow-ish)."""
    locals_ = set()
    for m in re.finditer(r"\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)", code):
        locals_.add(m.group(1))
    for m in re.finditer(r"\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", code):
        locals_.add(m.group(1))
    # params of nested functions + arrow params are hard; also catch forEach((x) and (a, b) =>
    for m in re.finditer(r"\(([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\)\s*=>", code):
        for p in m.group(1).split(","):
            p = p.strip()
            if p:
                locals_.add(p)
    for m in re.finditer(r"\b(?:map|filter|forEach|some|every|find|reduce|sort)\(\(([A-Za-z_][A-Za-z0-9_]*)", code):
        locals_.add(m.group(1))
    # catch single param arrow: x =>
    for m in re.finditer(r"(?<![A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]*)\s*=>", code):
        locals_.add(m.group(1))
    return locals_


def rename_code_chunk(code: str, names: set[str], locals_: set[str]) -> str:
    rename = names - locals_

    def repl(m):
        word = m.group(1)
        if word not in rename:
            return word
        start, end = m.start(), m.end()
        before = code[:start]
        after = code[end:end + 12]
        # property key in object literal: ({|,) ws word ws :
        if re.search(r"[\{,]\s*$", before) and re.match(r"\s*:", after):
            return word
        # property access foo.bar — but allow spread ...bar
        if start > 0 and code[start - 1] == ".":
            if not (start >= 3 and code[start - 3:start] == "..."):
                return word
        return "Plant." + word

    return re.sub(r"\b([A-Za-z_][A-Za-z0-9_]*)\b", repl, code)


def rename_idents_scoped(text: str, names: set[str], extra_locals: set[str] | None = None) -> str:
    """Rename Plant names in text, respecting string/comments and local bindings."""
    # For full function text, collect locals from whole text
    code_only = "".join(c for is_c, c in strip_strings_and_comments(text) if is_c)
    locals_ = collect_local_bindings(code_only)
    if extra_locals:
        locals_ |= extra_locals
    parts = []
    for is_code, chunk in strip_strings_and_comments(text):
        if is_code:
            parts.append(rename_code_chunk(chunk, names, locals_))
        else:
            parts.append(chunk)
    return "".join(parts)


def convert_function(name: str, text: str, names: set[str]) -> str:
    m2 = re.search(r"function " + re.escape(name) + r"\s*\(([^)]*)\)\s*\{", text)
    if not m2:
        raise SystemExit(f"bad function {name}")
    raw_params = m2.group(1).strip()
    params = set()
    if raw_params:
        for p in raw_params.split(","):
            p = p.strip()
            if not p:
                continue
            p = re.split(r"\s*=\s*", p)[0].strip()
            p = p.lstrip("{[").split(":")[0].strip()
            mm = re.match(r"[A-Za-z_][A-Za-z0-9_]*", p)
            if mm:
                params.add(mm.group(0))

    header_end = m2.end()  # points after {
    body = text[header_end:text.rfind("}")]
    pref = text[:m2.start()]
    # Recursive calls should resolve to Plant.name (do not treat own name as local)
    renamed_body = rename_idents_scoped(body, names, params)

    out = f"{pref}Plant.{name} = function {name}({raw_params}) {{{renamed_body}}}\n"
    out = out.replace("Plant.Plant.", "Plant.")
    return out


def convert_const(kind: str, name: str, text: str, names: set[str]) -> str:
    # Replace "const name =" / "let name =" with Plant.name =
    t = re.sub(
        rf"^(\s*)(?:const|let) {re.escape(name)}\s*=",
        rf"\1Plant.{name} =",
        text,
        count=1,
        flags=re.M,
    )
    # RHS rename — name itself on LHS already Plant.name; treat name as local so RHS
    # self-refs rare. Exclude name from rename for the binding line's pattern.
    # For RHS, rename all plant names except we need SITE etc.
    # Mask "Plant.name =" header
    t = rename_idents_scoped(t, names - {name}, set())
    # After rename, LHS may have become Plant.Plant.name if name was renamed — fix
    t = re.sub(rf"Plant\.Plant\.{name}\s*=", f"Plant.{name} =", t, count=1)
    t = t.replace("Plant.Plant.", "Plant.")
    # Ensure no `const Plant.` left
    t = re.sub(rf"^(\s*)(?:const|let) (Plant\.{name}\s*=)", rf"\1\2", t, count=1, flags=re.M)
    return t


def strip_outer_indent(text: str) -> str:
    lines = []
    for line in text.splitlines(True):
        lines.append(line[2:] if line.startswith("  ") else line)
    return "".join(lines)


def main():
    text = SRC.read_text()
    body = extract_iife_body(text)
    consts, lets, fns = find_top_level_names(body)
    print(f"found const={len(consts)} let={len(lets)} fn={len(fns)}")
    names = (set(consts) | set(lets) | set(fns)) - SKIP_RENAME

    blocks = better_split(body)
    print(f"blocks={len(blocks)}")

    fn_to_mod = {}
    for mod, flist in MODULE_FUNCS.items():
        for f in flist:
            fn_to_mod[f] = mod
    found_fns = {n for k, n, _ in blocks if k == "function"}
    for f in found_fns - set(fn_to_mod):
        print("UNMAPPED", f)
        fn_to_mod[f] = "ui"

    buckets = {m: [] for m in [
        "constants", "util", "state", "sim", "tree", "pid", "faceplate",
        "alarms", "routing", "actions", "ui", "main"
    ]}
    deferred_mutables = []

    for kind, name, chunk in blocks:
        if kind == "raw":
            if "DOMContentLoaded" in chunk:
                continue
            if "typedef" in chunk or "@typedef" in chunk:
                buckets["state"].append(strip_outer_indent(chunk))
            elif chunk.strip():
                buckets["constants"].append(strip_outer_indent(chunk))
            continue
        if kind == "function":
            converted = convert_function(name, chunk, names)
            buckets[fn_to_mod[name]].append(strip_outer_indent(converted))
        elif kind in ("const", "let"):
            converted = convert_const(kind, name, chunk, names)
            converted = strip_outer_indent(converted)
            if name in MUTABLES:
                deferred_mutables.append((name, converted))
            else:
                buckets["constants"].append(converted)

    # State mutables (safe placeholders). state loaded in boot().
    for name, converted in deferred_mutables:
        if name == "state":
            buckets["state"].append("Plant.state = null;\n")
        elif name == "reducedMotion":
            buckets["state"].append(
                'Plant.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;\n'
            )
        else:
            # use converted RHS but ensure assignment form
            buckets["state"].append(converted if converted.endswith("\n") else converted + "\n")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "ns.js").write_text(
        "/** Shared Plant HMI namespace (avoids circular imports). */\nexport const Plant = {};\n"
    )

    load_order = [
        "constants", "util", "state", "sim", "tree", "pid", "faceplate",
        "alarms", "routing", "actions", "ui", "main",
    ]
    for mod in load_order:
        body_txt = "".join(buckets[mod]).rstrip() + "\n"
        if mod == "main":
            content = (
                'import { Plant } from "./ns.js";\n\n'
                + body_txt
                + "\n"
                + "Plant.boot = function boot() {\n"
                + "  if (Plant.state == null) Plant.state = Plant.loadState();\n"
                + "  if (document.readyState === \"loading\") {\n"
                + "    document.addEventListener(\"DOMContentLoaded\", () => Plant.init());\n"
                + "  } else {\n"
                + "    Plant.init();\n"
                + "  }\n"
                + "};\n\n"
                + "export function boot() {\n"
                + "  Plant.boot();\n"
                + "}\n"
            )
            content = re.sub(
                r'document\.addEventListener\("DOMContentLoaded",\s*Plant\.init\);',
                "/* boot() registers DOMContentLoaded */",
                content,
            )
        else:
            content = 'import { Plant } from "./ns.js";\n\n' + body_txt
        (OUT_DIR / f"{mod}.js").write_text(content)
        print(f"wrote {mod}.js ({len(content)} bytes)")

    imports = "\n".join(f'import "./plant/{m}.js";' for m in load_order if m != "main")
    ENTRY.write_text(
        "/* plant.js — Heuvelland plant HMI entry (ES modules). */\n"
        f"{imports}\n"
        'import { boot } from "./plant/main.js";\n\n'
        "boot();\n"
    )
    print("wrote entry")

if __name__ == "__main__":
    main()

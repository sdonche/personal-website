#!/usr/bin/env python3
"""Generate assets/js/skill-meta.js (per-chip name, description, icon) for the
Skills Toolbelt. Brand glyphs come from Simple Icons (CC0), recoloured to the
site cyan; concept/no-brand tools get a cyan stroke role-icon.

Source data: scripts/skill-icons.jsonl (slug<TAB>title<TAB>path-d), fetched from
https://cdn.jsdelivr.net/npm/simple-icons@13/icons/<slug>.svg. To add a brand
icon, append a line for its slug, then add the skill below and re-run:  make icons
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# --- brand icon paths pulled from Simple Icons (slug -> path d) ---
brand = {}
with open(os.path.join(HERE, "skill-icons.jsonl")) as f:
    for line in f:
        slug, title, d = line.rstrip("\n").split("\t")
        brand[slug] = d

# skill slug -> (Name, description, icon spec)
# icon spec: ("brand", simpleicons-slug) or ("role", role-key)
SKILLS = [
    # Industry 4.0 / IIoT
    ("ignition",          "Ignition",          "Industrial platform for SCADA, HMI and MES on the plant floor.", ("role","bolt")),
    ("scada",             "SCADA",             "Watch and steer plant processes in real time.", ("role","gauge")),
    ("hmi",               "HMI",               "Operator screens for monitoring and running equipment.", ("role","screen")),
    ("mqtt",              "MQTT",              "Lightweight publish/subscribe messaging, the backbone of IIoT data.", ("brand","mqtt")),
    ("sparkplug-b",       "Sparkplug B",       "MQTT spec that makes industrial device data self-describing.", ("role","bolt")),
    ("unified-namespace", "Unified Namespace", "A single real-time hub where all operational data lives.", ("role","hub")),
    ("mes",               "MES",               "Track production from order to output.", ("role","factory")),
    ("ot-it",             "OT/IT integration", "Bridging plant-floor equipment with business IT systems.", ("role","link")),
    ("opc-ua",            "OPC UA",            "Open standard for secure, vendor-neutral machine-to-machine data.", ("role","protocol")),
    ("node-red",          "Node-RED",          "Low-code flow tool for wiring up devices, APIs and services.", ("brand","nodered")),
    ("kepware",           "Kepware",           "Industrial connectivity hub: one driver set for many devices.", ("role","hub")),
    # Data & Backend
    ("python",            "Python",            "General-purpose language, my default for backend and data work.", ("brand","python")),
    ("fastapi",           "FastAPI",           "Modern, fast Python framework for building APIs.", ("brand","fastapi")),
    ("pydantic",          "Pydantic",          "Python data validation using type hints.", ("brand","pydantic")),
    ("sqlalchemy",        "SQLAlchemy",        "Python SQL toolkit and ORM.", ("brand","sqlalchemy")),
    ("postgresql",        "PostgreSQL",        "Open-source relational database, my default SQL store.", ("brand","postgresql")),
    ("sql-server",        "MS SQL Server",     "Microsoft's relational database, common on industrial estates.", ("role","database")),
    ("redis",             "Redis",             "In-memory store for caching, queues and fast lookups.", ("brand","redis")),
    ("influxdb",          "InfluxDB",          "Purpose-built time-series database for metrics and sensor data.", ("brand","influxdb")),
    ("timescaledb",       "TimescaleDB",       "Time-series database built on PostgreSQL.", ("brand","timescale")),
    ("kafka",             "Apache Kafka",      "Distributed streaming platform for high-throughput events.", ("brand","apachekafka")),
    ("mosquitto",         "Mosquitto",         "Lightweight open-source MQTT broker.", ("brand","eclipsemosquitto")),
    ("emqx",              "EMQX",              "Scalable distributed MQTT broker.", ("role","hub")),
    ("rabbitmq",          "RabbitMQ",          "Message broker for queues and pub/sub.", ("brand","rabbitmq")),
    ("factry",            "Factry",            "Open industrial historian for time-series process data.", ("role","database")),
    ("loki",              "Loki",              "Log aggregation for the Grafana observability stack.", ("role","logs")),
    ("data-pipelines",    "Data pipelines",    "Moving and shaping data between systems, reliably and on schedule.", ("role","flow")),
    ("grafana",           "Grafana",           "Dashboards and alerting for time-series and operational metrics.", ("brand","grafana")),
    ("prometheus",        "Prometheus",        "Metrics collection and alerting for systems and services.", ("brand","prometheus")),
    # Cloud & Infrastructure
    ("kubernetes",        "Kubernetes",        "Container orchestration: run and scale services across a cluster.", ("brand","kubernetes")),
    ("docker",            "Docker",            "Package applications into portable containers.", ("brand","docker")),
    ("helm",              "Helm",              "Package manager for Kubernetes applications.", ("brand","helm")),
    ("traefik",           "Traefik",           "Cloud-native reverse proxy and ingress controller.", ("brand","traefikproxy")),
    ("terraform",         "Terraform",         "Infrastructure as code: provision cloud and platform resources.", ("brand","terraform")),
    ("azure",             "Azure",             "Microsoft's cloud platform for compute, storage and services.", ("role","cloud")),
    ("gcp",               "GCP",               "Compute, data and ML services.", ("brand","googlecloud")),
    ("argo-cd",           "Argo CD",           "GitOps continuous delivery for Kubernetes.", ("brand","argo")),
    ("gitops",            "GitOps",            "Manage infrastructure and deploys through Git as source of truth.", ("role","loop")),
    ("ci-cd",             "CI/CD",             "Automated build, test and deploy pipelines.", ("role","loop")),
    ("github-actions",    "GitHub Actions",    "CI/CD automation built into GitHub.", ("brand","githubactions")),
    ("azure-devops",      "Azure DevOps",      "Microsoft's suite for pipelines, repos and boards.", ("role","infinity")),
    ("linux",             "Linux",             "The operating system everything runs on.", ("brand","linux")),
    ("git",               "Git",               "Version control for code and configuration.", ("brand","git")),
]

# stroke-based cyan role icons (inner markup, 24x24, fill none / stroke currentColor)
ROLE = {
  "database":  '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  "cloud":     '<path d="M7 18a4 4 0 0 1-.5-8 5 5 0 0 1 9.6-1.2A3.5 3.5 0 0 1 16.5 18H7z"/>',
  "hub":       '<circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="5" r="1.7"/><circle cx="19" cy="5" r="1.7"/><circle cx="5" cy="19" r="1.7"/><circle cx="19" cy="19" r="1.7"/><path d="M10.3 10.3 6.3 6.3M13.7 10.3l4-4M10.3 13.7l-4 4M13.7 13.7l4 4"/>',
  "link":      '<path d="M9 15l6-6"/><path d="M10.5 6.5l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13.5 17.5l-1 1a4 4 0 0 1-6-6l1-1"/>',
  "bolt":      '<path d="M13 3 5 13h5l-1 8 8-11h-5l1-7z"/>',
  "gauge":     '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M12 15l3.5-3.5"/><circle cx="12" cy="15" r="1"/>',
  "flow":      '<rect x="3" y="5" width="5" height="4" rx="1"/><rect x="3" y="15" width="5" height="4" rx="1"/><rect x="16" y="10" width="5" height="4" rx="1"/><path d="M8 7h4a2 2 0 0 1 2 2v1M8 17h4a2 2 0 0 0 2-2v-1"/>',
  "loop":      '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16"/><path d="M4 20v-4h4"/>',
  "factory":   '<path d="M3 20V10l5 3V10l5 3V6l6 3v11z"/><path d="M3 20h18"/>',
  "protocol":  '<path d="M9 3v5M15 3v5"/><path d="M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v5"/>',
  "screen":    '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8 20.5h8M12 16.5v4"/>',
  "logs":      '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  "infinity":  '<path d="M6.5 9.5c1.5-1.5 3.5-1.5 5 0l5 5c1.5 1.5 3.5 1.5 5 0s1.5-3.5 0-5-3.5-1.5-5 0l-5 5c-1.5 1.5-3.5 1.5-5 0s-1.5-3.5 0-5z"/>',
}

# Acronyms that benefit from spelling out, shown above the description
FULL = {
    "scada":  "Supervisory Control and Data Acquisition",
    "hmi":    "Human-Machine Interface",
    "mes":    "Manufacturing Execution System",
    "mqtt":   "Message Queuing Telemetry Transport",
    "opc-ua": "Open Platform Communications Unified Architecture",
    "ot-it":  "Operational Technology / Information Technology",
    "ci-cd":  "Continuous Integration / Continuous Delivery",
    "gcp":    "Google Cloud Platform",
}

meta = {}
missing = []
for slug, name, desc, (kind, key) in SKILLS:
    if kind == "brand":
        if key not in brand:
            missing.append(slug); continue
        entry = {"name": name, "desc": desc, "brand": brand[key]}
    else:
        entry = {"name": name, "desc": desc, "role": key}
    if slug in FULL:
        entry["full"] = FULL[slug]
    meta[slug] = entry

used_roles = sorted({v["role"] for v in meta.values() if "role" in v})
roles = {k: ROLE[k] for k in used_roles}

out = os.path.join(ROOT, "assets", "js", "skill-meta.js")
with open(out, "w") as f:
    f.write("/* Skill popover metadata — name, one-line description and an icon per\n")
    f.write("   skill chip. Brand icons are single-path glyphs from Simple Icons (CC0),\n")
    f.write("   recoloured to the site cyan via fill:currentColor. Tools without a brand\n")
    f.write("   glyph use a cyan stroke role-icon. Generated; edit the generator not here. */\n")
    f.write("window.SKILL_META = " + json.dumps(meta, ensure_ascii=False, indent=1) + ";\n")
    f.write("window.SKILL_ROLE_ICONS = " + json.dumps(roles, ensure_ascii=False, indent=1) + ";\n")

print("wrote", out)
print("skills:", len(meta), "| brand:", sum('brand' in v for v in meta.values()),
      "| role:", sum('role' in v for v in meta.values()))
print("missing:", missing)
print("roles used:", used_roles)

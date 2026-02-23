#!/usr/bin/env bash
# coherence-audit.sh — Claw Kernel Protocol cross-document coherence gate
# Usage: ./coherence-audit.sh [spec-dir] [report-dir]
# Output: coherence-report.md + coherence-report.json
# Exit: 0 = PASS, 1 = FAIL
# Requires: jq, python3 (with PyYAML), perl
set -euo pipefail

DIR="${1:-.}"
REPORT_DIR="${2:-$DIR}"
SPEC="$DIR/clawkernel-spec.md"
RUNTIME="$DIR/clawkernel-runtime-profile.md"
VECTORS="$DIR/clawkernel-test-vectors.md"
REPORT_MD="$REPORT_DIR/coherence-report.md"
REPORT_JSON="$REPORT_DIR/coherence-report.json"

CRITICAL=0; MINOR=0; INFO=0; FINDING_ID=0

FINDINGS_TSV=$(mktemp)
trap 'rm -f "$FINDINGS_TSV"' EXIT

add_finding() {
  local sev="$1" rule="$2" file="$3" line="$4" desc="$5"
  FINDING_ID=$((FINDING_ID + 1))
  case "$sev" in
    critical) CRITICAL=$((CRITICAL + 1)) ;;
    minor)    MINOR=$((MINOR + 1)) ;;
    info)     INFO=$((INFO + 1)) ;;
  esac
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$FINDING_ID" "$sev" "$rule" "$file" "$line" "$desc" >> "$FINDINGS_TSV"
}

bname() { basename "$1"; }

echo "=== Claw Kernel Protocol Coherence Gate ==="
echo "Spec:    $SPEC"
echo "Runtime: $RUNTIME"
echo "Vectors: $VECTORS"
echo ""

# ── R01: Error code coherence ──────────────────────────────────────────────
echo "[R01] Error code coherence..."

# Extract defined codes from error tables (pattern: | `-32xxx` |)
SPEC_CODES=$(perl -ne 'print "$1\n" if /\| `(-32\d+)`/' "$SPEC" | sort -u)
RUNTIME_CODES=$(perl -ne 'print "$1\n" if /\| `(-32\d+)`/' "$RUNTIME" | sort -u)

# Check double ownership
for code in $SPEC_CODES; do
  if echo "$RUNTIME_CODES" | grep -qx -- "$code"; then
    line=$(grep -n "| \`$code\`" "$RUNTIME" | head -1 | cut -d: -f1)
    add_finding critical R01 "$(bname "$RUNTIME")" "$line" "Error code $code defined in BOTH spec and runtime profile (double ownership)"
  fi
done

# All referenced codes across 3 files
ALL_REFS=$(perl -ne 'print "$1\n" while /(-32\d{3})/g' "$SPEC" "$RUNTIME" "$VECTORS" | sort -u)
ALL_DEFINED=$(printf '%s\n%s\n' "$SPEC_CODES" "$RUNTIME_CODES" | sort -u)

# Range endpoints used in prose (not operational codes)
RANGE_BOUNDS="-32000 -32099"

for code in $ALL_REFS; do
  # Skip range boundary values
  if echo "$RANGE_BOUNDS" | grep -qw -- "$code"; then
    continue
  fi
  if ! echo "$ALL_DEFINED" | grep -qx -- "$code"; then
    for f in "$SPEC" "$RUNTIME" "$VECTORS"; do
      ref_line=$(grep -n -- "$code" "$f" | head -1 | cut -d: -f1)
      if [ -n "$ref_line" ]; then
        add_finding critical R01 "$(bname "$f")" "$ref_line" "Error code $code referenced but not defined in any error table"
        break
      fi
    done
  fi
done

# ── R02: Method contracts ──────────────────────────────────────────────────
echo "[R02] Method contracts..."

METHODS=(
  "claw.initialize" "claw.initialized" "claw.status" "claw.shutdown"
  "claw.tool.call" "claw.tool.approve" "claw.tool.deny"
  "claw.swarm.delegate" "claw.swarm.report" "claw.swarm.broadcast" "claw.swarm.discover"
  "claw.memory.query" "claw.memory.store" "claw.memory.compact"
)

for m in "${METHODS[@]}"; do
  if ! grep -q "##### \`$m\`" "$SPEC"; then
    line=$(grep -n "$m" "$SPEC" | head -1 | cut -d: -f1)
    add_finding critical R02 "$(bname "$SPEC")" "${line:-0}" "Method $m has no contract heading"
  fi
  if ! grep -q "$m" "$VECTORS"; then
    add_finding critical R02 "$(bname "$VECTORS")" "0" "Method $m has no test vector"
  fi
done

# ── R03: Syntax validation ─────────────────────────────────────────────────
echo "[R03] Syntax validation..."

validate_blocks() {
  local file="$1"
  local fname
  fname=$(bname "$file")
  local in_block=false
  local block_type=""
  local block_content=""
  local block_start=0
  local line_num=0
  local last_heading=""

  while IFS= read -r line; do
    line_num=$((line_num + 1))
    # Track headings to detect intentionally-invalid test vectors
    if [[ "$line" =~ ^###\ .+ ]]; then
      last_heading="$line"
    fi
    if [[ "$line" =~ ^\`\`\`(json|yaml|abnf) ]]; then
      in_block=true
      block_type="${BASH_REMATCH[1]}"
      block_content=""
      block_start=$line_num
    elif [[ "$line" == '```' ]] && $in_block; then
      in_block=false
      # Skip intentionally-invalid blocks in parse-error / malformed test vectors
      local skip_validation=false
      if [[ "$last_heading" =~ [Pp]arse\ [Ee]rror || "$last_heading" =~ [Mm]alformed || "$last_heading" =~ [Ii]nvalid\ [Rr]equest ]]; then
        skip_validation=true
      fi
      case "$block_type" in
        json)
          if ! $skip_validation && ! echo "$block_content" | jq . >/dev/null 2>&1; then
            add_finding critical R03 "$fname" "$block_start" "Invalid JSON block"
          fi
          ;;
        yaml)
          if ! $skip_validation && ! echo "$block_content" | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin)" 2>/dev/null; then
            add_finding critical R03 "$fname" "$block_start" "Invalid YAML block"
          fi
          ;;
        abnf)
          while IFS= read -r aline; do
            if [[ -n "$aline" && ! "$aline" =~ ^[[:space:]]*\; && ! "$aline" =~ = && ! "$aline" =~ ^[[:space:]]*/ ]]; then
              add_finding minor R03 "$fname" "$block_start" "ABNF line may be malformed: $aline"
            fi
          done <<< "$block_content"
          ;;
      esac
    elif $in_block; then
      block_content+="$line"$'\n'
    fi
  done < "$file"
}

validate_blocks "$SPEC"
validate_blocks "$RUNTIME"
validate_blocks "$VECTORS"

# ── R04: Normative boundary ────────────────────────────────────────────────
echo "[R04] Normative boundary..."

for f in "$RUNTIME" "$VECTORS"; do
  fname=$(bname "$f")
  grep -n 'MUST\|SHALL\|REQUIRED' "$f" | while IFS=: read -r lnum content; do
    # Skip Reference/Expected lines (quoting spec)
    if echo "$content" | grep -q '\*\*Reference:\*\*\|\*\*Expected:\*\*'; then
      continue
    fi
    # Remove backtick-quoted content
    clean=$(echo "$content" | sed 's/`[^`]*`//g')
    # Check for standalone normative keywords
    if echo "$clean" | grep -qw 'MUST\|SHALL\|REQUIRED'; then
      # Double check it's a real keyword, not part of a word
      if echo "$clean" | perl -ne 'exit 0 if /\b(MUST|MUST NOT|SHALL|SHALL NOT|REQUIRED)\b/; exit 1'; then
        add_finding minor R04 "$fname" "$lnum" "RFC 2119 normative keyword in informative doc: $(echo "$content" | cut -c1-120)"
      fi
    fi
  done || true
done

# ── R05: Cross-references ──────────────────────────────────────────────────
echo "[R05] Cross-references..."

for f in "$SPEC" "$RUNTIME" "$VECTORS"; do
  fname=$(bname "$f")
  perl -ne '
    while (/Section (\d+(?:\.\d+)*)/g) {
      print "$.\t$1\n";
    }
  ' "$f" | while IFS=$'\t' read -r lnum sec_num; do
    if [[ "$sec_num" =~ \. ]]; then
      major=$(echo "$sec_num" | cut -d. -f1)
      minor_num=$(echo "$sec_num" | cut -d. -f2)
      pattern="^###* ${major}\.${minor_num} "
    else
      pattern="^## ${sec_num}\. "
    fi
    if ! grep -qE "$pattern" "$SPEC"; then
      add_finding minor R05 "$fname" "$lnum" "Reference to 'Section $sec_num' does not resolve to a heading in spec"
    fi
  done || true
done

# ── R06: ABNF vs usage ─────────────────────────────────────────────────────
echo "[R06] ABNF vs usage..."

VALID_KINDS="identity|provider|channel|tool|skill|memory|sandbox|policy|swarm"

for f in "$SPEC" "$RUNTIME" "$VECTORS"; do
  fname=$(bname "$f")
  perl -ne '
    while (m{(claw://[^\s`"'\''\)\]>]+)}g) {
      print "$.\t$1\n";
    }
  ' "$f" | while IFS=$'\t' read -r lnum uri; do
    # Skip template URIs containing { or < or ending with /
    if [[ "$uri" =~ \{ || "$uri" =~ \< || "$uri" =~ /$ ]]; then
      continue
    fi

    if [[ "$uri" =~ ^claw://local/ ]]; then
      remainder="${uri#claw://local/}"
      kind=$(echo "$remainder" | cut -d/ -f1)
      if ! echo "$kind" | grep -qE "^($VALID_KINDS)$"; then
        add_finding critical R06 "$fname" "$lnum" "URI '$uri' has invalid kind '$kind'"
      fi
      name_part=$(echo "$remainder" | cut -d/ -f2)
      if [ -z "$name_part" ]; then
        add_finding critical R06 "$fname" "$lnum" "URI '$uri' missing name segment"
      fi
      if [[ "$name_part" =~ @ ]]; then
        ver="${name_part#*@}"
        if ! echo "$ver" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.\-]+)?$'; then
          add_finding critical R06 "$fname" "$lnum" "URI '$uri' has invalid semver '$ver' (expected x.y.z)"
        fi
      fi
    elif [[ "$uri" =~ ^claw://registry/ ]]; then
      remainder="${uri#claw://registry/}"
      namespace=$(echo "$remainder" | cut -d/ -f1)
      name_ver=$(echo "$remainder" | cut -d/ -f2)
      if [ -z "$namespace" ] || [ -z "$name_ver" ]; then
        add_finding critical R06 "$fname" "$lnum" "URI '$uri' missing namespace or name"
      fi
      if [[ ! "$name_ver" =~ @ ]]; then
        add_finding critical R06 "$fname" "$lnum" "Registry URI '$uri' missing required @version"
      else
        ver="${name_ver#*@}"
        if ! echo "$ver" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.\-]+)?$'; then
          add_finding critical R06 "$fname" "$lnum" "URI '$uri' has invalid semver '$ver' (expected x.y.z)"
        fi
      fi
    elif [[ "$uri" =~ ^claw:// ]]; then
      # Alias form: claw://{kind}/{name}
      remainder="${uri#claw://}"
      kind=$(echo "$remainder" | cut -d/ -f1)
      if ! echo "$kind" | grep -qE "^($VALID_KINDS)$"; then
        add_finding minor R06 "$fname" "$lnum" "URI '$uri' does not match local, registry, or alias form"
      fi
    fi
  done || true
done

# ── R07: Conformance levels ────────────────────────────────────────────────
echo "[R07] Conformance levels..."

L1_RE="^(claw\\.initialize|claw\\.initialized|claw\\.status|claw\\.shutdown|claw\\.heartbeat)$"
L2_RE="^(claw\\.initialize|claw\\.initialized|claw\\.status|claw\\.shutdown|claw\\.heartbeat|claw\\.tool\\.call|claw\\.tool\\.approve|claw\\.tool\\.deny)$"
L3_RE="^(claw\\.initialize|claw\\.initialized|claw\\.status|claw\\.shutdown|claw\\.heartbeat|claw\\.tool\\.call|claw\\.tool\\.approve|claw\\.tool\\.deny|claw\\.swarm\\.delegate|claw\\.swarm\\.report|claw\\.swarm\\.broadcast|claw\\.swarm\\.discover|claw\\.memory\\.query|claw\\.memory\\.store|claw\\.memory\\.compact)$"

current_level=""
line_num=0
while IFS= read -r line; do
  line_num=$((line_num + 1))
  if echo "$line" | grep -q '## Level 1'; then
    current_level="L1"
  elif echo "$line" | grep -q '## Level 2'; then
    current_level="L2"
  elif echo "$line" | grep -q '## Level 3'; then
    current_level="L3"
  fi

  if [ -n "$current_level" ]; then
    method=$(echo "$line" | perl -ne 'print "$1\n" if /"method":\s*"(claw\.[^"]+)"/' || true)
    if [ -n "$method" ]; then
      case "$current_level" in
        L1) allowed="$L1_RE" ;;
        L2) allowed="$L2_RE" ;;
        L3) allowed="$L3_RE" ;;
        *) allowed="" ;;
      esac
      # Skip intentionally-invalid methods (test vectors for -32601 Method not found)
      if echo "$method" | grep -q "nonexistent"; then
        continue
      fi
      if [ -n "$allowed" ] && ! echo "$method" | grep -qE "$allowed"; then
        add_finding critical R07 "$(bname "$VECTORS")" "$line_num" "Method '$method' used in $current_level section but not allowed at that level"
      fi
    fi
  fi
done < "$VECTORS"

# ── R08: MUST rule coverage (best-effort) ──────────────────────────────────
echo "[R08] MUST rule coverage..."

must_sections=$(perl -ne '
  if (/^##+ (\d+(?:\.\d+)*)/) { $sec = $1 }
  if (/\bMUST\b/ && defined $sec && $sec =~ /^[5-9]/) { print "$sec\n" }
' "$SPEC" | sort -u)

uncovered=0
for sec in $must_sections; do
  if ! grep -q "Section $sec" "$VECTORS" 2>/dev/null; then
    uncovered=$((uncovered + 1))
  fi
done

if [ "$uncovered" -gt 0 ]; then
  add_finding info R08 "$(bname "$VECTORS")" "0" "$uncovered spec sections with MUST rules have no test vector referencing them"
fi

# ── R09: Field name consistency ────────────────────────────────────────────
echo "[R09] Field name consistency..."

# Index fields from both JSON and YAML blocks in spec
SPEC_JSON_FIELDS=$(awk '/^```json$/,/^```$/' "$SPEC" | perl -ne 'print "$1\n" while /"([a-zA-Z_]+)"\s*:/g' | sort -u)
SPEC_YAML_FIELDS=$(awk '/^```yaml$/,/^```$/' "$SPEC" | perl -ne 'print "$1\n" while /^\s*([a-zA-Z_]+)\s*:/g' | sort -u)
SPEC_FIELDS=$(printf '%s\n%s\n' "$SPEC_JSON_FIELDS" "$SPEC_YAML_FIELDS" | sort -u)

VECTOR_FIELDS=$(awk '/^```json$/,/^```$/' "$VECTORS" | perl -ne 'print "$1\n" while /"([a-zA-Z_]+)"\s*:/g' | sort -u)

# Common JSON-RPC fields + manifest fields used inside claw.initialize params
# Common JSON-RPC fields + manifest fields + tool-specific argument fields
COMMON_RE="^(jsonrpc|id|method|params|result|error|code|message|data|inline|spec|metadata|text|command|query|dataset_uri)$"
# Skip intentionally-invalid field names
INVALID_RE="^(nonexistent_field|nonexistent)$"

for field in $VECTOR_FIELDS; do
  if echo "$field" | grep -qE "$INVALID_RE"; then
    continue
  fi
  if ! echo "$SPEC_FIELDS" | grep -qx "$field" && ! echo "$field" | grep -qE "$COMMON_RE"; then
    line=$(grep -n "\"$field\"" "$VECTORS" | head -1 | cut -d: -f1)
    add_finding minor R09 "$(bname "$VECTORS")" "${line:-0}" "Field '$field' in test vectors not found in spec JSON/YAML examples"
  fi
done

# ── R10: Editorial consistency ─────────────────────────────────────────────
echo "[R10] Editorial consistency..."

for f in "$SPEC" "$RUNTIME" "$VECTORS"; do
  fname=$(bname "$f")
  if ! head -5 "$f" | grep -q '0\.2\.0'; then
    add_finding minor R10 "$fname" "1" "Header does not contain version 0.2.0"
  fi
done

for f in "$SPEC" "$RUNTIME" "$VECTORS"; do
  fname=$(bname "$f")
  stale_line=$(grep -n '0\.1\.0' "$f" | head -1 | cut -d: -f1 || true)
  if [ -n "$stale_line" ]; then
    add_finding minor R10 "$fname" "$stale_line" "Stale version 0.1.0 found"
  fi
done

for f in "$SPEC" "$RUNTIME" "$VECTORS"; do
  fname=$(bname "$f")
  grep -ni 'TODO\|FIXME\|TBD\|HACK' "$f" | while IFS=: read -r lnum content; do
    add_finding minor R10 "$fname" "$lnum" "Editorial marker found: $(echo "$content" | cut -c1-80)"
  done || true
done

# ── Generate Reports ───────────────────────────────────────────────────────
echo ""
echo "=== Generating reports ==="

# Recount from findings file (subshells may not propagate counters)
CRITICAL=$(awk -F'\t' '$2=="critical"' "$FINDINGS_TSV" | wc -l | tr -d ' ')
MINOR=$(awk -F'\t' '$2=="minor"' "$FINDINGS_TSV" | wc -l | tr -d ' ')
INFO=$(awk -F'\t' '$2=="info"' "$FINDINGS_TSV" | wc -l | tr -d ' ')
TOTAL=$((CRITICAL + MINOR + INFO))
if [ "$CRITICAL" -gt 0 ] || [ "$MINOR" -gt 5 ]; then
  RESULT="FAIL"
  EXIT_CODE=1
else
  RESULT="PASS"
  EXIT_CODE=0
fi

DATE=$(date '+%Y-%m-%d %H:%M:%S')

{
  echo "# Claw Kernel Protocol Coherence Report"
  echo ""
  echo "**Date:** $DATE"
  echo "**Result:** $RESULT"
  echo ""
  echo "## Summary"
  echo ""
  echo "- **Critical:** $CRITICAL"
  echo "- **Minor:** $MINOR"
  echo "- **Info:** $INFO"
  echo "- **Total:** $TOTAL"
  echo ""
  echo "### Blocking Policy"
  echo ""
  echo "- Critical > 0 → FAIL"
  echo "- Minor > 5 → FAIL"
  echo ""
  if [ "$TOTAL" -gt 0 ]; then
    echo "## Findings"
    echo ""
    echo "| # | Severity | Rule | File | Line | Description |"
    echo "|---|----------|------|------|------|-------------|"
    while IFS=$'\t' read -r fid sev rule file line desc; do
      echo "| $fid | $sev | $rule | $file | $line | $desc |"
    done < "$FINDINGS_TSV"
  else
    echo "## Findings"
    echo ""
    echo "No findings."
  fi
  echo ""
  echo "---"
  echo "*Generated by coherence-audit.sh*"
} > "$REPORT_MD"

{
  echo "{"
  echo "  \"date\": \"$DATE\","
  echo "  \"result\": \"$RESULT\","
  echo "  \"summary\": { \"critical\": $CRITICAL, \"minor\": $MINOR, \"info\": $INFO, \"total\": $TOTAL },"
  echo "  \"findings\": ["
  first=true
  while IFS=$'\t' read -r fid sev rule file line desc; do
    if $first; then first=false; else echo ","; fi
    esc_desc=$(echo "$desc" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf '    { "id": %s, "severity": "%s", "rule": "%s", "file": "%s", "line": %s, "description": "%s" }' \
      "$fid" "$sev" "$rule" "$file" "${line:-0}" "$esc_desc"
  done < "$FINDINGS_TSV"
  echo ""
  echo "  ]"
  echo "}"
} > "$REPORT_JSON"

echo ""
echo "=== Result: $RESULT ==="
echo "Critical: $CRITICAL | Minor: $MINOR | Info: $INFO | Total: $TOTAL"
echo "Reports: $REPORT_MD, $REPORT_JSON"

exit $EXIT_CODE
